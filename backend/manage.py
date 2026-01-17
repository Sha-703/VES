#!/usr/bin/env python
# Fichier principal pour la gestion du projet Django
import os
import sys

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'elections_project.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError("Impossible d'importer Django") from exc
    execute_from_command_line(sys.argv)
