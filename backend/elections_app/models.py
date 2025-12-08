from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User


class Institution(models.Model):
    """Represents an organization (school, company, etc.) that runs elections."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='institution')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Email verification flag — institutions must verify their email before full access
    is_verified = models.BooleanField(default=False)
    verification_sent_at = models.DateTimeField(null=True, blank=True)
    # Optional phone number for SMS verification
    phone_number = models.CharField(max_length=32, null=True, blank=True)

    def __str__(self):
        return self.name


class Election(models.Model):
    """Represents an election type (e.g., "Class President 2025")."""
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='elections')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    # Type de scrutin choisi pour cette élection (par ex. majoritaire 1 tour / 2 tours)
    scrutin_type = models.CharField(
        max_length=50,
        choices=[('majoritaire_1tour', 'Scrutin majoritaire à un tour'), ('majoritaire_2tours', 'Scrutin majoritaire à deux tours')],
        default='majoritaire_1tour'
    )
    # Thresholds for two-round majoritarian elections (percentages)
    majority_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=50.00)
    advance_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    # Track which round is currently active (1 or 2)
    current_round = models.IntegerField(default=1)
    # Finalized winner (set by institution after validation)
    finalized_winner = models.ForeignKey('Candidate', null=True, blank=True, on_delete=models.SET_NULL, related_name='won_elections')
    created_at = models.DateTimeField(auto_now_add=True)
    # Optional start/end datetimes for the overall election (not individual ballots)
    start = models.DateTimeField(null=True, blank=True)
    end = models.DateTimeField(null=True, blank=True)
    # Explicit closed flag to record that the election has been closed (set by scheduler/management command)
    closed = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.title} ({self.institution.name})"


# NOTE: The `Ballot` model has been removed in favor of election-level voting.
# If you need to keep per-round windows, consider adding explicit start/end
# fields on `Election` or a separate Round model.


class Candidate(models.Model):
    """Represents a candidate in a ballot."""
    # Candidates are now linked directly to an Election (not to a Ballot)
    election = models.ForeignKey(Election, on_delete=models.CASCADE, related_name='candidates')
    name = models.CharField(max_length=200)
    bio = models.TextField(blank=True)
    # optional photo upload for candidate
    photo = models.ImageField(upload_to='candidates/', null=True, blank=True)
    position = models.CharField(max_length=100, blank=True)  # e.g., "Class President"
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.election.title})"


class Voter(models.Model):
    """Represents an eligible voter for an institution."""
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='voters')
    identifier = models.CharField(max_length=200)  # e.g., student id or email
    name = models.CharField(max_length=200, blank=True)
    eligible = models.BooleanField(default=True)
    import_file = models.ForeignKey('VoterImportFile', null=True, blank=True, on_delete=models.SET_NULL, related_name='voters')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('institution', 'identifier')

    def __str__(self):
        return f"{self.identifier} ({self.institution.name})"


class VoterImportFile(models.Model):
    """Stores uploaded voter import files per institution so institutions can manage their uploads."""
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='import_files')
    file = models.FileField(upload_to='voter_imports/')
    uploaded_by = models.CharField(max_length=200, blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    total_rows = models.IntegerField(null=True, blank=True)
    created = models.IntegerField(null=True, blank=True)
    updated = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"Import {self.id} for {self.institution.name} @ {self.uploaded_at}"


class Vote(models.Model):
    """Records a vote cast by a voter for a candidate in a ballot."""
    # Votes are linked to the parent Election. The old `Ballot` model has been removed.
    election = models.ForeignKey(Election, null=True, blank=True, on_delete=models.SET_NULL, related_name='votes')
    # A vote may be cast for no candidate (null / blank vote). Allow NULL and
    # use SET_NULL so deleting a candidate doesn't delete historical votes.
    candidate = models.ForeignKey(Candidate, null=True, blank=True, on_delete=models.SET_NULL, related_name='votes')
    voter = models.ForeignKey(Voter, on_delete=models.CASCADE, related_name='votes')
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('election', 'voter')  # enforce one vote per voter per election

    def __str__(self):
        cand = self.candidate.name if self.candidate else 'Vote nul'
        if self.election:
            return f"{self.voter.identifier} voted for {cand} in election {self.election.title}"
        return f"{self.voter.identifier} voted for {cand}"


class AuditLog(models.Model):
    """Logs all actions for audit trail."""
    action = models.CharField(max_length=200)
    actor = models.CharField(max_length=200, blank=True, null=True)
    detail = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} @ {self.timestamp}"


class SMSVerification(models.Model):
    """Stores SMS verification codes for institutions."""
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='sms_verifications')
    code = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    attempts = models.IntegerField(default=0)

    def __str__(self):
        return f"SMSVerification for {self.institution_id} code={self.code}"
