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

# Configuration - Cloud Database
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://username:password@localhost:5432/alfajores_db')
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://')

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['IMAGES_FOLDER'] = 'images'

# Initialize extensions
db = SQLAlchemy(app)
ma = Marshmallow(app)

# Create directories if they don't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['IMAGES_FOLDER'], exist_ok=True)

# Models - Same as before but optimized for cloud
class Alfajor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    page_number = db.Column(db.Integer, nullable=False, unique=True)
    marca = db.Column(db.String(100), nullable=False)
    sabor = db.Column(db.String(100), nullable=False)
    pais = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(50), nullable=True)
    notas = db.Column(db.Text, nullable=True)
    image_filename = db.Column(db.String(255), nullable=True)
    image_url = db.Column(db.String(500), nullable=True)  # New: URL for cloud-stored images
    image_data = db.Column(db.Text, nullable=True)  # New: Base64 encoded image data
    date_added = db.Column(db.DateTime, default=datetime.utcnow)
    date_modified = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = db.Column(db.String(20), default='categorized')
    created_from = db.Column(db.String(20), default='web')  # New: 'web' or 'ios'

    def __repr__(self):
        return f'<Alfajor {self.marca} - {self.sabor} (Página {self.page_number})>'

class PDFDocument(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    total_pages = db.Column(db.Integer, nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    extracted = db.Column(db.Boolean, default=False)

# Schemas - Enhanced for mobile
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

# Enhanced API Routes for Mobile

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'Alfajores API is running', 'database': 'cloud'})

# Mobile-specific endpoints
@app.route('/api/mobile/alfajores', methods=['POST'])
def create_alfajor_mobile():
    """Create alfajor from mobile app with image support"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        page_number = data.get('page_number')
        if not page_number:
            return jsonify({'error': 'page_number is required'}), 400
        
        # Check if alfajor already exists
        existing = Alfajor.query.filter_by(page_number=page_number).first()
        if existing:
            # Update existing
            for key, value in data.items():
                if hasattr(existing, key) and key != 'id':
                    setattr(existing, key, value)
            existing.date_modified = datetime.utcnow()
            existing.created_from = 'ios'
            
            db.session.commit()
            result = alfajor_schema.dump(existing)
            
            return jsonify({
                'message': 'Alfajor updated successfully',
                'alfajor': result
            })
        else:
            # Create new
            data['created_from'] = 'ios'
            alfajor = alfajor_schema.load(data)
            db.session.add(alfajor)
            db.session.commit()
            
            result = alfajor_schema.dump(alfajor)
            return jsonify({
                'message': 'Alfajor created successfully',
                'alfajor': result
            })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error saving alfajor: {str(e)}'}), 500

@app.route('/api/mobile/alfajores', methods=['GET'])
def get_alfajores_mobile():
    """Get alfajores optimized for mobile"""
    try:
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
        
    except Exception as e:
        return jsonify({'error': f'Error fetching alfajores: {str(e)}'}), 500

@app.route('/api/mobile/upload-image', methods=['POST'])
def upload_image_mobile():
    """Upload image from mobile app"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        file = request.files['image']
        page_number = request.form.get('page_number')
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not page_number:
            return jsonify({'error': 'page_number is required'}), 400
        
        # Read image data and convert to base64
        image_bytes = file.read()
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Generate filename for reference
        filename = f"mobile_page_{page_number}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        
        # Find or create alfajor record
        alfajor = Alfajor.query.filter_by(page_number=int(page_number)).first()
        if alfajor:
            # Update existing alfajor with image
            alfajor.image_filename = filename
            alfajor.image_data = image_base64
            alfajor.date_modified = datetime.utcnow()
        else:
            # Create new alfajor record with image (will be filled later)
            alfajor = Alfajor(
                page_number=int(page_number),
                marca="Pendiente",
                sabor="Pendiente", 
                pais="Pendiente",
                image_filename=filename,
                image_data=image_base64,
                status="pending"
            )
            db.session.add(alfajor)
        
        db.session.commit()
        
        image_url = f"/api/images/{filename}"
        
        return jsonify({
            'message': 'Image uploaded successfully',
            'filename': filename,
            'image_url': image_url,
            'page_number': int(page_number)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error uploading image: {str(e)}'}), 500

# Existing routes (keep all your current ones)
@app.route('/api/alfajores', methods=['GET'])
def get_alfajores():
    """Get all alfajores with optional filtering - Original endpoint"""
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

@app.route('/api/alfajores', methods=['POST'])
def create_alfajor():
    """Create new alfajor - Original endpoint"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        page_number = data.get('page_number')
        if not page_number:
            return jsonify({'error': 'page_number is required'}), 400
        
        data['created_from'] = 'web'
        alfajor = alfajor_schema.load(data)
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
        
        # Mobile vs Web stats
        platform_stats = db.session.query(
            Alfajor.created_from, db.func.count(Alfajor.id)
        ).group_by(Alfajor.created_from).all()
        
        return jsonify({
            'total_alfajores': total_alfajores,
            'by_marca': [{'name': m[0], 'count': m[1]} for m in marca_stats],
            'by_pais': [{'name': p[0], 'count': p[1]} for p in pais_stats],
            'by_sabor': [{'name': s[0], 'count': s[1]} for s in sabor_stats],
            'by_color': [{'name': c[0] or 'No especificado', 'count': c[1]} for c in color_stats],
            'by_platform': [{'name': p[0], 'count': p[1]} for p in platform_stats]
        })
        
    except Exception as e:
        return jsonify({'error': f'Error getting stats: {str(e)}'}), 500

@app.route('/api/images/<filename>')
def serve_image(filename):
    """Serve images from database or local files"""
    # First try to find image in database
    alfajor = Alfajor.query.filter_by(image_filename=filename).first()
    if alfajor and alfajor.image_data:
        # Decode base64 image data
        try:
            image_bytes = base64.b64decode(alfajor.image_data)
            return send_file(
                io.BytesIO(image_bytes),
                mimetype='image/jpeg',
                as_attachment=False,
                download_name=filename
            )
        except Exception as e:
            print(f"Error serving image from database: {e}")
    
    # Fallback to local file system (for existing images)
    image_path = os.path.join(app.config['IMAGES_FOLDER'], filename)
    if os.path.exists(image_path):
        return send_file(image_path)
    
    return jsonify({'error': 'Image not found'}), 404

# API status routes
@app.route('/')
def index():
    """API status endpoint"""
    return jsonify({
        "message": "Alfajores Collection Cloud API",
        "status": "running",
        "database": "cloud",
        "endpoints": {
            "mobile_alfajores": "/api/mobile/alfajores",
            "mobile_upload": "/api/mobile/upload-image",
            "alfajores": "/api/alfajores",
            "stats": "/api/stats", 
            "images": "/api/images/<filename>"
        },
        "total_alfajores": Alfajor.query.count(),
        "version": "2.0.0"
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        
    # Use PORT environment variable for deployment, default to 3000 for local
    port = int(os.environ.get('PORT', 3000))
    
    print("🚀 Starting Alfajores Collection - Cloud API Server")
    print(f"📱 API: http://localhost:{port}/api")
    print(f"📊 Health Check: http://localhost:{port}/api/health")
    print(f"📱 Mobile API: http://localhost:{port}/api/mobile/")
    
    app.run(debug=False, port=port, host='0.0.0.0')