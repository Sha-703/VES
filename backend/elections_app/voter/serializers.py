from rest_framework import serializers
from elections_app.models import Vote


class VoterLoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    # name is now optional to allow authentication by identifier + institution only
    name = serializers.CharField(required=False, allow_blank=True)


class VoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vote
        fields = ('id', 'election', 'candidate', 'voter', 'timestamp')
        read_only_fields = ('id', 'voter', 'timestamp')
