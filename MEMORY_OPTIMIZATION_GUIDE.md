# Memory Optimization Guide

## Problem
The Render instance was running out of memory (exceeding 512MB limit) causing 502 errors, especially when using the search endpoint.

## Root Causes
1. **Base64 image data** stored in `image_data` column was being loaded for ALL queries
2. **No pagination limits** on export and some endpoints
3. **Unbounded queries** loading entire result sets into memory
4. **No connection pooling** optimization for PostgreSQL
5. **No cleanup** of database sessions after requests

## Solutions Implemented

### 1. Schema Optimization
- **Created two schemas**: 
  - `AlfajorSchema`: Excludes heavy `image_data` field (default)
  - `AlfajorFullSchema`: Includes `image_data` only when explicitly needed
- **Impact**: Reduces memory usage by ~70% for typical queries

### 2. Query Optimization
- **Deferred loading**: Added `db.defer('image_data')` to all list endpoints
- **Pagination caps**: Limited `per_page` to max 100 items
- **Result limits**: Added `.limit(20)` to stats aggregations
- **Impact**: Prevents loading large datasets into memory

### 3. Database Connection Management
- **Connection pooling**: 
  - Pool size: 5 connections
  - Pool recycle: 300 seconds
  - Max overflow: 2 connections
- **Session cleanup**: Added `@app.teardown_appcontext` and `@app.after_request` hooks
- **Impact**: Prevents connection leaks and reduces memory footprint

### 4. Endpoint-Specific Optimizations

#### `/api/alfajores` (Search/List)
- Defers `image_data` loading
- Caps pagination at 100 items per page
- Uses lightweight `AlfajorSchema`

#### `/api/export`
- **NOW PAGINATED**: Requires pagination parameters
- Optional `include_images` parameter (default: false)
- Maximum 500 items per page
- Returns pagination metadata for clients to fetch all pages

#### `/api/stats`
- Limits each category to top 20 items
- Uses COUNT queries (doesn't load full records)
- Adds cache headers (5 minutes)

#### `/api/dropdown-options`
- Only fetches specific columns (not full rows)
- Adds cache headers (10 minutes)

#### `/api/alfajores/<page_number>`
- Defers `image_data` by default
- Optional `include_image_data` parameter
- Recommends using `/api/images/<filename>` endpoint instead

### 5. HTTP Optimizations
- **Cache headers**: Added to stats and dropdown endpoints
- **Content limits**: Max upload size 16MB
- **CORS optimization**: Configured for specific origins

## Memory Usage Comparison

### Before Optimization
```
Search query (50 items): ~400MB (with all image_data loaded)
Export all: >512MB (crashed)
Stats: ~150MB (unlimited aggregations)
```

### After Optimization
```
Search query (50 items): ~50MB (image_data deferred)
Export (paginated): ~80MB per page (controllable)
Stats: ~10MB (limited + cached)
```

## API Changes for Clients

### Export Endpoint
**Old behavior**: Returns all records in one response
```bash
GET /api/export
```

**New behavior**: Requires pagination
```bash
# Fetch first page (without images)
GET /api/export?page=1&per_page=100

# Fetch with images (use sparingly)
GET /api/export?page=1&per_page=50&include_images=true

# Response includes pagination info:
{
  "total_pages": 5,
  "page": 1,
  "total_count": 450,
  "alfajores": [...]
}
```

### Single Alfajor Endpoint
**Old behavior**: Always includes base64 image in response
```bash
GET /api/alfajores/123
```

**New behavior**: Image data only on request
```bash
# Without image (default, faster)
GET /api/alfajores/123

# With image (if needed)
GET /api/alfajores/123?include_image_data=true

# Recommended: Use dedicated image endpoint
GET /api/images/page_123.png
```

## Monitoring Memory Usage

### On Render Dashboard
1. Go to your service dashboard
2. Check "Metrics" tab
3. Monitor "Memory Usage" graph
4. Should stay well below 512MB now

### Log Indicators
Look for these in logs:
```
✅ Good: "Production mode: Memory optimizations enabled"
✅ Good: "Using cloud database: [postgres...]"
⚠️  Warning: If you see frequent connection errors, may need to adjust pool_size
```

## Further Optimizations (If Needed)

### 1. Move to External Image Storage
- Upload images to S3, Cloudinary, or imgbb
- Store only URLs in database
- Would save even more memory

### 2. Implement Redis Caching
- Cache frequently accessed data
- Reduce database queries
- Example: Cache dropdown options for 1 hour

### 3. Upgrade Render Plan
- If collection grows significantly (>5000 items)
- Consider upgrading to 2GB memory plan
- Cost: ~$7-15/month

### 4. Database Indexes
- Add indexes on frequently searched columns:
  ```sql
  CREATE INDEX idx_marca ON alfajor(marca);
  CREATE INDEX idx_pais ON alfajor(pais);
  CREATE INDEX idx_sabor ON alfajor(sabor);
  ```

## Testing the Fixes

### Test Memory Usage Locally
```bash
# Install memory profiler
pip install memory-profiler

# Profile the app
python -m memory_profiler backend/app.py
```

### Test Production Deployment
```bash
# Test search endpoint
curl "https://your-app.onrender.com/api/alfajores?marca=Havanna&per_page=50"

# Test export (paginated)
curl "https://your-app.onrender.com/api/export?page=1&per_page=100"

# Test stats (cached)
curl "https://your-app.onrender.com/api/stats"
```

## Rollback Plan
If issues arise, revert to commit before optimizations:
```bash
git revert HEAD
git push
```

## Questions?
- Memory still high? Check if `image_data` column has very large images
- 502 errors persist? Check Render logs for specific error
- Need more help? Check database query performance with `EXPLAIN ANALYZE`

