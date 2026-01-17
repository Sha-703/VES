import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-change-me')
# DEBUG peut être défini via une variable d'environnement (par exemple 'True'/'False') pour les déploiements
DEBUG = os.environ.get('DEBUG', 'True').lower() in ('1', 'true', 'yes')
# Permet de configurer les hôtes autorisés via une variable d'environnement (séparés par des virgules). Par défaut '*'.
_allowed_hosts = os.environ.get('ALLOWED_HOSTS', '*')
ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts.split(',') if h.strip()]

# Pendant le développement local, les emails sont affichés dans la console pour rendre les liens de vérification visibles
# Configuration des emails
# Ordre de priorité :
# 1. Si la variable d'environnement EMAIL_BACKEND est définie, l'utiliser.
# 2. Si DEBUG=True, utiliser le backend console pour le développement local.
# 3. Sinon, utiliser le backend SMTP et lire les paramètres SMTP depuis les variables d'environnement.
if os.environ.get('EMAIL_BACKEND'):
    EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND')
elif DEBUG:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# Adresse d'expédition par défaut
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'no-reply@ves')

# Paramètres SMTP (utilisés lorsque EMAIL_BACKEND est SMTP)
EMAIL_HOST = os.environ.get('EMAIL_HOST', '')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587)) if os.environ.get('EMAIL_PORT') else 587
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() in ('1','true','yes')
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')

# Configuration Twilio (à définir comme variables d'environnement en production)
# Ne jamais enregistrer de secrets dans le dépôt. Utilisez votre shell ou un gestionnaire de secrets.
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_FROM_NUMBER = os.environ.get('TWILIO_FROM_NUMBER', '')
TWILIO_VERIFY_SERVICE_SID = os.environ.get('TWILIO_VERIFY_SERVICE_SID', '')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'import_export',
    'elections_app',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'elections_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'elections_project.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = 'fr'
# Kinshasa local time zone (République démocratique du Congo)
# See the IANA tz database name: Africa/Kinshasa
TIME_ZONE = 'Africa/Kinshasa'
USE_I18N = True
USE_TZ = True
STATIC_URL = '/static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
# Directory where `collectstatic` will collect static files for production.
# In Docker/Render we'll default to /app/static via environment or use a repo-local folder.
STATIC_ROOT = Path(os.environ.get('STATIC_ROOT', BASE_DIR / 'staticfiles'))

# Use WhiteNoise for serving static files in production.
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Allow local frontend dev
# Restrict CORS origins in production. During local development we allow all origins
# to make it easy to run the frontend with Vite (dev server) and the backend locally.
# In production, set the environment variable `CORS_ALLOWED_ORIGINS` to a comma-separated
# list of allowed origins (for example: `https://vote-electronique-sur.onrender.com`).
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    # Read allowed origins from env var or default to the known frontend origin
    _cors_origins = os.environ.get('CORS_ALLOWED_ORIGINS', 'https://vote-electronique-sur.onrender.com')
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins.split(',') if o.strip()]
# Allow sending cookies if needed (disabled by default). Configure via env var.
CORS_ALLOW_CREDENTIALS = os.environ.get('CORS_ALLOW_CREDENTIALS', 'False').lower() in ('1', 'true', 'yes')
# Configure CSRF trusted origins for cross-site protection (comma-separated)
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.environ.get('CSRF_TRUSTED_ORIGINS', 'https://vote-electronique-sur.onrender.com').split(',') if o.strip()]

# REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
