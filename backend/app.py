from flask import Flask, request, jsonify, send_file, send_from_directory, render_template_string
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_marshmallow import Marshmallow
from datetime import datetime
import os
import json
from pdf2image import convert_from_path
from PIL import Image
import io
import base64
from pathlib import Path

# Initialize Flask app - serve both frontend and backend
app = Flask(__name__, static_folder='../static', static_url_path='/static')
CORS(app, origins=['*'])  # Allow all origins for search page deployment

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///alfajores.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['IMAGES_FOLDER'] = 'images'

# Initialize extensions
db = SQLAlchemy(app)
ma = Marshmallow(app)

# Create directories if they don't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['IMAGES_FOLDER'], exist_ok=True)

# PDF path for automatic image extraction
PDF_PATH = os.path.join(os.path.dirname(__file__), '..', 'Adobe Scan Aug 29, 2025.pdf')

def extract_page_image_fast(page_number):
    """Extract a single page from PDF with optimizations"""
    try:
        if not os.path.exists(PDF_PATH):
            print(f"❌ PDF not found at: {PDF_PATH}")
            return None
            
        # Check if image already exists
        image_filename = f"page_{page_number}.png"
        image_path = os.path.join(app.config['IMAGES_FOLDER'], image_filename)
        
        if os.path.exists(image_path):
            print(f"✅ Image already exists: {image_filename}")
            return image_filename
            
        # Convert specific page with lower DPI for speed
        images = convert_from_path(
            PDF_PATH,
            first_page=page_number,
            last_page=page_number,
            dpi=150,  # Reduced from 200 to 150 for speed
            fmt='PNG',
            thread_count=2  # Use multiple threads
        )
        
        if images:
            image = images[0]
            
            # Compress image to reduce size
            image.save(image_path, optimize=True, quality=85)
            print(f"✅ Generated optimized image: {image_filename}")
            return image_filename
        
    except Exception as e:
        print(f"❌ Error extracting page {page_number}: {e}")
        
    return None

def extract_page_image_async(page_number):
    """Schedule image extraction in background"""
    import threading
    
    def background_extract():
        try:
            extract_page_image_fast(page_number)
        except Exception as e:
            print(f"❌ Background extraction failed for page {page_number}: {e}")
    
    # Run in background thread
    thread = threading.Thread(target=background_extract)
    thread.daemon = True
    thread.start()
    
    # Return placeholder filename immediately
    return f"page_{page_number}.png"

# Models
class Alfajor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    page_number = db.Column(db.Integer, nullable=False, unique=True)
    marca = db.Column(db.String(100), nullable=False)
    sabor = db.Column(db.String(100), nullable=False)
    pais = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(50), nullable=True)
    notas = db.Column(db.Text, nullable=True)
    image_filename = db.Column(db.String(255), nullable=True)
    date_added = db.Column(db.DateTime, default=datetime.utcnow)
    date_modified = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = db.Column(db.String(20), default='categorized')

    def __repr__(self):
        return f'<Alfajor {self.marca} - {self.sabor} (Página {self.page_number})>'

class PDFDocument(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    total_pages = db.Column(db.Integer, nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    extracted = db.Column(db.Boolean, default=False)

# Schemas
class AlfajorSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Alfajor
        load_instance = True

class PDFDocumentSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = PDFDocument
        load_instance = True

alfajor_schema = AlfajorSchema()
alfajores_schema = AlfajorSchema(many=True)
pdf_schema = PDFDocumentSchema()

# Helper functions
def extract_pdf_pages(pdf_path, pdf_id):
    """Extract individual pages from PDF as images"""
    try:
        # Convert PDF pages to images
        images = convert_from_path(pdf_path, dpi=150)
        
        extracted_files = []
        for i, image in enumerate(images):
            page_number = i + 1
            filename = f"page_{page_number}_{pdf_id}.jpg"
            filepath = os.path.join(app.config['IMAGES_FOLDER'], filename)
            
            # Optimize image size while maintaining quality
            image = image.convert('RGB')
            image.thumbnail((1200, 1600), Image.Resampling.LANCZOS)
            image.save(filepath, 'JPEG', quality=85, optimize=True)
            
            extracted_files.append({
                'page_number': page_number,
                'filename': filename,
                'filepath': filepath
            })
        
        return extracted_files
    except Exception as e:
        print(f"Error extracting PDF pages: {str(e)}")
        return []

def get_image_base64(image_path):
    """Convert image to base64 for API response"""
    try:
        with open(image_path, 'rb') as img_file:
            return base64.b64encode(img_file.read()).decode('utf-8')
    except:
        return None

# API Routes

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'Alfajores API is running'})

