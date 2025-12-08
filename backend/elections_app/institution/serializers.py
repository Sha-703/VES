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

    class Meta:
        model = Candidate
        # expose the photo field so uploads can be set via API
        fields = ('id', 'name', 'bio', 'position', 'photo', 'vote_count', 'election', 'created_at')
        read_only_fields = ('created_at',)

    def get_vote_count(self, obj):
        return obj.votes.count()


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
        """Ensure start < end when both provided."""
        start = data.get('start')
        end = data.get('end')
        if start and end and start >= end:
            raise serializers.ValidationError({'end': 'La date de fin doit être postérieure à la date de début.'})
        return data

    def get_voted_voters_count(self, obj):
        try:
            # count distinct voters who have at least one vote for this election
            return Vote.objects.filter(election=obj).values('voter').distinct().count()
        except Exception:
            return 0

    def get_is_open(self, obj):
        try:
            now = timezone.now()
            # Consider election open when:
            # - both start and end are set and now is within the window, OR
            # - start is set and end is not set and now is after start (open until explicitly closed)
            # Note: treat `end` as exclusive so setting end == now marks the election closed.
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
        fields = ('id', 'identifier', 'name', 'eligible', 'created_at')
        read_only_fields = ('created_at',)


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ('id', 'action', 'actor', 'detail', 'timestamp')


class VoterImportFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = None
        # will be set dynamically below
        fields = ('id', 'file_url', 'uploaded_by', 'uploaded_at', 'total_rows', 'created', 'updated')

    def get_file_url(self, obj):
        try:
            return obj.file.url
        except Exception:
            return None

# import model lazily to avoid circular import issues
from elections_app.models import VoterImportFile
VoterImportFileSerializer.Meta.model = VoterImportFile
