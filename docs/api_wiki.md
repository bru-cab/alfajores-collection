# API Documentation - Alfajores Collection

## Overview

The Alfajores Collection API is a RESTful service built with Flask that provides comprehensive functionality for managing and categorizing alfajor envelope collections. The API supports PDF processing, image extraction, data management, and statistical analysis.

**Base URL:** `http://localhost:5000/api`

## Authentication

Currently, the API does not require authentication. All endpoints are publicly accessible.

## Common Response Format

### Success Response
```json
{
  "message": "Operation successful",
  "data": {...}
}
```

### Error Response
```json
{
  "error": "Error description"
}
```

## Endpoints

### Health Check

#### GET /health
Check if the API server is running.

**Response:**
```json
{
  "status": "healthy",
  "message": "Alfajores API is running"
}
```

### PDF Management

#### POST /upload-pdf
Upload and process a PDF file for alfajor extraction.

**Request:**
- Content-Type: `multipart/form-data`
- Body: PDF file in `file` field

**Response:**
```json
{
  "message": "PDF uploaded and processed successfully",
  "pdf_id": 1,
  "total_pages": 155,
  "extracted_pages": 155
}
```

**Error Codes:**
- `400`: No file provided, invalid file type
- `500`: Processing error

#### GET /pdf-info
Get information about uploaded PDFs.

**Response:**
```json
{
  "pdfs": [
    {
      "id": 1,
      "filename": "alfajores_20240830_143022.pdf",
      "original_filename": "Adobe Scan Aug 29, 2025.pdf",
      "total_pages": 155,
      "upload_date": "2024-08-30T14:30:22.123456",
      "extracted": true
    }
  ]
}
```

### Alfajor Management

#### GET /alfajores
Retrieve alfajores with optional filtering and pagination.

**Query Parameters:**
- `page` (int): Page number (default: 1)
- `per_page` (int): Items per page (default: 50, max: 100)
- `marca` (string): Filter by brand name
- `pais` (string): Filter by country
- `sabor` (string): Filter by flavor
- `status` (string): Filter by status (categorized/uncategorized)

**Response:**
```json
{
  "alfajores": [
    {
      "id": 1,
      "page_number": 1,
      "marca": "Havanna",
      "sabor": "Dulce de leche",
      "pais": "Argentina",
      "tipo": "Premium",
      "tamaño": "Grande",
      "cobertura": "Chocolate",
      "año": 2023,
      "rareza": "Común",
      "notas": "Alfajor clásico argentino",
      "image_filename": "page_1_1.jpg",
      "date_added": "2024-08-30T14:30:22.123456",
      "date_modified": "2024-08-30T14:30:22.123456",
      "status": "categorized"
    }
  ],
  "total": 1,
  "pages": 1,
  "current_page": 1,
  "per_page": 50
}
```

#### GET /alfajores/{page_number}
Get alfajor by page number.

**Path Parameters:**
- `page_number` (int): PDF page number

**Response:**
```json
{
  "id": 1,
  "page_number": 1,
  "marca": "Havanna",
  "sabor": "Dulce de leche",
  "pais": "Argentina",
  "tipo": "Premium",
  "tamaño": "Grande",
  "cobertura": "Chocolate",
  "año": 2023,
  "rareza": "Común",
  "notas": "Alfajor clásico argentino",
  "image_filename": "page_1_1.jpg",
  "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
  "date_added": "2024-08-30T14:30:22.123456",
  "date_modified": "2024-08-30T14:30:22.123456",
  "status": "categorized"
}
```

**Error Codes:**
- `404`: Alfajor not found

#### GET /alfajores/next-page
Get the next available page number in the database. Helpful to start numbering new PDFs sequentially.

**Response:**
```json
{
  "next_page": 164
}
```

#### POST /alfajores
Create or update an alfajor (upsert by page_number).

**Request Body:**
```json
{
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
```

**Required Fields:**
- `page_number` (int)
- `marca` (string)
- `sabor` (string)
- `pais` (string)

**Response:**
```json
{
  "message": "Alfajor saved successfully",
  "alfajor": {
    "id": 1,
    "page_number": 1,
    "marca": "Havanna",
    // ... full alfajor object
  }
}
```

If an alfajor with the same `page_number` already exists, the endpoint updates it instead and returns:

```json
{
  "message": "Alfajor updated successfully",
  "alfajor": { /* updated object */ }
}
```

**Error Codes:**
- `400`: Missing required fields or invalid data
- `500`: Database error

#### PUT /alfajores/{id}
Update an existing alfajor by ID.

**Path Parameters:**
- `id` (int): Alfajor ID

**Request Body:** Same as POST /alfajores

**Response:** Same as POST /alfajores