@app.route('/api/upload-pdf', methods=['POST'])
def upload_pdf():
    """Upload and process PDF file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'File must be a PDF'}), 400
    
    try:
        # Save uploaded file
        filename = f"alfajores_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Get page count
        from PyPDF2 import PdfReader
        reader = PdfReader(filepath)
        total_pages = len(reader.pages)
        
        # Save PDF info to database
        pdf_doc = PDFDocument(
            filename=filename,
            original_filename=file.filename,
            total_pages=total_pages
        )
        db.session.add(pdf_doc)
        db.session.commit()
        
        # Extract pages in background (for now, do it synchronously)
        extracted_files = extract_pdf_pages(filepath, pdf_doc.id)
        
        if extracted_files:
            pdf_doc.extracted = True
            db.session.commit()
        
        return jsonify({
            'message': 'PDF uploaded and processed successfully',
            'pdf_id': pdf_doc.id,
            'total_pages': total_pages,
            'extracted_pages': len(extracted_files)
        })
        
    except Exception as e:
        return jsonify({'error': f'Error processing PDF: {str(e)}'}), 500

@app.route('/api/alfajores', methods=['GET'])
def get_alfajores():
    """Get all alfajores with optional filtering"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    marca = request.args.get('marca')
    pais = request.args.get('pais')
    sabor = request.args.get('sabor')
    status = request.args.get('status')
    
    query = Alfajor.query
    
    # Apply filters
    if marca:
        query = query.filter(Alfajor.marca.ilike(f'%{marca}%'))
    if pais:
        query = query.filter(Alfajor.pais.ilike(f'%{pais}%'))
    if sabor:
        query = query.filter(Alfajor.sabor.ilike(f'%{sabor}%'))
    if status:
        query = query.filter(Alfajor.status == status)
    
    # Paginate results
    alfajores = query.paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    result = alfajores_schema.dump(alfajores.items)
    
    return jsonify({
        'alfajores': result,
        'total': alfajores.total,
        'pages': alfajores.pages,
        'current_page': page,
        'per_page': per_page
    })

@app.route('/api/alfajores/<int:page_number>', methods=['GET'])
def get_alfajor_by_page(page_number):
    """Get alfajor by page number"""
    alfajor = Alfajor.query.filter_by(page_number=page_number).first()
    
    if not alfajor:
        return jsonify({'error': 'Alfajor not found'}), 404
    
    result = alfajor_schema.dump(alfajor)
    
    # Add image data if available
    if alfajor.image_filename:
        image_path = os.path.join(app.config['IMAGES_FOLDER'], alfajor.image_filename)
        if os.path.exists(image_path):
            result['image_base64'] = get_image_base64(image_path)
    
    return jsonify(result)

