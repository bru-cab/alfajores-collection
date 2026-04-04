#!/bin/sh
set -eu

export DATABASE_URL="${DATABASE_URL:-sqlite:////data/alfajores.db}"

python /app/seed_from_export.py

exec gunicorn \
  --bind 0.0.0.0:8080 \
  --workers 1 \
  --threads 4 \
  --timeout 120 \
  app_cloud:app
