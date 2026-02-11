from rest_framework import viewsets, status, serializers
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.authtoken.models import Token
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.contrib.auth.models import User
from django.conf import settings
from django.core.files.base import ContentFile

from elections_app.models import Election, Candidate, Vote, Voter, Institution, AuditLog
from elections_app.models import VoterImportFile
from elections_app.utils import auto_close_election
from elections_app.institution.serializers import (
    ElectionSerializer, CandidateSerializer, VoterSerializer,
    InstitutionSerializer, InstitutionRegisterSerializer,
    VoterImportFileSerializer,
)
from django.db.models import Count
from django.db.models.functions import TruncMinute, TruncHour
from django.core import signing
from django.core.mail import send_mail
from django.urls import reverse
import datetime
import logging
import random
from datetime import timedelta

# Twilio import removed; SMS verification endpoints disabled (Option A)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def institution_register(request):
    """Register a new institution."""
    # Do not log Authorization headers in production. Keep registration handler minimal.

    serializer = InstitutionRegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = User.objects.create_user(
            username=serializer.validated_data['username'],
            email=serializer.validated_data['email'],
            password=serializer.validated_data['password']
        )
        institution = Institution.objects.create(
            user=user,
            name=serializer.validated_data['institution_name'],
            description=serializer.validated_data.get('institution_description', ''),
            is_verified=True,
        )
        # No email verification: mark the institution as verified so user can log in immediately.
        institution.verification_sent_at = timezone.now()
        institution.save()
        # Do NOT create or return an auth token here; user should log in via the login endpoint.
        AuditLog.objects.create(action='institution_registered', actor=user.username, detail={'institution_id': institution.id})
        # Notify site admins / superusers about the new registration (do not block on errors)
        try:
            recipients = []
            try:
                admins = getattr(settings, 'ADMINS', None)
                if admins:
                    recipients = [a[1] for a in admins if len(a) > 1 and a[1]]
            except Exception:
                recipients = []

            if not recipients:
                # Fallback to superusers' emails
                try:
                    su_emails = list(User.objects.filter(is_superuser=True).values_list('email', flat=True))
                    recipients = [e for e in su_emails if e]
                except Exception:
                    recipients = []

            if recipients:
                subject = f"Nouvelle inscription d'institution — {institution.name}"
                body = (
                    f"L'institution '{institution.name}' vient de s'enregistrer.\n\n"
                    f"Utilisateur : {getattr(user, 'username', '')} ({getattr(user, 'email', '')})\n"
                    f"Institution ID : {institution.id}\n"
                    f"Inscrit à : {institution.created_at.isoformat() if getattr(institution, 'created_at', None) else timezone.now().isoformat()}\n\n"
                    "Vous pouvez vous connecter à l'administration Django pour plus de détails."
                )
                from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'no-reply@ves'
                send_mail(subject, body, from_email, recipients, fail_silently=True)
        except Exception:
            pass

        # Return a simple success message: account created and ready to login
        return Response({'detail': 'Account created. Vous pouvez vous connecter.'}, status=status.HTTP_201_CREATED)
    logging.getLogger(__name__).warning('Institution register validation failed: %s', serializer.errors)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def institution_login(request):
    """Login an institution (via username/password)."""
    # Support legacy 'username' param, but prefer 'institution_name' for login
    institution_name = request.data.get('institution_name') or request.data.get('username')
    password = request.data.get('password')

    if not institution_name or not password:
        return Response({'detail': 'Missing credentials.'}, status=status.HTTP_400_BAD_REQUEST)

    # Find institution by name (case-insensitive) and verify the related user's password
    try:
        inst = Institution.objects.select_related('user').filter(name__iexact=institution_name).first()
        if not inst:
            return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)
        user = inst.user
        if not user.check_password(password):
            return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)
    except Exception:
        return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)
    
    token, _ = Token.objects.get_or_create(user=user)
    # Previously the system required email/SMS verification before login.
    # Verification has been disabled: allow login regardless of `is_verified`.
    return Response({
        'token': token.key,
        'user_id': user.id,
        'institution': {
            'id': inst.id,
            'name': inst.name,
            'description': inst.description
        }
    }, status=status.HTTP_200_OK)



# SMS verification endpoints removed (Option A): endpoints and frontend wrappers deleted, model retained.


