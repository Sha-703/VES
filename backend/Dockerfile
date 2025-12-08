FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y build-essential libpq-dev --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching. When Render builds the
# Dockerfile from the `backend` directory the build context is that directory,
# so `requirements.txt` is expected to be at the context root.
COPY requirements.txt /app/requirements.txt

RUN pip install --upgrade pip
RUN pip install -r /app/requirements.txt

# Copy the rest of the backend source into the image. Using `COPY . /app`
# works whether the build context is the repo root or the `backend` folder.
COPY . /app

# Default Django settings module inside container
ENV DJANGO_SETTINGS_MODULE=elections_project.settings

# Ensure entrypoint is executable (entrypoint.sh should be in the context)
RUN chmod +x /app/entrypoint.sh || true

WORKDIR /app

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
