from django.contrib import admin
from django.utils.html import format_html
from elections_app.models import Institution, Election, Candidate, Voter

 # Import-export pour l'import/export dans l'admin
from import_export import resources
from import_export.admin import ImportExportModelAdmin


class VoterResource(resources.ModelResource):
    class Meta:
        model = Voter
        # institution doit être fournie comme PK (id institution) dans le fichier d'import
        fields = ('institution', 'identifier', 'name', 'eligible')
        import_id_fields = ('institution', 'identifier')


@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at')



@admin.register(Election)
class ElectionAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'institution', 'scrutin_type', 'created_at')



@admin.register(Candidate)
class CandidateAdmin(admin.ModelAdmin):
    list_display = ('name', 'election', 'position', 'photo_tag', 'created_at')
    readonly_fields = ('photo_tag',)

    def photo_tag(self, obj):
        if obj.photo:
            return format_html('<img src="{}" style="height:48px;border-radius:4px;"/>', obj.photo.url)
        return ''

    photo_tag.short_description = 'Photo'


@admin.register(Voter)
class VoterAdmin(ImportExportModelAdmin):
    resource_class = VoterResource
    list_display = ('identifier', 'name', 'institution', 'eligible', 'created_at')
    list_filter = ('eligible', 'institution')
    search_fields = ('identifier', 'name')
