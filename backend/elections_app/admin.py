from django.contrib import admin
from elections_app.models import AuditLog

 # Importer les modules admin des sous-paquets pour que leurs enregistrements s'exécutent au démarrage et que tous les modèles
 # soient enregistrés dans le site d'administration (et donc accessibles depuis l'index admin).
try:
    # import forcé pour enregistrer les modèles définis dans les modules admin institution et voter
    import elections_app.institution.admin  # noqa: F401
except Exception:
    # Les erreurs d'import doivent être visibles dans les logs ; continuer à enregistrer AuditLog
    pass

try:
    import elections_app.voter.admin  # noqa: F401
except Exception:
    pass


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'actor', 'timestamp')
