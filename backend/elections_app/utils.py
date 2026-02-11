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


def send_verification_email_async(voter_id, email, token):
    """Envoie un email de vérification de manière asynchrone (en utilisant threading).
    
    Cette fonction envoie l'email dans un thread séparé pour ne pas bloquer 
    la requête de connexion. Pour une vraie solution en production, utiliser Celery.
    """
    import threading
    
    def send_email():
        try:
            from django.core.mail import send_mail
            from django.conf import settings
            from elections_app.models import Voter
            
            # Recharger le voter pour s'assurer que le token est à jour
            voter = Voter.objects.get(id=voter_id)
            frontend_url = getattr(settings, 'FRONTEND_URL', 'https://vote-electronique-sur.onrender.com')
            verify_link = f"{frontend_url}/voter/verify-email?token={token}&voter_id={voter.id}"
            subject = "Vérification de votre email pour le vote électronique"
            body = f"Bonjour,\n\nPour valider votre identité et accéder au vote, veuillez cliquer sur ce lien : {verify_link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message."
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@ves')
            send_mail(subject, body, from_email, [email], fail_silently=True)
        except Exception:
            # Ignorer les erreurs pour ne pas impacter l'utilisateur
            pass
    
    thread = threading.Thread(target=send_email, daemon=True)
    thread.start()