class InstitutionViewSet(viewsets.ModelViewSet):
    """ViewSet for Institution (for authenticated institution users)."""
    queryset = Institution.objects.all()
    serializer_class = InstitutionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Institution.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get', 'patch'])
    def my_institution(self, request):
        # Return or update institution info and basic import statistics.
        institution = get_object_or_404(Institution, user=request.user)
        # Initialiser les compteurs liés à l'import en cas d'absence
        created = 0
        updated = 0
        errors = []

        if request.method == 'PATCH':
            # Permettre la mise à jour du nom/description de l'institution et de l'email/mot de passe utilisateur associé
            data = request.data or {}
            user = request.user
            changed = False

            # Champs institution : accepter 'institution_name' ou 'name'
            inst_name = data.get('institution_name') or data.get('name')
            if inst_name is not None and inst_name != institution.name:
                institution.name = inst_name
                changed = True

            inst_desc = data.get('description') or data.get('institution_description')
            if inst_desc is not None and inst_desc != getattr(institution, 'description', None):
                institution.description = inst_desc
                changed = True

            # Mettre à jour l'email utilisateur si fourni
            email = data.get('email')
            if email and email != getattr(user, 'email', None):
                user.email = email
                user.save()
                changed = True

            # Mettre à jour le mot de passe utilisateur si fourni
            password = data.get('password')
            if password:
                try:
                    user.set_password(password)
                    user.save()
                    changed = True
                except Exception as e:
                    errors.append(str(e))

            if changed:
                try:
                    institution.save()
                    AuditLog.objects.create(action='institution_updated', actor=user.username, detail={'institution_id': institution.id})
                except Exception as e:
                    errors.append(str(e))
        total_rows = Voter.objects.filter(institution=institution).count()

        try:
            AuditLog.objects.create(
                action='voters_imported',
                actor=request.user.username,
                detail={'institution_id': institution.id, 'created': created, 'updated': updated, 'total_rows': total_rows},
            )
        except Exception:
            pass

        # Pour compatibilité ascendante, l'endpoint retourne l'objet institution
        # comme racine du JSON (le frontend attend `inst.data` comme institution).
        # Garder les stats d'import sous `last_import` dans le payload institution si le frontend veut les lire plus tard.
        inst_data = InstitutionSerializer(institution).data
        inst_data['last_import'] = {'created': created, 'updated': updated, 'errors': errors, 'total_rows': total_rows}
        return Response(inst_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='imports')
    def list_imports(self, request, pk=None):
        institution = get_object_or_404(Institution, id=pk, user=request.user)
        files = VoterImportFile.objects.filter(institution=institution).order_by('-uploaded_at')
        serializer = VoterImportFileSerializer(files, many=True, context={'request': request})
        return Response({'imports': serializer.data}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='import_voters', parser_classes=[MultiPartParser, FormParser])
    def import_voters(self, request, pk=None):
        """Upload and import voters CSV/XLSX for the institution.

        Supports a `?preview=true` query parameter to parse the file but not persist changes.
        """
        institution = get_object_or_404(Institution, id=pk, user=request.user)

        f = request.FILES.get('file')
        if not f:
            return Response({'detail': 'file required.'}, status=status.HTTP_400_BAD_REQUEST)

        is_preview = request.query_params.get('preview') in ('1', 'true', 'True')

        # Lire les octets une seule fois
        raw = None
        try:
            raw = f.read()
        except Exception:
            return Response({'detail': 'Could not read uploaded file.'}, status=status.HTTP_400_BAD_REQUEST)

        # Essayer UTF-8 avec BOM puis basculer sur latin-1
        text = None
        for enc in ('utf-8-sig', 'utf-8', 'latin-1'):
            try:
                text = raw.decode(enc)
                break
            except Exception:
                text = None
        if text is None:
            return Response({'detail': 'Could not decode file. Use UTF-8 or Latin-1 encoded CSV.'}, status=status.HTTP_400_BAD_REQUEST)

        import csv
        from io import StringIO

        sio = StringIO(text)
        reader = csv.DictReader(sio)

        total_rows = 0
        eligible_ok = 0
        invalid = 0
        created = 0
        updated = 0

        parsed_rows = []
        for row in reader:
            total_rows += 1
            # Essayer les noms de colonnes courants pour l'identifiant et le nom. On ignore volontairement
            # toute colonne 'eligible' et on considère tous les électeurs importés comme éligibles par défaut.
            identifier = (row.get('identifier') or row.get('id') or row.get('email') or '').strip()
            name = (row.get('name') or row.get('full_name') or row.get('nom') or '').strip()
            # Forcer l'éligibilité à True pour tous les électeurs importés pour simplifier l'import
            eligible_val = True

            if not identifier:
                invalid += 1
                continue

            if eligible_val:
                eligible_ok += 1

            parsed_rows.append({'identifier': identifier, 'name': name, 'eligible': eligible_val})

        # Mode aperçu : ne retourner que les compteurs
        if is_preview:
            return Response({'total_rows': total_rows, 'eligible': eligible_ok, 'invalid': invalid}, status=status.HTTP_200_OK)

        # Enregistrer le fichier importé
        try:
            from django.core.files.base import ContentFile
            imp = VoterImportFile.objects.create(
                institution=institution,
                file=ContentFile(raw, name=f.name),
                uploaded_by=request.user.username if getattr(request.user, 'username', None) else None,
                total_rows=total_rows,
            )
        except Exception as e:
            return Response({'detail': f'Error saving import file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Créer ou mettre à jour les électeurs
        try:
            with transaction.atomic():
                for r in parsed_rows:
                    obj, created_flag = Voter.objects.update_or_create(
                        institution=institution,
                        identifier=r['identifier'],
                        defaults={'name': r['name'], 'eligible': r['eligible'], 'import_file': imp},
                    )
                    if created_flag:
                        created += 1
                    else:
                        updated += 1

                imp.created = created
                imp.updated = updated
                imp.save()
                AuditLog.objects.create(action='voters_imported', actor=request.user.username, detail={'institution_id': institution.id, 'created': created, 'updated': updated, 'total_rows': total_rows})
        except Exception as e:
            return Response({'detail': f'Error importing voters: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'created': created, 'updated': updated, 'total_rows': total_rows}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='imports/delete')
    def delete_import_file(self, request, pk=None):
        institution = get_object_or_404(Institution, id=pk, user=request.user)
        file_id = request.data.get('file_id')
        if not file_id:
            return Response({'detail': 'file_id required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            imp = VoterImportFile.objects.get(id=file_id, institution=institution)
        except VoterImportFile.DoesNotExist:
            return Response({'detail': 'Import file not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            voters = Voter.objects.filter(import_file=imp)
            voters_with_votes = voters.filter(votes__isnull=False).distinct()
            if voters_with_votes.exists():
                ids = list(voters_with_votes.values_list('identifier', flat=True)[:20])
                return Response({'detail': 'Cannot delete import: some imported voters have recorded votes.', 'blocked_voters_sample': ids, 'blocked_count': voters_with_votes.count()}, status=status.HTTP_400_BAD_REQUEST)

            try:
                voters.delete()
            except Exception:
                pass

            imp.file.delete(save=False)
            imp.delete()
            AuditLog.objects.create(action='import_file_deleted', actor=request.user.username, detail={'file_id': file_id, 'institution_id': institution.id})
            return Response({'detail': 'Deleted.'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'detail': f'Error deleting file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='imports/force_delete')
    def force_delete_import(self, request, pk=None):
        institution = get_object_or_404(Institution, id=pk, user=request.user)
        file_id = request.data.get('file_id')
        if not file_id:
            return Response({'detail': 'file_id required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            imp = VoterImportFile.objects.get(id=file_id, institution=institution)
        except VoterImportFile.DoesNotExist:
            return Response({'detail': 'Import file not found.'}, status=status.HTTP_404_NOT_FOUND)

        from io import StringIO
        import csv as pycsv

        try:
            voters = Voter.objects.filter(import_file=imp)

            out = StringIO()
            writer = pycsv.writer(out)
            # Écrire l'en-tête du CSV de sauvegarde
            writer.writerow(['voter_identifier', 'voter_name', 'eligible', 'created_at', 'votes'])

            import json
            # Pour chaque électeur, ajouter ses votes au CSV
            for v in voters:
                votes = list(Vote.objects.filter(voter=v).values('id', 'ballot_id', 'candidate_id', 'timestamp'))
                writer.writerow([v.identifier, v.name, v.eligible, v.created_at.isoformat(), json.dumps(votes, default=str)])

            # Récupérer le contenu du CSV de sauvegarde
            backup_csv = out.getvalue()

            # Suppression des votes et électeurs liés à l'import, puis du fichier
            with transaction.atomic():
                Vote.objects.filter(voter__in=voters).delete()
                voters.delete()
                imp.file.delete(save=False)
                imp.delete()
                AuditLog.objects.create(action='import_file_force_deleted', actor=request.user.username, detail={'file_id': file_id, 'institution_id': institution.id})

            # Sauvegarde sur S3 si configuré
            s3_url = None
            if getattr(settings, 'AWS_S3_BUCKET_NAME', None):
                try:
                    import boto3  # type: ignore
                    from botocore.exceptions import BotoCoreError, ClientError  # type: ignore
                    s3 = boto3.client(
                        's3',
                        aws_access_key_id=getattr(settings, 'AWS_ACCESS_KEY_ID', None),
                        aws_secret_access_key=getattr(settings, 'AWS_SECRET_ACCESS_KEY', None),
                        region_name=getattr(settings, 'AWS_REGION', None),
                    )
                    import datetime
                    key = f"backups/import_backup_{imp.id}_{datetime.datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}.csv"
                    s3.put_object(Bucket=settings.AWS_S3_BUCKET_NAME, Key=key, Body=backup_csv.encode('utf-8'), ContentType='text/csv')
                    try:
                        s3_url = s3.generate_presigned_url('get_object', Params={'Bucket': settings.AWS_S3_BUCKET_NAME, 'Key': key}, ExpiresIn=3600)
                    except Exception:
                        s3_url = f"https://{settings.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/{key}"
                except Exception:
                    s3_url = None

            if s3_url:
                return Response({'detail': 'Deleted.', 'backup_url': s3_url}, status=status.HTTP_200_OK)
            return Response({'detail': 'Deleted.', 'backup': backup_csv}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'detail': f'Error during force delete: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def voters_summary(self, request):
        institution = get_object_or_404(Institution, user=request.user)
        total_voters = Voter.objects.filter(institution=institution).count()
        eligible_voters = Voter.objects.filter(institution=institution, eligible=True).count()

        last_import = AuditLog.objects.filter(action='voters_imported', actor=request.user.username, detail__institution_id=institution.id).order_by('-timestamp').first()
        last_import_detail = None
        if last_import:
            last_import_detail = {
                'timestamp': last_import.timestamp,
                'detail': last_import.detail,
            }

        return Response({'total_voters': total_voters, 'eligible_voters': eligible_voters, 'last_import': last_import_detail}, status=status.HTTP_200_OK)


class ElectionViewSet(viewsets.ModelViewSet):
    """ViewSet for Elections (institution can CRUD, voter can list)."""
    queryset = Election.objects.all()
    serializer_class = ElectionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        """
        - Si utilisateur institution authentifié : retourne toutes ses élections (gestion).
        - Si ?institution=ID fourni (électeur ou anonyme) : retourne uniquement les élections ouvertes de cette institution.
        """
        user = self.request.user
        institution_id = self.request.query_params.get('institution') or self.request.query_params.get('institution_id')
        now = timezone.now()

        # Cas institution connectée (gestion)
        if user.is_authenticated and hasattr(user, 'institution'):
            institution = user.institution
            qs = Election.objects.filter(institution=institution)
            for e in qs:
                pass  # Suppression de la clôture automatique
            return qs

        # Cas électeur ou anonyme : ne retourner que les élections ouvertes de l'institution demandée
        if institution_id:
            return Election.objects.filter(
                institution__id=institution_id,
                start__lte=now,
                end__gt=now,
                closed=False
            )

        return Election.objects.none()

    def perform_create(self, serializer):
        institution = get_object_or_404(Institution, user=self.request.user)
        # Suppression de la vérification : permettre aux institutions de créer des élections immédiatement.
        # Normaliser les dates de début/fin si fournies (depuis HTML datetime-local ou chaînes ISO)
        start_raw = self.request.data.get('start')
        end_raw = self.request.data.get('end')
        start_dt = None
        end_dt = None
        try:
            if start_raw:
                start_dt = parse_datetime(start_raw)
                if start_dt is not None and timezone.is_naive(start_dt):
                    start_dt = timezone.make_aware(start_dt, timezone.get_current_timezone())
            if end_raw:
                end_dt = parse_datetime(end_raw)
                if end_dt is not None and timezone.is_naive(end_dt):
                    end_dt = timezone.make_aware(end_dt, timezone.get_current_timezone())
        except Exception:
            start_dt = None
            end_dt = None

        # Ne définir start/end à la création que si le client demande explicitement l'ouverture immédiate (via `open_immediately`).
        # Cela garantit que les élections nouvellement créées restent fermées par défaut même si le client a fourni des dates.
        # Par précaution, on retire aussi tout champ `start`/`end` de validated_data si `open_immediately` n'est pas vrai pour éviter leur persistance involontaire.
        import logging
        logger = logging.getLogger(__name__)

        save_kwargs = {'institution': institution}
        open_immediately = bool(self.request.data.get('open_immediately'))

        # Journaliser les valeurs de la requête entrante pour le debug (temporaire)
        logger.info("perform_create: open_immediately=%s, start_raw=%s, end_raw=%s", open_immediately, start_raw, end_raw)
        logger.info("perform_create: serializer.initial_data keys=%s", list(getattr(serializer, 'initial_data', {}).keys()))
        logger.info("perform_create: serializer.validated_data before cleanup=%s", {k: v for k, v in serializer.validated_data.items() if k in ('start','end')})

        # Si le client demande l'ouverture immédiate et fournit les deux dates, les définir explicitement
        if open_immediately and start_dt is not None and end_dt is not None:
            # validate ordering
            if start_dt >= end_dt:
                raise serializers.ValidationError({'detail': 'start must be before end.'})
            save_kwargs['start'] = start_dt
            save_kwargs['end'] = end_dt
        else:
            # S'assurer que le serializer ne persiste pas accidentellement les champs start/end
            try:
                # validated_data is a dict-like ReturnDict; pop if present
                serializer.validated_data.pop('start', None)
                serializer.validated_data.pop('end', None)
            except Exception:
                pass

        # Sauvegarder et journaliser l'état de l'élection créée pour le debug
        serializer.save(**save_kwargs)
        try:
            created = serializer.instance
            # compute serializer-level is_open for the created instance
            ser = ElectionSerializer(created, context={'request': self.request})
            is_open_val = ser.data.get('is_open')
            logger.info("Election created id=%s start=%s end=%s is_open=%s", created.id, getattr(created, 'start', None), getattr(created, 'end', None), is_open_val)
        except Exception as e:
            logger.exception('Error logging created election state: %s', e)

        AuditLog.objects.create(
            action='election_created',
            actor=self.request.user.username,
            detail={'election_title': serializer.instance.title}
        )
        # Remarque : la création automatique de bulletins est supprimée — les institutions doivent créer les bulletins explicitement.

    def get_object(self):
        """
        - Institution connectée : accès à toutes ses élections.
        - Électeur/anonyme : accès uniquement aux élections ouvertes de l'institution.
        """
        obj = super().get_object()
        user = self.request.user
        now = timezone.now()
        # Si institution propriétaire connectée, accès total
        if user.is_authenticated and hasattr(user, 'institution') and obj.institution == user.institution:
            return obj
        # Sinon, accès seulement si l'élection est ouverte
        if obj.start and obj.end and obj.start <= now < obj.end and not obj.closed:
            return obj
        from rest_framework.exceptions import NotFound
        raise NotFound("Cette élection est fermée, n'est pas encore ouverte, ou vous n'y avez pas accès. Veuillez vérifier les dates d'ouverture ou contacter l'institution.")

    def _get_participation_rate_for_election(self, election):
        """Return participation rate (%) for the whole election based on eligible voters of the institution."""
        institution = election.institution
        total_eligible = institution.voters.filter(eligible=True).count()
        if total_eligible == 0:
            return 0
        total_votes = Vote.objects.filter(election=election).count()
        return round((total_votes / total_eligible) * 100, 2)

    @action(detail=True, methods=['post'])
    def advance_to_round2(self, request, pk=None):
        election = self.get_object()
        if election.scrutin_type != 'majoritaire_2tours':
            return Response({'detail': 'Election not configured for two-round majoritarian.'}, status=status.HTTP_400_BAD_REQUEST)
        # Optionnel : accepter start/end/title et open_immediately pour créer un bulletin du second tour
        start_raw = request.data.get('start')
        end_raw = request.data.get('end')
        title = request.data.get('title') or f"Second tour - {election.title}"
        open_immediately = bool(request.data.get('open_immediately'))
        # Nouveau comportement optionnel : créer une nouvelle Election pour le second tour avec seulement les candidats qualifiés
        create_new = bool(request.data.get('create_new_election'))
        qualified_ids = request.data.get('qualified_candidate_ids') or None

        # Parser les dates
        start_dt = None
        end_dt = None
        try:
            if start_raw:
                start_dt = parse_datetime(start_raw)
                if start_dt is not None and timezone.is_naive(start_dt):
                    start_dt = timezone.make_aware(start_dt, timezone.get_current_timezone())
            if end_raw:
                end_dt = parse_datetime(end_raw)
                if end_dt is not None and timezone.is_naive(end_dt):
                    end_dt = timezone.make_aware(end_dt, timezone.get_current_timezone())
        except Exception:
            start_dt = None
            end_dt = None

        # Pour les élections à deux tours, on ne crée plus d'objet Ballot séparé.
        # Optionnel : créer un nouvel objet Election pour le second tour avec uniquement les candidats qualifiés
        if create_new:
            try:
                import logging
                logger = logging.getLogger(__name__)

                new_election = Election.objects.create(
                    institution=election.institution,
                    title=title,
                    description=election.description,
                    scrutin_type=election.scrutin_type,
                    majority_threshold=election.majority_threshold,
                    advance_threshold=election.advance_threshold,
                    start=start_dt,
                    end=end_dt,
                    current_round=2,
                )
                # Copier les candidats qualifiés
                if qualified_ids:
                    # Copier les candidats par id ; dupliquer les fichiers photo pour éviter les références partagées
                    from django.core.files.base import ContentFile
                    from django.core.files.storage import default_storage
                    import os
                    import uuid

                    # Convertir les ids reçus en int de façon défensive
                    try:
                        if isinstance(qualified_ids, (list, tuple)):
                            qids = [int(x) for x in qualified_ids]
                        else:
                            qids = [int(qualified_ids)]
                    except Exception:
                        qids = []

                    for cid in qids:
                        try:
                            c = Candidate.objects.get(id=cid, election=election)
                            new_c = Candidate.objects.create(
                                election=new_election,
                                name=c.name,
                                bio=c.bio,
                                position=c.position,
                            )
                            # Dupliquer le fichier photo si présent
                            if getattr(c, 'photo', None) and getattr(c.photo, 'name', None):
                                try:
                                    src_name = c.photo.name
                                    with default_storage.open(src_name, 'rb') as fh:
                                        data = fh.read()
                                    base = os.path.basename(src_name)
                                    new_name = f"candidates/{new_election.id}_{uuid.uuid4().hex}_{base}"
                                    new_c.photo.save(new_name, ContentFile(data))
                                except Exception as e:
                                    logger.exception('Failed to copy candidate photo %s: %s', getattr(c.photo, 'name', None), str(e))
                                    # si la copie échoue, ignorer la photo mais garder le candidat
                                    pass
                        except Candidate.DoesNotExist:
                            logger.warning('Qualified candidate id %s not found for election %s', cid, election.id)
                            continue
                        except Exception as e:
                            logger.exception('Error copying candidate id %s: %s', cid, str(e))
                            continue
                else:
                    # Si aucun id qualifié n'est fourni, prendre par défaut les 2 premiers par nombre de voix
                    total_votes = Vote.objects.filter(election=election).count()
                    counts = []
                    for cand in election.candidates.all():
                        vcount = Vote.objects.filter(election=election, candidate=cand).count()
                        counts.append((cand, vcount))
                    counts.sort(key=lambda x: x[1], reverse=True)
                    top = [c for c, _ in counts][:2]
                    for c in top:
                        Candidate.objects.create(
                            election=new_election,
                            name=c.name,
                            bio=c.bio,
                            position=c.position,
                            photo=c.photo,
                        )

                AuditLog.objects.create(action='advance_to_round2', actor=request.user.username, detail={'election_id': election.id, 'new_election_id': new_election.id})
                return Response({'status': 'created', 'new_election_id': new_election.id}, status=status.HTTP_201_CREATED)
            except Exception as e:
                import logging, traceback
                logger = logging.getLogger(__name__)
                tb = traceback.format_exc()
                logger.error('Exception creating second-round election: %s\n%s', str(e), tb)
                # Return a helpful error message to the frontend (avoid leaking sensitive internals)
                return Response({'detail': f'Error creating second-round election: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Update the existing election for round 2
        if start_dt is not None:
            election.start = start_dt
        if end_dt is not None:
            election.end = end_dt

        election.current_round = 2
        election.save()
        AuditLog.objects.create(action='advance_to_round2', actor=request.user.username, detail={'election_id': election.id})
        resp = {'status': 'advanced', 'current_round': election.current_round}
        return Response(resp, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def finalize_winner(self, request, pk=None):
        election = self.get_object()
        candidate_id = request.data.get('candidate_id')
        if not candidate_id:
            return Response({'detail': 'candidate_id required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            candidate = Candidate.objects.get(id=candidate_id, election=election)
        except Candidate.DoesNotExist:
            return Response({'detail': 'Candidate not found for this election.'}, status=status.HTTP_404_NOT_FOUND)
        election.finalized_winner = candidate
        election.save()
        AuditLog.objects.create(action='finalize_winner', actor=request.user.username, detail={'election_id': election.id, 'winner_id': candidate.id})
        return Response({'status': 'finalized', 'winner': CandidateSerializer(candidate).data}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def open_election(self, request, pk=None):
        """Open all ballots of the election (set status to 'open')."""
        election = self.get_object()
        open_immediately = bool(request.data.get('open_immediately'))
        now = timezone.now()
        opened = []
        if open_immediately:
            # Toujours définir start et end pour garantir l'ouverture
            default_duration = timezone.timedelta(hours=24)
            election.start = now
            election.end = now + default_duration
            election.closed = False
            election.save()
            opened.append(election.id)

        AuditLog.objects.create(action='election_opened', actor=request.user.username, detail={'election_id': election.id, 'opened': opened})
        return Response({'status': 'opened', 'opened': opened, 'opened_ballots': opened}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def close_election(self, request, pk=None):
        """Close all ballots of the election (set status to 'closed')."""
        election = self.get_object()
        now = timezone.now()
        # With ballot removed, closing an election sets its end time
        if not election.end:
            election.end = now
            election.save()

        # Return closed ids as a list and include 'closed_ballots' for compatibility
        closed_ids = [election.id]
        AuditLog.objects.create(action='election_closed', actor=request.user.username, detail={'election_id': election.id, 'closed': closed_ids})
        return Response({'status': 'closed', 'closed': closed_ids, 'closed_ballots': closed_ids}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        """Agrège les résultats pour toute l'élection (tous bulletins confondus)."""
        election = self.get_object()
        candidates = election.candidates.all()
        # total des votes sur tous les bulletins pour cette élection
        total_votes = Vote.objects.filter(election=election).count()
        counts = []
        for candidate in candidates:
            vcount = Vote.objects.filter(election=election, candidate=candidate).count()
            percent = round((vcount / total_votes) * 100, 2) if total_votes > 0 else 0.0
            counts.append({'candidate_id': candidate.id, 'candidate_name': candidate.name, 'votes': vcount, 'percent': percent})

        # ajouter le placeholder 'Vote nul'
        nul_count = Vote.objects.filter(election=election, candidate__isnull=True).count()
        counts.append({'candidate_id': None, 'candidate_name': 'Vote nul', 'votes': nul_count, 'percent': round((nul_count / total_votes) * 100, 2) if total_votes > 0 else 0.0})

        response = {
            'election_id': election.id,
            'election_title': election.title,
            'total_votes': total_votes,
            'participation_rate': self._get_participation_rate_for_election(election),
            'candidates': counts,
        }

        # Vérification du gagnant pour un scrutin à un tour
        if election.scrutin_type == 'majoritaire_1tour':
            sorted_c = sorted([c for c in counts if c['candidate_id'] is not None], key=lambda x: x['votes'], reverse=True)
            if sorted_c:
                response['status'] = 'single_round_result'
                response['winner'] = sorted_c[0]
            else:
                response['status'] = 'no_votes'
            return Response(response, status=status.HTTP_200_OK)

        # Logique pour scrutin majoritaire à deux tours (agrégé)
        if election.scrutin_type == 'majoritaire_2tours':
            majority = float(election.majority_threshold or 50)
            winners = [c for c in counts if c['candidate_id'] is not None and c['percent'] >= majority]
            if winners:
                response['status'] = 'first_round_elected'
                response['winner'] = winners[0]
                return Response(response, status=status.HTTP_200_OK)

            # Nouvelle logique : seuls les deux premiers candidats passent au second tour
            sorted_by_votes = sorted([c for c in counts if c['candidate_id'] is not None], key=lambda x: x['votes'], reverse=True)
            qualifiers = sorted_by_votes[:2]

            response['status'] = 'second_round_required'
            response['qualified_candidates'] = qualifiers
            response['election_current_round'] = election.current_round
            response['election_majority_threshold'] = election.majority_threshold
            response['election_advance_threshold'] = election.advance_threshold
            return Response(response, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='timeline')
    def timeline(self, request, pk=None):
        """Retourne une agrégation temporelle des votes pour l'élection.

        Paramètres de requête :
        - unit : 'minute' (par défaut) ou 'hour'
        - start : datetime ISO (optionnel)
        - end : datetime ISO (optionnel)

        Réponse : { timeline: [{ timestamp: ISO, total: int, by_candidate: [{candidate_id, votes}, ...] }, ...] }
        """
        election = self.get_object()
        unit = (request.query_params.get('unit') or 'minute').lower()
        start_raw = request.query_params.get('start')
        end_raw = request.query_params.get('end')

        start = None
        end = None
        try:
            if start_raw:
                start = parse_datetime(start_raw)
            if end_raw:
                end = parse_datetime(end_raw)
        except Exception:
            return Response({'detail': 'Invalid start/end datetime format.'}, status=status.HTTP_400_BAD_REQUEST)

        qs = Vote.objects.filter(election=election)
        if start:
            qs = qs.filter(timestamp__gte=start)
        if end:
            qs = qs.filter(timestamp__lte=end)

        if unit == 'hour':
            trunc = TruncHour('timestamp')
        else:
            trunc = TruncMinute('timestamp')

        # Annotate counts per bucket and candidate
        rows = (
            qs.annotate(bucket=trunc)
              .values('bucket', 'candidate')
              .annotate(votes=Count('id'))
              .order_by('bucket')
        )

        # Build timeline dict keyed by bucket
        timeline = {}
        for r in rows:
            b = r['bucket']
            if b is None:
                continue
            key = b.isoformat()
            if key not in timeline:
                timeline[key] = {'timestamp': b.isoformat(), 'total': 0, 'by_candidate': []}
            cid = r['candidate']
            timeline[key]['by_candidate'].append({'candidate_id': cid, 'votes': r['votes']})
            timeline[key]['total'] += r['votes']

        # Ensure timeline is returned sorted by timestamp
        out = [timeline[k] for k in sorted(timeline.keys())]

        return Response({'timeline': out}, status=status.HTTP_200_OK)


class CandidateViewSet(viewsets.ModelViewSet):
    queryset = Candidate.objects.all()
    serializer_class = CandidateSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get_queryset(self):
        institution = get_object_or_404(Institution, user=self.request.user)
        return Candidate.objects.filter(election__institution=institution)

    def perform_create(self, serializer):
        election_id = self.request.data.get('election')
        election = get_object_or_404(Election, id=election_id)
        serializer.save(election=election)
        AuditLog.objects.create(action='candidate_added', actor=self.request.user.username, detail={'candidate_name': serializer.instance.name})


class VoterViewSet(viewsets.ModelViewSet):
    queryset = Voter.objects.all()
    serializer_class = VoterSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        institution = get_object_or_404(Institution, user=self.request.user)
        return Voter.objects.filter(institution=institution)

    def perform_create(self, serializer):
        institution = get_object_or_404(Institution, user=self.request.user)
        serializer.save(institution=institution)
        AuditLog.objects.create(action='voter_added', actor=self.request.user.username, detail={'voter_id': serializer.instance.identifier})
    def perform_create(self, serializer):
        institution = get_object_or_404(Institution, user=self.request.user)
        serializer.save(institution=institution)
        AuditLog.objects.create(action='voter_added', actor=self.request.user.username, detail={'voter_id': serializer.instance.identifier})