@app.route('/api/alfajores', methods=['POST'])
def create_alfajor():
    """Create or update alfajor"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        page_number = data.get('page_number')
        if not page_number:
            return jsonify({'error': 'page_number is required'}), 400
        
        # Check if alfajor already exists for this page
        existing_alfajor = Alfajor.query.filter_by(page_number=page_number).first()
        
        if existing_alfajor:
            # Update existing
            for key, value in data.items():
                if hasattr(existing_alfajor, key) and key != 'id':
                    setattr(existing_alfajor, key, value)
            
            existing_alfajor.date_modified = datetime.utcnow()
            
            # Generate image if not already present (async)
            if not existing_alfajor.image_filename:
                # Check if image already exists
                potential_filename = f"page_{page_number}.png"
                image_path = os.path.join(app.config['IMAGES_FOLDER'], potential_filename)
                
                if os.path.exists(image_path):
                    existing_alfajor.image_filename = potential_filename
                else:
                    # Schedule background extraction and set filename
                    existing_alfajor.image_filename = extract_page_image_async(page_number)
            
            alfajor = existing_alfajor
        else:
            # Create new
            # Check if image already exists, otherwise schedule async extraction
            potential_filename = f"page_{page_number}.png"
            image_path = os.path.join(app.config['IMAGES_FOLDER'], potential_filename)
            
            if os.path.exists(image_path):
                data['image_filename'] = potential_filename
            else:
                # Schedule background extraction and set filename
                data['image_filename'] = extract_page_image_async(page_number)
            
            # Sanitize payload to include only model fields
            allowed_keys = {
                'page_number','marca','sabor','pais','color','notas','image_filename','status'
            }
            sanitized = {k: v for k, v in data.items() if k in allowed_keys}
            alfajor = alfajor_schema.load(sanitized)
            db.session.add(alfajor)
        
        db.session.commit()
        
        result = alfajor_schema.dump(alfajor)
        return jsonify({
            'message': 'Alfajor saved successfully',
            'alfajor': result
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error saving alfajor: {str(e)}'}), 500

@app.route('/api/alfajores/<int:alfajor_id>', methods=['PUT'])
def update_alfajor(alfajor_id):
    """Update alfajor by ID"""
    try:
        alfajor = Alfajor.query.get_or_404(alfajor_id)
        data = request.get_json()
        
        for key, value in data.items():
            if hasattr(alfajor, key) and key != 'id':
                setattr(alfajor, key, value)
        
        alfajor.date_modified = datetime.utcnow()
        db.session.commit()
        
        result = alfajor_schema.dump(alfajor)
        return jsonify({
            'message': 'Alfajor updated successfully',
            'alfajor': result
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error updating alfajor: {str(e)}'}), 500

@app.route('/api/alfajores/<int:alfajor_id>', methods=['DELETE'])
def delete_alfajor(alfajor_id):
    """Delete alfajor by ID"""
    try:
        alfajor = Alfajor.query.get_or_404(alfajor_id)
        db.session.delete(alfajor)
        db.session.commit()
        
        return jsonify({'message': 'Alfajor deleted successfully'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error deleting alfajor: {str(e)}'}), 500

@app.route('/api/alfajores/page/<int:page_number>', methods=['DELETE'])
def delete_alfajor_by_page(page_number):
    """Delete alfajor by page number"""
    try:
        alfajor = Alfajor.query.filter_by(page_number=page_number).first()
        if not alfajor:
            return jsonify({'error': 'Alfajor not found'}), 404
            
        db.session.delete(alfajor)
        db.session.commit()
        
        return jsonify({'message': f'Alfajor from page {page_number} deleted successfully'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error deleting alfajor: {str(e)}'}), 500

@app.route('/api/images/<filename>')
def serve_image(filename):
    """Serve extracted PDF page images"""
    image_path = os.path.join(app.config['IMAGES_FOLDER'], filename)
    if os.path.exists(image_path):
        return send_file(image_path)
    return jsonify({'error': 'Image not found'}), 404

@app.route('/api/images/status/<int:page_number>')
def check_image_status(page_number):
    """Check if image exists for a page"""
    image_filename = f"page_{page_number}.png"
    image_path = os.path.join(app.config['IMAGES_FOLDER'], image_filename)
    
    return jsonify({
        'exists': os.path.exists(image_path),
        'filename': image_filename if os.path.exists(image_path) else None
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get collection statistics"""
    try:
        total_alfajores = Alfajor.query.count()
        
        # Stats by marca
        marca_stats = db.session.query(
            Alfajor.marca, db.func.count(Alfajor.id)
        ).group_by(Alfajor.marca).order_by(db.func.count(Alfajor.id).desc()).all()
        
        # Stats by pais
        pais_stats = db.session.query(
            Alfajor.pais, db.func.count(Alfajor.id)
        ).group_by(Alfajor.pais).order_by(db.func.count(Alfajor.id).desc()).all()
        
        # Stats by sabor
        sabor_stats = db.session.query(
            Alfajor.sabor, db.func.count(Alfajor.id)
        ).group_by(Alfajor.sabor).order_by(db.func.count(Alfajor.id).desc()).all()
        
        # Stats by color
        color_stats = db.session.query(
            Alfajor.color, db.func.count(Alfajor.id)
        ).group_by(Alfajor.color).order_by(db.func.count(Alfajor.id).desc()).all()
        
        return jsonify({
            'total_alfajores': total_alfajores,
            'by_marca': [{'name': m[0], 'count': m[1]} for m in marca_stats],
            'by_pais': [{'name': p[0], 'count': p[1]} for p in pais_stats],
            'by_sabor': [{'name': s[0], 'count': s[1]} for s in sabor_stats],
            'by_color': [{'name': c[0] or 'No especificado', 'count': c[1]} for c in color_stats]
        })
        
    except Exception as e:
        return jsonify({'error': f'Error getting stats: {str(e)}'}), 500

