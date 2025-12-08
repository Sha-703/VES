from django.contrib import admin
from elections_app.models import AuditLog

# Import subpackage admin modules so their registrations run at startup and all models
# are registered in the admin site (makes them clickable from the admin index).
try:
    # force import to register models defined in institution and voter admin modules
    import elections_app.institution.admin  # noqa: F401
except Exception:
    # Import errors should be visible in logs; continue to register AuditLog
    pass

try:
    import elections_app.voter.admin  # noqa: F401
except Exception:
    pass


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'actor', 'timestamp')
