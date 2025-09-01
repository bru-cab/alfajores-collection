#!/usr/bin/env python3
"""
API Tests for Alfajores Collection Backend
Run with: python -m pytest test_api.py -v
"""

import pytest
import json
import tempfile
import os
from app import app, db, Alfajor, PDFDocument

@pytest.fixture
def client():
    """Create a test client"""
    # Create a temporary database
    db_fd, app.config['DATABASE'] = tempfile.mkstemp()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
        yield client
    
    os.close(db_fd)

@pytest.fixture
def sample_alfajor_data():
    """Sample alfajor data for testing"""
    return {
        "page_number": 1,
        "marca": "Havanna",
        "sabor": "Dulce de leche",
        "pais": "Argentina",
        "tipo": "Premium",
        "tamaño": "Grande",
        "cobertura": "Chocolate",
        "año": 2023,
        "rareza": "Común",
        "notas": "Alfajor clásico argentino"
    }

class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_health_check(self, client):
        """Test health check returns 200"""
        response = client.get('/api/health')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'healthy'
        assert 'message' in data

class TestAlfajorEndpoints:
    """Test alfajor CRUD endpoints"""
    
    def test_create_alfajor(self, client, sample_alfajor_data):
        """Test creating a new alfajor"""
        response = client.post('/api/alfajores', 
                              data=json.dumps(sample_alfajor_data),
                              content_type='application/json')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['message'] == 'Alfajor saved successfully'
        assert data['alfajor']['marca'] == 'Havanna'
        assert data['alfajor']['page_number'] == 1
    
    def test_get_alfajores(self, client, sample_alfajor_data):
        """Test getting all alfajores"""
        # First create an alfajor
        client.post('/api/alfajores', 
                   data=json.dumps(sample_alfajor_data),
                   content_type='application/json')
        
        # Then get all alfajores
        response = client.get('/api/alfajores')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert 'alfajores' in data
        assert len(data['alfajores']) == 1
        assert data['total'] == 1
    
    def test_get_alfajor_by_page(self, client, sample_alfajor_data):
        """Test getting alfajor by page number"""
        # First create an alfajor
        client.post('/api/alfajores', 
                   data=json.dumps(sample_alfajor_data),
                   content_type='application/json')
        
        # Then get it by page number
        response = client.get('/api/alfajores/1')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['marca'] == 'Havanna'
        assert data['page_number'] == 1
    
    def test_get_nonexistent_alfajor(self, client):
        """Test getting non-existent alfajor returns 404"""
        response = client.get('/api/alfajores/999')
        
        assert response.status_code == 404
        
        data = json.loads(response.data)
        assert data['error'] == 'Alfajor not found'
    
    def test_update_alfajor(self, client, sample_alfajor_data):
        """Test updating an existing alfajor"""
        # First create an alfajor
        response = client.post('/api/alfajores', 
                              data=json.dumps(sample_alfajor_data),
                              content_type='application/json')
        
        alfajor_id = json.loads(response.data)['alfajor']['id']
        
        # Update the alfajor
        updated_data = sample_alfajor_data.copy()
        updated_data['sabor'] = 'Chocolate'
        updated_data['notas'] = 'Sabor actualizado'
        
        response = client.put(f'/api/alfajores/{alfajor_id}',
                             data=json.dumps(updated_data),
                             content_type='application/json')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['alfajor']['sabor'] == 'Chocolate'
        assert data['alfajor']['notas'] == 'Sabor actualizado'
    
    def test_delete_alfajor(self, client, sample_alfajor_data):
        """Test deleting an alfajor"""
        # First create an alfajor
        response = client.post('/api/alfajores', 
                              data=json.dumps(sample_alfajor_data),
                              content_type='application/json')
        
        alfajor_id = json.loads(response.data)['alfajor']['id']
        
        # Delete the alfajor
        response = client.delete(f'/api/alfajores/{alfajor_id}')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['message'] == 'Alfajor deleted successfully'
        
        # Verify it's gone
        response = client.get(f'/api/alfajores/{alfajor_id}')
        assert response.status_code == 404

class TestStatsEndpoint:
    """Test statistics endpoint"""
    
    def test_empty_stats(self, client):
        """Test stats with no data"""
        response = client.get('/api/stats')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['total_alfajores'] == 0
        assert data['by_marca'] == []
        assert data['by_pais'] == []
    
    def test_stats_with_data(self, client):
        """Test stats with sample data"""
        # Create multiple alfajores
        alfajores = [
            {
                "page_number": 1,
                "marca": "Havanna",
                "sabor": "Dulce de leche",
                "pais": "Argentina"
            },
            {
                "page_number": 2,
                "marca": "Havanna",
                "sabor": "Chocolate",
                "pais": "Argentina"
            },
            {
                "page_number": 3,
                "marca": "Cachafaz",
                "sabor": "Dulce de leche",
                "pais": "Argentina"
            }
        ]
        
        for alfajor in alfajores:
            client.post('/api/alfajores',
                       data=json.dumps(alfajor),
                       content_type='application/json')
        
        # Get stats
        response = client.get('/api/stats')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['total_alfajores'] == 3
        
        # Check marca stats
        marca_stats = {item['name']: item['count'] for item in data['by_marca']}
        assert marca_stats['Havanna'] == 2
        assert marca_stats['Cachafaz'] == 1
        
        # Check pais stats
        pais_stats = {item['name']: item['count'] for item in data['by_pais']}
        assert pais_stats['Argentina'] == 3

