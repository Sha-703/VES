# VES — Vote Électronique Sûr

Project: VES (Vote Électronique Sûr)

Stack:
- Backend: Django + Django REST Framework
- Frontend: React (Vite)

But: this scaffold is minimal. Follow "How to run" below.

How to run (dev):
1. Backend
   - cd backend
   - python -m venv .venv
   - .\.venv\Scripts\Activate.ps1
   - pip install -r requirements.txt
   - python manage.py migrate
   - python manage.py createsuperuser
   - python manage.py runserver

2. Frontend
   - cd frontend
   - npm install
   - npm run dev

This project (VES) provides simple models: Election, Candidate, Voter, Vote and basic API endpoints.
