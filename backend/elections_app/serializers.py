"""Compatibility wrapper importing serializers from subpackages."""

from elections_app.institution.serializers import *
from elections_app.voter.serializers import *

__all__ = [
    # institution serializers
    'UserSerializer', 'InstitutionSerializer', 'InstitutionRegisterSerializer',
    'CandidateSerializer', 'ElectionSerializer', 'VoterSerializer', 'AuditLogSerializer',
    # voter serializers
    'VoterLoginSerializer', 'VoteSerializer',
]