class TestExportImportEndpoints:
    """Test export and import functionality"""
    
    def test_export_empty(self, client):
        """Test export with no data"""
        response = client.get('/api/export')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['total_count'] == 0
        assert data['alfajores'] == []
        assert 'export_date' in data
    
    def test_export_with_data(self, client, sample_alfajor_data):
        """Test export with data"""
        # Create an alfajor
        client.post('/api/alfajores',
                   data=json.dumps(sample_alfajor_data),
                   content_type='application/json')
        
        # Export data
        response = client.get('/api/export')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['total_count'] == 1
        assert len(data['alfajores']) == 1
        assert data['alfajores'][0]['marca'] == 'Havanna'
    
    def test_import_data(self, client):
        """Test importing data"""
        import_data = {
            "alfajores": [
                {
                    "page_number": 1,
                    "marca": "Imported Brand",
                    "sabor": "Imported Flavor",
                    "pais": "Imported Country"
                },
                {
                    "page_number": 2,
                    "marca": "Another Brand",
                    "sabor": "Another Flavor",
                    "pais": "Another Country"
                }
            ]
        }
        
        response = client.post('/api/import',
                              data=json.dumps(import_data),
                              content_type='application/json')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['imported_count'] == 2
        
        # Verify data was imported
        response = client.get('/api/alfajores')
        data = json.loads(response.data)
        assert data['total'] == 2
    
    def test_import_invalid_data(self, client):
        """Test importing invalid data"""
        invalid_data = {"invalid": "data"}
        
        response = client.post('/api/import',
                              data=json.dumps(invalid_data),
                              content_type='application/json')
        
        assert response.status_code == 400
        
        data = json.loads(response.data)
        assert 'error' in data

class TestFilteringAndPagination:
    """Test filtering and pagination"""
    
    def test_filter_by_marca(self, client):
        """Test filtering alfajores by marca"""
        # Create test data
        alfajores = [
            {"page_number": 1, "marca": "Havanna", "sabor": "Test", "pais": "Argentina"},
            {"page_number": 2, "marca": "Cachafaz", "sabor": "Test", "pais": "Argentina"},
            {"page_number": 3, "marca": "Havanna", "sabor": "Test", "pais": "Argentina"}
        ]
        
        for alfajor in alfajores:
            client.post('/api/alfajores',
                       data=json.dumps(alfajor),
                       content_type='application/json')
        
        # Filter by marca
        response = client.get('/api/alfajores?marca=Havanna')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['total'] == 2
        assert all(a['marca'] == 'Havanna' for a in data['alfajores'])
    
    def test_pagination(self, client):
        """Test pagination"""
        # Create multiple alfajores
        for i in range(5):
            alfajor = {
                "page_number": i + 1,
                "marca": f"Marca{i}",
                "sabor": "Test",
                "pais": "Argentina"
            }
            client.post('/api/alfajores',
                       data=json.dumps(alfajor),
                       content_type='application/json')
        
        # Test pagination
        response = client.get('/api/alfajores?page=1&per_page=2')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert len(data['alfajores']) == 2
        assert data['total'] == 5
        assert data['pages'] == 3
        assert data['current_page'] == 1

class TestValidation:
    """Test data validation"""
    
    def test_create_alfajor_missing_required_fields(self, client):
        """Test creating alfajor without required fields"""
        invalid_data = {
            "marca": "Test Brand"
            # Missing page_number, sabor, pais
        }
        
        response = client.post('/api/alfajores',
                              data=json.dumps(invalid_data),
                              content_type='application/json')
        
        assert response.status_code == 400
    
    def test_create_alfajor_duplicate_page(self, client, sample_alfajor_data):
        """Test creating alfajor with duplicate page number should update"""
        # Create first alfajor
        response = client.post('/api/alfajores',
                              data=json.dumps(sample_alfajor_data),
                              content_type='application/json')
        
        assert response.status_code == 200
        
        # Create another alfajor with same page number (should update)
        updated_data = sample_alfajor_data.copy()
        updated_data['sabor'] = 'Updated Flavor'
        
        response = client.post('/api/alfajores',
                              data=json.dumps(updated_data),
                              content_type='application/json')
        
        assert response.status_code == 200
        
        # Verify it was updated, not duplicated
        response = client.get('/api/alfajores')
        data = json.loads(response.data)
        assert data['total'] == 1
        assert data['alfajores'][0]['sabor'] == 'Updated Flavor'

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
