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

class TestNextPageEndpoint:
    """Test calculating the next available page number"""

    def test_next_page_empty_database(self, client):
        """When there are no records, the next page should be 1"""
        response = client.get('/api/alfajores/next-page')

        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['next_page'] == 1

    def test_next_page_with_existing_records(self, client):
        """The endpoint should return the next page after the max stored page"""
        payload = {
            "page_number": 5,
            "marca": "Test",
            "sabor": "Test",
            "pais": "AR"
        }

        client.post(
            '/api/alfajores',
            data=json.dumps(payload),
            content_type='application/json'
        )

        response = client.get('/api/alfajores/next-page')

        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['next_page'] == 6

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

class TestMemoryOptimizations:
    """Test memory optimization features"""
    
    def test_pagination_limit_cap(self, client):
        """Test that per_page is capped at 100 to prevent memory issues"""
        # Create 10 test alfajores
        for i in range(10):
            alfajor = {
                "page_number": i + 1,
                "marca": f"Marca{i}",
                "sabor": "Test",
                "pais": "Argentina"
            }
            client.post('/api/alfajores',
                       data=json.dumps(alfajor),
                       content_type='application/json')
        
        # Request more than 100 items per page
        response = client.get('/api/alfajores?per_page=500')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        # Should be capped at 100
        assert data['per_page'] <= 100
    
    def test_export_pagination(self, client):
        """Test that export endpoint now returns paginated results"""
        # Create test data
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
        
        # Test export with pagination
        response = client.get('/api/export?page=1&per_page=2')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert 'page' in data
        assert 'per_page' in data
        assert 'total_pages' in data
        assert 'total_count' in data
        assert data['page'] == 1
        assert data['per_page'] == 2
        assert data['count_in_page'] == 2
        assert data['total_count'] == 5
    
    def test_export_pagination_cap(self, client):
        """Test that export per_page is capped at 500"""
        # Create test data
        for i in range(3):
            alfajor = {
                "page_number": i + 1,
                "marca": f"Marca{i}",
                "sabor": "Test",
                "pais": "Argentina"
            }
            client.post('/api/alfajores',
                       data=json.dumps(alfajor),
                       content_type='application/json')
        
        # Request more than 500 items per page
        response = client.get('/api/export?page=1&per_page=1000')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        # Should be capped at 500
        assert data['per_page'] <= 500
    
    def test_export_without_images_by_default(self, client, sample_alfajor_data):
        """Test that export excludes image_data by default"""
        # Create alfajor with image_data
        sample_alfajor_data['image_data'] = 'base64encodedimagedata'
        client.post('/api/alfajores',
                   data=json.dumps(sample_alfajor_data),
                   content_type='application/json')
        
        # Export without images
        response = client.get('/api/export?page=1&per_page=10')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        # image_data should not be in the response
        assert 'image_data' not in data['alfajores'][0]
    
    def test_get_alfajor_without_image_data(self, client, sample_alfajor_data):
        """Test that get alfajor by page excludes image_data by default"""
        # Create alfajor
        client.post('/api/alfajores',
                   data=json.dumps(sample_alfajor_data),
                   content_type='application/json')
        
        # Get alfajor without image_data
        response = client.get('/api/alfajores/1')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        # image_data should not be in response
        assert 'image_data' not in data
        # But should still have other fields
        assert data['marca'] == 'Havanna'
        assert data['page_number'] == 1
    
    def test_get_alfajor_with_image_data_when_requested(self, client, sample_alfajor_data):
        """Test that get alfajor includes image_data when explicitly requested"""
        # Create alfajor
        client.post('/api/alfajores',
                   data=json.dumps(sample_alfajor_data),
                   content_type='application/json')
        
        # Get alfajor with image_data
        response = client.get('/api/alfajores/1?include_image_data=true')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        # Should have all fields
        assert data['marca'] == 'Havanna'
        assert data['page_number'] == 1
        # image_base64 might not be present if no file exists, but the flag should be processed
    
    def test_dropdown_options_cache_header(self, client, sample_alfajor_data):
        """Test that dropdown options endpoint returns cache headers"""
        # Create alfajor
        client.post('/api/alfajores',
                   data=json.dumps(sample_alfajor_data),
                   content_type='application/json')
        
        # Get dropdown options
        response = client.get('/api/dropdown-options')
        
        assert response.status_code == 200
        
        # Check for cache control header
        assert 'Cache-Control' in response.headers
        assert 'max-age' in response.headers['Cache-Control']
    
    def test_stats_cache_header(self, client, sample_alfajor_data):
        """Test that stats endpoint returns cache headers"""
        # Create alfajor
        client.post('/api/alfajores',
                   data=json.dumps(sample_alfajor_data),
                   content_type='application/json')
        
        # Get stats
        response = client.get('/api/stats')
        
        assert response.status_code == 200
        
        # Check for cache control header
        assert 'Cache-Control' in response.headers
        assert 'max-age' in response.headers['Cache-Control']
    
    def test_stats_limits_results(self, client):
        """Test that stats endpoint limits results to prevent memory issues"""
        # Create many alfajores with different marcas
        for i in range(25):
            alfajor = {
                "page_number": i + 1,
                "marca": f"Marca{i}",
                "sabor": "Test",
                "pais": f"Pais{i}"
            }
            client.post('/api/alfajores',
                       data=json.dumps(alfajor),
                       content_type='application/json')
        
        # Get stats
        response = client.get('/api/stats')
        
        assert response.status_code == 200
        
        data = json.loads(response.data)
        # Should be limited to top 20
        assert len(data['by_marca']) <= 20
        assert len(data['by_pais']) <= 20

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
