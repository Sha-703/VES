from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from elections_app.models import Vote


class VoteAdmin(admin.ModelAdmin):
    list_display = ('election', 'candidate', 'voter', 'timestamp')


# Register Vote only if not already registered by another module
try:
    admin.site.register(Vote, VoteAdmin)
except AlreadyRegistered:
    # already registered elsewhere (safe to ignore)
    pass
