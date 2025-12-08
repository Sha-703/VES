from django.utils import timezone

def auto_close_election(election):
    """If an election has an end datetime that is past, ensure it's recorded as closed.

    This function is idempotent: it will create a single AuditLog entry for
    'election_closed' if one does not already exist for this election.
    Returns True if the election is considered closed (end reached), False otherwise.
    """
    try:
        if not election or not getattr(election, 'end', None):
            return False
        now = timezone.now()
        end = election.end
        # If the stored end is naive, make it aware using current timezone
        try:
            if end and timezone.is_naive(end):
                end = timezone.make_aware(end, timezone.get_current_timezone())
        except Exception:
            # if any problem, fall back to comparing directly
            end = election.end

        if now < end:
            return False

        # Lazy import to avoid circular imports
        from elections_app.models import AuditLog

        # Mark election as closed (persistent flag) and create an AuditLog if needed
        try:
            if not getattr(election, 'closed', False):
                election.closed = True
                election.save()
        except Exception:
            # ignore save errors to avoid breaking callers
            pass

        exists = AuditLog.objects.filter(action='election_closed', detail__election_id=election.id).exists()
        if not exists:
            actor = None
            try:
                actor = election.institution.user.username
            except Exception:
                actor = None
            try:
                # Mirror manual close payload by including a 'closed' list for compatibility
                AuditLog.objects.create(action='election_closed', actor=actor, detail={'election_id': election.id, 'closed': [election.id]})
            except Exception:
                # swallow to avoid affecting user-facing endpoints
                pass
        return True
    except Exception:
        return False
