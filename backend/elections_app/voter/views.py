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
    """Login a voter via identifier + name."""
    serializer = VoterLoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    identifier = serializer.validated_data['identifier']
    institution_id = request.data.get('institution_id')

    if not institution_id:
        return Response({'detail': 'Missing institution_id.'}, status=status.HTTP_400_BAD_REQUEST)

    # Authenticate voters by institution + identifier only. This allows
    # removing the frontend 'name' field while preserving unique lookup.
    voter = get_object_or_404(Voter, institution_id=institution_id, identifier=identifier)

    if not voter.eligible:
        return Response({'detail': 'Voter not eligible.'}, status=status.HTTP_403_FORBIDDEN)

    return Response({'voter_id': voter.id, 'identifier': voter.identifier, 'name': voter.name}, status=status.HTTP_200_OK)


class VoteViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'])
    def cast_vote(self, request):
        candidate_id = request.data.get('candidate_id')
        voter_id = request.data.get('voter_id')

        # Require voter_id and election_id (ballots removed)
        election_id = request.data.get('election_id')
        if not voter_id or not election_id:
            return Response({'detail': 'Missing required fields: voter_id and election_id are required (ballots removed).'}, status=status.HTTP_400_BAD_REQUEST)

        election = get_object_or_404(Election, id=election_id)

        # If the election's end time has already been reached, ensure it's auto-closed
        if auto_close_election(election):
            return Response({'detail': 'Voting window closed or not started.'}, status=status.HTTP_400_BAD_REQUEST)

        voter = get_object_or_404(Voter, id=voter_id)

        # Determine candidate: support a 'null' vote sent by the frontend
        # A null vote is NOT a candidate — record Vote.candidate = None.
        candidate = None
        if candidate_id is None or str(candidate_id).strip().lower() in ['', 'null', 'none']:
            candidate = None
        else:
            # Candidate model is linked to Election, ensure candidate belongs to this election.
            candidate = get_object_or_404(Candidate, id=candidate_id, election=election)

        now = timezone.now()

        # Use the parent Election window (start/end) to determine whether voting is allowed for this election.
        # Harmonized logic: use same rules as ElectionSerializer.get_is_open
        # - If start and end present: open when start <= now < end (end exclusive)
        # - If start present and no end: open when start <= now
        # - Otherwise (including end-only): treat as closed
        start = election.start
        end = election.end
        # Normalize naive datetimes to aware using current timezone
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
            # end-only or no window -> closed
            return Response({'detail': 'Voting window closed or not started.'}, status=status.HTTP_400_BAD_REQUEST)

        # Prevent double voting per election
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
        """Check whether a voter has already voted in a given election.

        Expects query params: `voter_id` and `election_id`.
        Returns JSON: { voted: true/false }
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
