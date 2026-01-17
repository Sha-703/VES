from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from elections_app.models import Vote


class VoteAdmin(admin.ModelAdmin):
    list_display = ('election', 'candidate', 'voter', 'timestamp')


 # Enregistrer Vote uniquement si non déjà enregistré par un autre module
try:
    admin.site.register(Vote, VoteAdmin)
except AlreadyRegistered:
    # déjà enregistré ailleurs (on peut ignorer)
    pass
