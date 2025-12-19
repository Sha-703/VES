#!/usr/bin/env bash
set -e

PORT=${PORT:-8000}

echo "Running Django migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting Gunicorn on port ${PORT}..."
exec gunicorn elections_project.wsgi:application --bind 0.0.0.0:${PORT}
