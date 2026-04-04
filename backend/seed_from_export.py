#!/usr/bin/env python3
"""Seed the deployed database from the checked-in export."""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

from app_cloud import Alfajor, app, db


SEED_FILE = Path(os.environ.get("ALFAJORES_SEED_FILE", "/app/seeds/alfajores.json"))
IMAGES_DIR = Path(os.environ.get("ALFAJORES_IMAGES_DIR", "/app/images"))


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    return datetime.fromisoformat(value)


def upsert_alfajor(row: dict) -> None:
    alfajor = Alfajor.query.filter_by(page_number=row["page_number"]).first()
    if alfajor is None:
        alfajor = Alfajor(page_number=row["page_number"])
        db.session.add(alfajor)

    alfajor.marca = row["marca"]
    alfajor.sabor = row["sabor"]
    alfajor.pais = row["pais"]
    alfajor.color = row.get("color")
    alfajor.notas = row.get("notas")
    alfajor.image_filename = resolve_image_filename(row)
    alfajor.status = row.get("status", "categorized")

    date_added = parse_datetime(row.get("date_added"))
    if date_added is not None:
        alfajor.date_added = date_added

    date_modified = parse_datetime(row.get("date_modified"))
    if date_modified is not None:
        alfajor.date_modified = date_modified


def main() -> None:
    if not SEED_FILE.exists():
        raise FileNotFoundError(f"Seed file not found: {SEED_FILE}")

    payload = json.loads(SEED_FILE.read_text())
    rows = payload.get("alfajores", [])

    with app.app_context():
        db.create_all()

        existing_count = Alfajor.query.count()
        if existing_count > 0:
            print(f"Seed skipped: database already has {existing_count} alfajores")
            return

        for row in rows:
            upsert_alfajor(row)

        db.session.commit()
        print(f"Seeded {len(rows)} alfajores from {SEED_FILE}")


def resolve_image_filename(row: dict) -> str | None:
    page_number = row["page_number"]
    original = row.get("image_filename")

    if original and (IMAGES_DIR / original).exists():
        return original

    jpg_candidate = f"page_{page_number}_1.jpg"
    if (IMAGES_DIR / jpg_candidate).exists():
        return jpg_candidate

    return original


if __name__ == "__main__":
    main()
