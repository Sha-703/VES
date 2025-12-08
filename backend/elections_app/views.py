"""Top-level view wrapper: re-export institution and voter views."""

# Import and re-export institution views
from elections_app.institution.views import (
    institution_register,
    institution_login,
    InstitutionViewSet,
    ElectionViewSet,
    CandidateViewSet,
    VoterViewSet,
)

# Import and re-export voter views
from elections_app.voter.views import (
    voter_login,
    VoteViewSet,
)

__all__ = [
    'institution_register', 'institution_login', 'voter_login',
    'InstitutionViewSet', 'ElectionViewSet', 'CandidateViewSet', 'VoterViewSet', 'VoteViewSet'
]
