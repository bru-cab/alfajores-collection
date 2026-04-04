# Smash & Sweet Manager

Web tools for cataloging alfajores and burgers, uploading source PDFs, and browsing both collections through an admin UI plus a public search/gallery.

## Features

- Admin interface for creating, editing, and deleting alfajores and burgers
- Public search page with filters for both alfajores and burgers
- PDF upload and page-image extraction for reference images
- Statistics and export endpoints
- Local SQLite workflow, plus a deploy-ready backend variant

## Stack

- Python, Flask, SQLAlchemy, Marshmallow
- HTML, CSS, and vanilla JavaScript
- SQLite for local development
- Optional Fly deployment files under `backend/` and [`fly.toml`](/Users/bruno/Documents/personal/alfajores/fly.toml)

## Quick Start

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
cd backend
python init_db.py
python app.py
```

The local backend runs on `http://localhost:5000`, and the checked-in frontend files can point at it directly.

If you want the all-in-one helper script instead:

```bash
./start.sh
```

## Main Files

- [`backend/app.py`](/Users/bruno/Documents/personal/alfajores/backend/app.py): local Flask backend
- [`backend/app_cloud.py`](/Users/bruno/Documents/personal/alfajores/backend/app_cloud.py): deploy-oriented backend entrypoint
- [`index.html`](/Users/bruno/Documents/personal/alfajores/index.html): admin/categorization UI
- [`search.html`](/Users/bruno/Documents/personal/alfajores/search.html): public search/gallery UI
- [`script.js`](/Users/bruno/Documents/personal/alfajores/script.js): frontend behavior

## API Highlights

- `GET /api/health`
- `GET /api/alfajores`
- `POST /api/alfajores`
- `PUT /api/alfajores/<id>`
- `DELETE /api/alfajores/<id>`
- `GET /api/stats`
- `GET /api/export`

More endpoint detail lives in [`docs/api_wiki.md`](/Users/bruno/Documents/personal/alfajores/docs/api_wiki.md).

## Deployment Notes

- [`DEPLOY.md`](/Users/bruno/Documents/personal/alfajores/DEPLOY.md) covers static frontend deployment plus pointing it at a hosted backend.
- [`deploy/README.md`](/Users/bruno/Documents/personal/alfajores/deploy/README.md) has packaged-search deployment notes.
- [`fly.toml`](/Users/bruno/Documents/personal/alfajores/fly.toml) and [`backend/Dockerfile`](/Users/bruno/Documents/personal/alfajores/backend/Dockerfile) remain for Fly-based hosting.
