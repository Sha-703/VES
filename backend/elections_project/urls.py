

import os
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.defaults import page_not_found
from django.http import HttpResponse, FileResponse
from django.views.static import serve as static_serve


from django.shortcuts import redirect
from django.http import HttpResponse

def custom_404(request, exception=None):
        # Page 404 personnalisée, ne révèle pas l'URL demandée
        html = """
        <html style='background:#f8fafc;'>
            <head><title>Page non trouvée</title></head>
            <body style='font-family:sans-serif;text-align:center;padding:60px;'>
                <h1 style='font-size:3em;color:#334155;'>404</h1>
                <p style='font-size:1.3em;color:#64748b;'>La page demandée n'existe pas.</p>
                <p style='color:#94a3b8;'>Si vous pensez qu'il s'agit d'une erreur, contactez l'administrateur.</p>
                <a href='/' style='color:#2563eb;text-decoration:underline;font-size:1.1em;'>Retour à l'accueil</a>
            </body>
        </html>
        """
        return HttpResponse(html, status=404)


# Vue stylisée pour la page d'accueil
def custom_home(request):
        frontend_url = 'https://vote-electronique-sur.onrender.com'
        html = f"""
        <html style='background:#f8fafc;'>
            <head>
                <title>Bienvenue sur VES</title>
                <meta name='viewport' content='width=device-width, initial-scale=1'>
                <style>
                    body {{ font-family: 'Segoe UI', Arial, sans-serif; text-align: center; padding: 60px; background: #f8fafc; }}
                    h1 {{ font-size: 3em; color: #2563eb; margin-bottom: 0.2em; }}
                    p {{ font-size: 1.3em; color: #64748b; margin-bottom: 1.5em; }}
                    .btn {{ display: inline-block; padding: 12px 28px; font-size: 1.1em; color: #fff; background: #2563eb; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 8px #2563eb22; transition: background 0.2s; }}
                    .btn:hover {{ background: #1d4ed8; }}
                </style>
            </head>
            <body>
                <h1>Bienvenue sur VES</h1>
                <p>Vote Électronique Sûr<br>Plateforme sécurisée pour la gestion des élections.</p>
                <a href='{frontend_url}' class='btn'>Accéder à l&#39;interface</a>
            </body>
        </html>
        """
        return HttpResponse(html)


def serve_media(request, path):
    """Serve media files even in production (DEBUG=False) and development."""
    from pathlib import Path
    from django.http import Http404
    import mimetypes
    import logging
    
    logger = logging.getLogger(__name__)
    
    logger.debug(f"[serve_media] Requested path: {path}")
    logger.debug(f"[serve_media] MEDIA_ROOT: {settings.MEDIA_ROOT}")
    
    file_path = Path(settings.MEDIA_ROOT) / path
    
    # Security check: prevent directory traversal attacks
    try:
        file_path = file_path.resolve()
        media_root_resolved = Path(settings.MEDIA_ROOT).resolve()
        logger.debug(f"[serve_media] Resolved path: {file_path}")
        logger.debug(f"[serve_media] Media root resolved: {media_root_resolved}")
        
        if not str(file_path).startswith(str(media_root_resolved)):
            logger.warning(f"[serve_media] Security check failed: {file_path} is outside {media_root_resolved}")
            raise Http404("File not found")
    except Http404:
        raise
    except Exception as e:
        logger.error(f"[serve_media] Security check error: {e}")
        raise Http404(f"File not found: {e}")
    
    # Check if file exists
    if not file_path.exists():
        logger.warning(f"[serve_media] File not found: {file_path}")
        raise Http404(f"File not found at {file_path}")
    
    if not file_path.is_file():
        logger.warning(f"[serve_media] Not a file: {file_path}")
        raise Http404(f"Not a file: {file_path}")
    
    logger.debug(f"[serve_media] Serving file: {file_path}")
    
    # Determine MIME type
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if mime_type is None:
        mime_type = 'application/octet-stream'
    
    logger.debug(f"[serve_media] MIME type: {mime_type}")
    
    # Serve the file
    try:
        return FileResponse(
            file_path.open('rb'),
            content_type=mime_type,
            as_attachment=False
        )
    except Exception as e:
        logger.error(f"[serve_media] Error serving file: {e}")
        raise Http404(f"Error serving file: {e}")


urlpatterns = [
    path('', custom_home),
    path('admin/', admin.site.urls),
    path('api/', include('elections_app.urls')),
    # Serve media files - this route is always active (works in both DEBUG=True and DEBUG=False)
    re_path(r'^media/(?P<path>.*)$', serve_media),
]

# For development (DEBUG=True), also add the standard static() serving
# This provides a fallback and ensures compatibility
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

handler404 = 'elections_project.urls.custom_404'
