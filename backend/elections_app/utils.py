from django.utils import timezone

def auto_close_election(election):
    """Si une élection a une date de fin dépassée, s'assurer qu'elle est enregistrée comme clôturée.

    Cette fonction est idempotente : elle crée une seule entrée AuditLog pour
    'election_closed' si elle n'existe pas déjà pour cette élection.
    Retourne True si l'élection est considérée comme clôturée (fin atteinte), False sinon.
    """
    try:
        if not election or not getattr(election, 'end', None):
            return False
        now = timezone.now()
        end = election.end
        # Si la date de fin enregistrée est naïve, la rendre aware avec le fuseau horaire courant
        try:
            if end and timezone.is_naive(end):
                end = timezone.make_aware(end, timezone.get_current_timezone())
        except Exception:
            # en cas de problème, comparer directement
            end = election.end

        if now < end:
            return False

        # Import paresseux pour éviter les imports circulaires
        from elections_app.models import AuditLog

        # Marquer l'élection comme clôturée (flag persistant) et créer un AuditLog si besoin
        try:
            if not getattr(election, 'closed', False):
                election.closed = True
                election.save()
        except Exception:
            # ignorer les erreurs de sauvegarde pour ne pas casser les appels
            pass

        exists = AuditLog.objects.filter(action='election_closed', detail__election_id=election.id).exists()
        if not exists:
            actor = None
            try:
                actor = election.institution.user.username
            except Exception:
                actor = None
            try:
                # Reproduire le payload de clôture manuelle en incluant une liste 'closed' pour compatibilité
                AuditLog.objects.create(action='election_closed', actor=actor, detail={'election_id': election.id, 'closed': [election.id]})
            except Exception:
                # ignorer pour ne pas impacter les endpoints utilisateurs
                pass
        return True
    except Exception:
        return False