@app.route('/api/export', methods=['GET'])
def export_data():
    """Export all alfajores data"""
    try:
        alfajores = Alfajor.query.all()
        result = alfajores_schema.dump(alfajores)
        
        export_data = {
            'export_date': datetime.utcnow().isoformat(),
            'total_count': len(result),
            'alfajores': result
        }
        
        return jsonify(export_data)
        
    except Exception as e:
        return jsonify({'error': f'Error exporting data: {str(e)}'}), 500

@app.route('/api/import', methods=['POST'])
def import_data():
    """Import alfajores data from JSON"""
    try:
        data = request.get_json()
        
        if not data or 'alfajores' not in data:
            return jsonify({'error': 'Invalid import data format'}), 400
        
        imported_count = 0
        for alfajor_data in data['alfajores']:
            page_number = alfajor_data.get('page_number')
            if not page_number:
                continue
                
            # Check if already exists
            existing = Alfajor.query.filter_by(page_number=page_number).first()
            if not existing:
                # Remove computed fields
                alfajor_data.pop('id', None)
                alfajor_data.pop('date_added', None)
                alfajor_data.pop('date_modified', None)
                
                alfajor = alfajor_schema.load(alfajor_data)
                db.session.add(alfajor)
                imported_count += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'Successfully imported {imported_count} alfajores',
            'imported_count': imported_count
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error importing data: {str(e)}'}), 500

@app.route('/api/pdf-info', methods=['GET'])
def get_pdf_info():
    """Get information about uploaded PDFs"""
    try:
        pdfs = PDFDocument.query.order_by(PDFDocument.upload_date.desc()).all()
        result = pdf_schema.dump(pdfs, many=True)
        return jsonify({'pdfs': result})
    except Exception as e:
        return jsonify({'error': f'Error getting PDF info: {str(e)}'}), 500

@app.route('/api/dropdown-options', methods=['GET'])
def get_dropdown_options():
    """Get all unique values for dropdown options"""
    try:
        # Get unique values for each field, ordered by frequency
        marcas = db.session.query(Alfajor.marca).distinct().order_by(Alfajor.marca).all()
        sabores = db.session.query(Alfajor.sabor).distinct().order_by(Alfajor.sabor).all()
        paises = db.session.query(Alfajor.pais).distinct().order_by(Alfajor.pais).all()
        colores = db.session.query(Alfajor.color).filter(Alfajor.color.isnot(None)).distinct().order_by(Alfajor.color).all()
        
        return jsonify({
            'marcas': [m[0] for m in marcas],
            'sabores': [s[0] for s in sabores],
            'paises': [p[0] for p in paises],
            'colores': [c[0] for c in colores]
        })
        
    except Exception as e:
        return jsonify({'error': f'Error getting dropdown options: {str(e)}'}), 500

# Frontend routes
@app.route('/')
def index():
    """Serve the main application"""
    return send_from_directory('..', 'index.html')

@app.route('/search')
def search_page():
    """Serve the search page"""
    return send_from_directory('..', 'search.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files (CSS, JS, etc.)"""
    if filename in ['styles.css', 'script.js', 'migrate_data.html', 'search.html']:
        return send_from_directory('..', filename)
    elif filename.endswith('.pdf'):
        return send_from_directory('..', filename)
    else:
        return send_from_directory('..', filename)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        
    # Use PORT environment variable for deployment, default to 3000 for local
    port = int(os.environ.get('PORT', 3000))
    
    print("🚀 Starting Alfajores Collection - All-in-One Server")
    print(f"📱 Frontend: http://localhost:{port}")
    print(f"🔧 API: http://localhost:{port}/api")
    print(f"📊 Health Check: http://localhost:{port}/api/health")
    
    app.run(debug=False, port=port, host='0.0.0.0')
