from rest_framework import routers
from django.urls import path, include
from elections_app.views import (
    InstitutionViewSet, ElectionViewSet, CandidateViewSet, 
    VoterViewSet, VoteViewSet,
    institution_register, institution_login, voter_login,
)
# Verification-related views removed from URL config (verification disabled)

router = routers.DefaultRouter()
router.register(r'institutions', InstitutionViewSet, basename='institution')
router.register(r'elections', ElectionViewSet, basename='election')
# Ballot endpoints removed; voting is now election-level
router.register(r'candidates', CandidateViewSet, basename='candidate')
router.register(r'voters', VoterViewSet, basename='voter')
router.register(r'votes', VoteViewSet, basename='vote')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/institution/register/', institution_register, name='institution_register'),
    path('auth/institution/login/', institution_login, name='institution_login'),
    path('auth/voter/login/', voter_login, name='voter_login'),
]
