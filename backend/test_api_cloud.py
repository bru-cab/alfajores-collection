#!/usr/bin/env python3
"""
API Tests for Cloud Alfajores Backend (Render parity)
Run with: python -m pytest test_api_cloud.py -v
"""

import pytest
import json
from app_cloud import app, db, Alfajor


@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
        yield client


def test_next_page_endpoint(client):
    # Empty DB: should return 1
    resp = client.get('/api/alfajores/next-page')
    assert resp.status_code == 200
    assert resp.get_json()['next_page'] == 1

    # Insert an item and re-check
    payload = {
        'page_number': 3,
        'marca': 'Test',
        'sabor': 'Test',
        'pais': 'AR'
    }
    client.post('/api/alfajores', data=json.dumps(payload), content_type='application/json')
    resp = client.get('/api/alfajores/next-page')
    assert resp.status_code == 200
    assert resp.get_json()['next_page'] == 4


def test_upsert_by_page_number(client):
    # Create
    payload = {
        'page_number': 10,
        'marca': 'Brand',
        'sabor': 'Flavor',
        'pais': 'AR'
    }
    resp = client.post('/api/alfajores', data=json.dumps(payload), content_type='application/json')
    assert resp.status_code == 200
    assert resp.get_json()['message'] in ['Alfajor saved successfully', 'Alfajor updated successfully']

    # Update same page_number (should not error)
    payload['sabor'] = 'Updated'
    resp = client.post('/api/alfajores', data=json.dumps(payload), content_type='application/json')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['message'] == 'Alfajor updated successfully'
    assert data['alfajor']['sabor'] == 'Updated'


