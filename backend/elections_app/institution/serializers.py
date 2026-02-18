from rest_framework import serializers
from elections_app.models import Institution, Election, Candidate, Voter, AuditLog, Vote
from django.db.models import Q
from django.contrib.auth.models import User
from rest_framework import serializers
from django.utils import timezone


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email')


class InstitutionSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Institution
        fields = ('id', 'user', 'name', 'description', 'created_at', 'is_verified')
        read_only_fields = ('created_at',)


class InstitutionRegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    institution_name = serializers.CharField(max_length=200)
    institution_description = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already exists.")
        return value


class CandidateSerializer(serializers.ModelSerializer):
    vote_count = serializers.SerializerMethodField()
    photo = serializers.ImageField(required=False, allow_null=True)  # Permet l'upload ET la lecture
    
    class Meta:
        model = Candidate
        # Exposer le champ photo pour permettre l'upload via l'API
        fields = ('id', 'name', 'bio', 'position', 'photo', 'vote_count', 'election', 'created_at')
        read_only_fields = ('created_at',)

    def get_photo_url(self, obj):
        """Retourne l'URL absolue de la photo une fois retournée."""
        if not obj.photo:
            return None
        request = self.context.get('request')
        if request:
            # Retourner l'URL absolue
            return request.build_absolute_uri(obj.photo.url) if obj.photo else None
        # Fallback : retourner l'URL relative si pas de contexte
        return obj.photo.url if obj.photo else None

    def get_vote_count(self, obj):
        return obj.votes.count()
    
    def to_representation(self, instance):
        """Override to return absolute URL for photo in responses."""
        ret = super().to_representation(instance)
        # Remplacer l'URL relative de photo par l'URL absolue
        ret['photo'] = self.get_photo_url(instance)
        return ret


# Ballot model removed; vote-related per-election fields are computed on Election


class ElectionSerializer(serializers.ModelSerializer):
    candidates = CandidateSerializer(many=True, read_only=True)
    voted_voters_count = serializers.SerializerMethodField()
    is_open = serializers.SerializerMethodField()
    majority_threshold = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=False, required=False, min_value=0, max_value=100)
    advance_threshold = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=False, required=False, min_value=0, max_value=100)
    current_round = serializers.IntegerField(read_only=True)
    finalized_winner = CandidateSerializer(read_only=True)
    start = serializers.DateTimeField(required=False, allow_null=True)
    end = serializers.DateTimeField(required=False, allow_null=True)

    class Meta:
        model = Election
        fields = ('id', 'title', 'description', 'scrutin_type', 'majority_threshold', 'advance_threshold', 'start', 'end', 'current_round', 'finalized_winner', 'candidates', 'voted_voters_count', 'is_open', 'created_at')
        read_only_fields = ('created_at',)

    def validate(self, data):
        """Vérifie que la date de début est antérieure à la date de fin si les deux sont fournies."""
        start = data.get('start')
        end = data.get('end')
        if start and end and start >= end:
            raise serializers.ValidationError({'end': 'La date de fin doit être postérieure à la date de début.'})
        return data

    def to_representation(self, instance):
        """Override to ensure context is passed to nested candidate serializers."""
        ret = super().to_representation(instance)
        # Explicitly pass context to candidates serializer (DRF doesn't do this automatically)
        candidates_serializer = CandidateSerializer(
            instance.candidates.all(),
            many=True,
            context=self.context
        )
        ret['candidates'] = candidates_serializer.data
        # Also pass context to finalized_winner
        if instance.finalized_winner:
            winner_serializer = CandidateSerializer(instance.finalized_winner, context=self.context)
            ret['finalized_winner'] = winner_serializer.data
        return ret

    def get_voted_voters_count(self, obj):
        try:
            # compter les électeurs distincts ayant au moins un vote pour cette élection
            return Vote.objects.filter(election=obj).values('voter').distinct().count()
        except Exception:
            return 0

    def get_is_open(self, obj):
        try:
            now = timezone.now()
            # Considérer l'élection comme ouverte lorsque :
            # - start et end sont définis et maintenant est dans la fenêtre
            # - start est défini et end non, et maintenant est après start (ouverte jusqu'à fermeture explicite)
            # Remarque : traiter `end` comme exclusif, donc end == maintenant ferme l'élection
            if obj.start and obj.end:
                return obj.start <= now < obj.end
            if obj.start and not obj.end:
                return obj.start <= now
            # If start not set, treat as closed by default
            return False
        except Exception:
            return False


class VoterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Voter
        fields = ('id', 'identifier', 'name', 'eligible', 'election', 'created_at')
        read_only_fields = ('created_at',)


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ('id', 'action', 'actor', 'detail', 'timestamp')


class VoterImportFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = None
        # sera défini dynamiquement ci-dessous
        fields = ('id', 'file_url', 'uploaded_by', 'uploaded_at', 'total_rows', 'created', 'updated')

    def get_file_url(self, obj):
        try:
            return obj.file.url
        except Exception:
            return None

# import model lazily to avoid circular import issues
from elections_app.models import VoterImportFile
VoterImportFileSerializer.Meta.model = VoterImportFile
