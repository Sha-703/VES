

import os
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.defaults import page_not_found
from django.http import HttpResponse


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


urlpatterns = [
    path('', custom_home),
    path('admin/', admin.site.urls),
    path('api/', include('elections_app.urls')),
]

# Servir les fichiers médias (photos, candidats, etc.) en développement et production
# En production avec Render/gunicorn, WhiteNoise gère également les fichiers médias
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

handler404 = 'elections_project.urls.custom_404'
