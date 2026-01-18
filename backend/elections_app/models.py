from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User


class Institution(models.Model):
    """Représente une organisation (école, entreprise, etc.) qui organise des élections."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='institution')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Indicateur de vérification email — l'institution doit vérifier son email avant l'accès complet
    is_verified = models.BooleanField(default=False)
    verification_sent_at = models.DateTimeField(null=True, blank=True)
    # Numéro de téléphone optionnel pour vérification SMS
    phone_number = models.CharField(max_length=32, null=True, blank=True)

    def __str__(self):
        return self.name


class Election(models.Model):
    """Représente un type d'élection (ex : "Président de classe 2025")."""
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='elections')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    # Type de scrutin choisi pour cette élection (par ex. majoritaire 1 tour / 2 tours)
    scrutin_type = models.CharField(
        max_length=50,
        choices=[('majoritaire_1tour', 'Scrutin majoritaire à un tour'), ('majoritaire_2tours', 'Scrutin majoritaire à deux tours')],
        default='majoritaire_1tour'
    )
    # Seuils pour scrutin majoritaire à deux tours (pourcentages)
    majority_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=50.00)
    advance_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    # Indique le tour actuellement actif (1 ou 2)
    current_round = models.IntegerField(default=1)
    # Gagnant finalisé (défini par l'institution après validation)
    finalized_winner = models.ForeignKey('Candidate', null=True, blank=True, on_delete=models.SET_NULL, related_name='won_elections')
    created_at = models.DateTimeField(auto_now_add=True)
    # Dates de début/fin optionnelles pour l'élection globale (pas pour les bulletins individuels)
    start = models.DateTimeField(null=True, blank=True)
    end = models.DateTimeField(null=True, blank=True)
    # Indicateur explicite pour enregistrer que l'élection est clôturée (défini par le planificateur/commande de gestion)
    closed = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.title} ({self.institution.name})"


# NOTE: The `Ballot` model has been removed in favor of election-level voting.
# If you need to keep per-round windows, consider adding explicit start/end
# fields on `Election` or a separate Round model.


class Candidate(models.Model):
    """Représente un candidat dans une élection."""
    # Les candidats sont maintenant liés directement à une Election (et non à un Bulletin)
    election = models.ForeignKey(Election, on_delete=models.CASCADE, related_name='candidates')
    name = models.CharField(max_length=200)
    bio = models.TextField(blank=True)
    # Photo du candidat (optionnelle)
    photo = models.ImageField(upload_to='candidates/', null=True, blank=True)
    position = models.CharField(max_length=100, blank=True)  # ex : "Président de classe"
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.election.title})"


class Voter(models.Model):
    """Représente un électeur éligible pour une institution."""
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='voters')
    identifier = models.CharField(max_length=200)  # ex : identifiant étudiant ou email
    name = models.CharField(max_length=200, blank=True)
    eligible = models.BooleanField(default=True)
    email_verified = models.BooleanField(default=False)
    import_file = models.ForeignKey('VoterImportFile', null=True, blank=True, on_delete=models.SET_NULL, related_name='voters')
    created_at = models.DateTimeField(auto_now_add=True)
    email_verification_token = models.CharField(max_length=64, blank=True, null=True)

    class Meta:
        unique_together = ('institution', 'identifier')  # Unicité par institution et identifiant

    def __str__(self):
        return f"{self.identifier} ({self.institution.name})"


class VoterImportFile(models.Model):
    """Stocke les fichiers d'import d'électeurs pour chaque institution afin qu'elles puissent gérer leurs imports."""
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
    """Enregistre un vote effectué par un électeur pour un candidat dans une élection."""
    # Les votes sont liés à l'Election parente. L'ancien modèle `Ballot` a été supprimé.
    election = models.ForeignKey(Election, null=True, blank=True, on_delete=models.SET_NULL, related_name='votes')
    # Un vote peut être exprimé sans candidat (vote nul/blanc). Autoriser NULL et
    # utiliser SET_NULL pour que la suppression d'un candidat ne supprime pas les votes historiques.
    candidate = models.ForeignKey(Candidate, null=True, blank=True, on_delete=models.SET_NULL, related_name='votes')
    voter = models.ForeignKey(Voter, on_delete=models.CASCADE, related_name='votes')
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('election', 'voter')  # garantir un seul vote par électeur et par élection

    def __str__(self):
        cand = self.candidate.name if self.candidate else 'Vote nul'
        if self.election:
            return f"{self.voter.identifier} voted for {cand} in election {self.election.title}"
        return f"{self.voter.identifier} voted for {cand}"


class AuditLog(models.Model):
    """Journalise toutes les actions pour la traçabilité/audit."""
    action = models.CharField(max_length=200)
    actor = models.CharField(max_length=200, blank=True, null=True)
    detail = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} @ {self.timestamp}"


class SMSVerification(models.Model):
    """Stocke les codes de vérification SMS pour les institutions."""
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='sms_verifications')
    code = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    attempts = models.IntegerField(default=0)

    def __str__(self):
        return f"SMSVerification for {self.institution_id} code={self.code}"