**Error Codes:**
- `404`: Alfajor not found
- `500`: Database error

#### DELETE /alfajores/{id}
Delete an alfajor by ID.

**Path Parameters:**
- `id` (int): Alfajor ID

**Response:**
```json
{
  "message": "Alfajor deleted successfully"
}
```

**Error Codes:**
- `404`: Alfajor not found
- `500`: Database error

#### DELETE /alfajores/page/{page_number}
Delete an alfajor by page number.

**Response:**
```json
{ "message": "Alfajor from page 123 deleted successfully" }
```

### Statistics

#### GET /stats
Get collection statistics.

**Response:**
```json
{
  "total_alfajores": 25,
  "by_marca": [
    {"name": "Havanna", "count": 8},
    {"name": "Cachafaz", "count": 5},
    {"name": "Jorgito", "count": 3}
  ],
  "by_pais": [
    {"name": "Argentina", "count": 20},
    {"name": "Uruguay", "count": 3},
    {"name": "Chile", "count": 2}
  ],
  "by_sabor": [
    {"name": "Dulce de leche", "count": 12},
    {"name": "Chocolate", "count": 8},
    {"name": "Fruta", "count": 5}
  ],
  "by_rareza": [
    {"name": "Común", "count": 15},
    {"name": "Poco común", "count": 6},
    {"name": "Raro", "count": 3},
    {"name": "Muy raro", "count": 1}
  ]
}
```

### Data Management

#### GET /export
Export all alfajores data.

**Response:**
```json
{
  "export_date": "2024-08-30T14:30:22.123456Z",
  "total_count": 25,
  "alfajores": [
    {
      "id": 1,
      "page_number": 1,
      "marca": "Havanna",
      // ... full alfajor objects
    }
  ]
}
```

#### POST /import
Import alfajores data from JSON.

**Request Body:**
```json
{
  "alfajores": [
    {
      "page_number": 1,
      "marca": "Havanna",
      "sabor": "Dulce de leche",
      "pais": "Argentina"
      // ... other fields
    }
  ]
}
```

**Response:**
```json
{
  "message": "Successfully imported 10 alfajores",
  "imported_count": 10
}
```

**Error Codes:**
- `400`: Invalid import data format
- `500`: Database error

### Image Serving

#### GET /images/{filename}
Serve extracted PDF page images.

**Path Parameters:**
- `filename` (string): Image filename (e.g., "page_1_1.jpg")

**Response:** Image file (JPEG)

**Error Codes:**
- `404`: Image not found

## Data Models

### Alfajor Model
```
id: Integer (Primary Key, Auto-increment)
page_number: Integer (Required, Unique)
marca: String(100) (Required)
sabor: String(100) (Required)
pais: String(100) (Required)
tipo: String(50) (Optional)
tamaño: String(50) (Optional)
cobertura: String(100) (Optional)
año: Integer (Optional)
rareza: String(50) (Optional)
notas: Text (Optional)
image_filename: String(255) (Optional)
date_added: DateTime (Auto-generated)
date_modified: DateTime (Auto-updated)
status: String(20) (Default: 'categorized')
```

### PDFDocument Model
```
id: Integer (Primary Key, Auto-increment)
filename: String(255) (Required)
original_filename: String(255) (Required)
total_pages: Integer (Required)
upload_date: DateTime (Auto-generated)
extracted: Boolean (Default: False)
```

## Error Handling

The API uses standard HTTP status codes:

- `200 OK`: Request successful
- `400 Bad Request`: Invalid request data
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error responses include descriptive messages:

```json
{
  "error": "Descriptive error message"
}
```

## Rate Limiting

Currently, no rate limiting is implemented. This may be added in future versions.

## Versioning

The API is currently at version 1. Future versions will be indicated in the URL path (e.g., `/api/v2/`).

## Examples

### Complete Workflow Example

1. **Upload PDF:**
```bash
curl -X POST http://localhost:5000/api/upload-pdf \
  -F "file=@alfajores.pdf"
```

2. **Create Alfajor:**
```bash
curl -X POST http://localhost:5000/api/alfajores \
  -H "Content-Type: application/json" \
  -d '{
    "page_number": 1,
    "marca": "Havanna",
    "sabor": "Dulce de leche",
    "pais": "Argentina"
  }'
```

3. **Get Statistics:**
```bash
curl http://localhost:5000/api/stats
```

4. **Export Data:**
```bash
curl http://localhost:5000/api/export > backup.json
```

## Testing

The API includes comprehensive tests. Run them with:

```bash
cd backend
python -m pytest test_api.py -v
```

For coverage reports:
```bash
python -m pytest test_api.py --cov=app --cov-report=html
```
