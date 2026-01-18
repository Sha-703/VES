from rest_framework.authtoken.models import Token
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone

from elections_app.models import Candidate, Vote, Voter, AuditLog, Election
from elections_app.utils import auto_close_election
from elections_app.voter.serializers import VoterLoginSerializer, VoteSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def voter_login(request):
    """Connexion d'un électeur via identifiant + nom."""
    serializer = VoterLoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    identifier = serializer.validated_data['identifier']
    institution_id = request.data.get('institution_id')

    if not institution_id:
        return Response({'detail': 'Missing institution_id.'}, status=status.HTTP_400_BAD_REQUEST)

    # Authentifier les électeurs uniquement par institution + identifiant. Cela permet
    # de supprimer le champ 'nom' côté frontend tout en gardant la recherche unique.
    voter = get_object_or_404(Voter, institution_id=institution_id, identifier=identifier)

    if not voter.eligible:
        return Response({'detail': 'Voter not eligible.'}, status=status.HTTP_403_FORBIDDEN)

    # Créer ou récupérer un token pour l'électeur (lié à l'utilisateur associé si existant)
    # Si le modèle Voter n'est pas lié à User, il faut créer un User pour chaque électeur
    from django.contrib.auth.models import User
    user, created = User.objects.get_or_create(username=f"voter_{voter.id}")
    token, _ = Token.objects.get_or_create(user=user)

    return Response({'voter_id': voter.id, 'identifier': voter.identifier, 'name': voter.name, 'token': token.key}, status=status.HTTP_200_OK)


class VoteViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'])
    def cast_vote(self, request):
        candidate_id = request.data.get('candidate_id')
        voter_id = request.data.get('voter_id')

        # Requiert voter_id et election_id (bulletins supprimés)
        election_id = request.data.get('election_id')
        if not voter_id or not election_id:
            return Response({'detail': 'Missing required fields: voter_id and election_id are required (ballots removed).'}, status=status.HTTP_400_BAD_REQUEST)

        election = get_object_or_404(Election, id=election_id)

        # Si la date de fin de l'élection est atteinte, s'assurer qu'elle est clôturée automatiquement
        if auto_close_election(election):
            return Response({'detail': 'Voting window closed or not started.'}, status=status.HTTP_400_BAD_REQUEST)

        voter = get_object_or_404(Voter, id=voter_id)

        # Déterminer le candidat : supporter un vote 'nul' envoyé par le frontend
        # Un vote nul n'est PAS un candidat — enregistrer Vote.candidate = None.
        candidate = None
        if candidate_id is None or str(candidate_id).strip().lower() in ['', 'null', 'none']:
            candidate = None
        else:
            # Le modèle Candidate est lié à Election, s'assurer que le candidat appartient bien à cette élection.
            candidate = get_object_or_404(Candidate, id=candidate_id, election=election)

        now = timezone.now()

        # Utiliser la fenêtre de l'Election parente (start/end) pour déterminer si le vote est autorisé pour cette élection.
        # Logique harmonisée : utiliser les mêmes règles que ElectionSerializer.get_is_open
        # - Si start et end présents : ouvert si start <= maintenant < end (end exclus)
        # - Si start présent et pas end : ouvert si start <= maintenant
        # - Sinon (y compris end seul) : considérer comme fermé
        start = election.start
        end = election.end
        # Normaliser les datetimes naïves en aware avec le fuseau horaire courant
        try:
            if start and timezone.is_naive(start):
                start = timezone.make_aware(start, timezone.get_current_timezone())
        except Exception:
            start = election.start
        try:
            if end and timezone.is_naive(end):
                end = timezone.make_aware(end, timezone.get_current_timezone())
        except Exception:
            end = election.end

        if start and end:
            if not (start <= now < end):
                return Response({'detail': 'Voting window closed or not started.'}, status=status.HTTP_400_BAD_REQUEST)
        elif start and not end:
            if not (start <= now):
                return Response({'detail': 'Voting window closed or not started.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # end seul ou aucune fenêtre -> fermé
            return Response({'detail': 'Voting window closed or not started.'}, status=status.HTTP_400_BAD_REQUEST)

        # Empêcher le double vote par élection
        if Vote.objects.filter(election=election, voter=voter).exists():
            return Response({'detail': 'Voter already voted in this election.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                vote = Vote.objects.create(election=election, candidate=candidate, voter=voter)
                detail = {'candidate_id': candidate.id if candidate else None, 'election_id': election.id}
                AuditLog.objects.create(action='vote_cast', actor=voter.identifier, detail=detail)
            return Response({'detail': 'Vote recorded.', 'vote_id': vote.id}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'detail': f'Error recording vote: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def has_voted(self, request):
        """Vérifie si un électeur a déjà voté dans une élection donnée.

        Attend les paramètres de requête : `voter_id` et `election_id`.
        Retourne JSON : { voted: true/false }
        """
        voter_id = request.query_params.get('voter_id')
        election_id = request.query_params.get('election_id')
        if not voter_id or not election_id:
            return Response({'detail': 'Missing voter_id or election_id.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            voter = get_object_or_404(Voter, id=voter_id)
            election = get_object_or_404(Election, id=election_id)
        except Exception:
            return Response({'detail': 'Voter or election not found.'}, status=status.HTTP_404_NOT_FOUND)

        voted = Vote.objects.filter(election=election, voter=voter).exists()
        return Response({'voted': voted}, status=status.HTTP_200_OK)
