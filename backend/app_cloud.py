from flask import Flask, request, jsonify, send_file, Response
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_marshmallow import Marshmallow
from sqlalchemy import event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import defer
from datetime import datetime
import os
import sqlite3
import io
import base64
import json
import threading
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen, Request

# Initialize Flask app - serve both frontend and backend
app = Flask(__name__, static_folder='../static', static_url_path='/static')
CORS(app, origins=['*'])  # Allow all origins for search page deployment

# Configuration
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///alfajores.db')
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://')
DATABASE_KIND = 'sqlite' if DATABASE_URL.startswith('sqlite') else 'postgresql'

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
if DATABASE_URL.startswith('sqlite'):
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'connect_args': {
            'timeout': 60,
            'check_same_thread': False,
        }
    }
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['IMAGES_FOLDER'] = 'images'
BURGERS_DATA_FILE = os.environ.get('BURGERS_DATA_FILE', '/data/burgers.json')
BURGERS_STORE_LOCK = threading.Lock()

DEFAULT_LEGACY_IMAGE_BASES = [
    'https://alfajores-backend-bruno.fly.dev/api/images',
]
LEGACY_IMAGE_BASES = [
    base.strip().rstrip('/')
    for base in os.environ.get(
        'LEGACY_IMAGE_BASES',
        ','.join(DEFAULT_LEGACY_IMAGE_BASES),
    ).split(',')
    if base.strip()
]

# Initialize extensions
db = SQLAlchemy(app)
ma = Marshmallow(app)


@event.listens_for(Engine, "connect")
def configure_sqlite(dbapi_connection, connection_record):
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA busy_timeout=60000;")
        cursor.close()

# Create directories if they don't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['IMAGES_FOLDER'], exist_ok=True)

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
    image_url = db.Column(db.String(500), nullable=True)
    image_data = db.Column(db.Text, nullable=True)
    rating_tapa = db.Column(db.Integer, nullable=True)
    rating_relleno = db.Column(db.Integer, nullable=True)
    rating_sabor_general = db.Column(db.Integer, nullable=True)
    rating_tamano = db.Column(db.Integer, nullable=True)
    rating_overall = db.Column(db.Float, nullable=True)
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
alfajor_summary_schema = AlfajorSchema(exclude=('image_data',))
alfajores_summary_schema = AlfajorSchema(many=True, exclude=('image_data',))
pdf_schema = PDFDocumentSchema()


ALFAJOR_RATING_FIELDS = (
    'rating_tapa',
    'rating_relleno',
    'rating_sabor_general',
    'rating_tamano',
)

ALFAJOR_RATING_COLUMN_TYPES = {
    'rating_tapa': 'INTEGER',
    'rating_relleno': 'INTEGER',
    'rating_sabor_general': 'INTEGER',
    'rating_tamano': 'INTEGER',
    'rating_overall': 'FLOAT',
}


def get_total_alfajores():
    """Return a safe alfajor count even before the database is initialized."""
    try:
        return Alfajor.query.count()
    except OperationalError:
        return 0


def ensure_alfajor_schema():
    """Add columns introduced after the first Fly deployment."""
    inspector = inspect(db.engine)
    table_name = Alfajor.__table__.name

    if table_name not in inspector.get_table_names():
        return

    existing_columns = {column['name'] for column in inspector.get_columns(table_name)}

    for column_name, column_type in ALFAJOR_RATING_COLUMN_TYPES.items():
        if column_name in existing_columns:
            continue

        db.session.execute(
            text(f'ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}')
        )

    db.session.commit()


def normalize_rating_value(value):
    if value in (None, ''):
        return None

    rating = int(value)
    if rating < 1 or rating > 5:
        raise ValueError('Los puntajes deben estar entre 1 y 5')

    return rating


def extract_rating_values(data):
    ratings = {
        field: normalize_rating_value(data.get(field))
        for field in ALFAJOR_RATING_FIELDS
    }

    filled_values = [value for value in ratings.values() if value is not None]
    if filled_values and len(filled_values) != len(ALFAJOR_RATING_FIELDS):
        raise ValueError('Completá los cuatro puntajes o dejalos todos vacíos')

    overall = None
    if len(filled_values) == len(ALFAJOR_RATING_FIELDS):
        overall = round(sum(filled_values) / len(filled_values), 2)

    return ratings, overall


def apply_alfajor_payload(alfajor, data, is_new=False):
    required_fields = ('page_number', 'marca', 'sabor', 'pais')

    if is_new:
        missing_fields = [field for field in required_fields if not data.get(field)]
        if missing_fields:
            missing = ', '.join(missing_fields)
            raise ValueError(f'Faltan campos obligatorios: {missing}')

    if 'page_number' in data and data.get('page_number') not in (None, ''):
        alfajor.page_number = int(data['page_number'])

    for field in ('marca', 'sabor', 'pais', 'color', 'notas', 'image_filename', 'image_url', 'status'):
        if field in data:
            value = data[field]
            if isinstance(value, str):
                value = value.strip()

            if field in ('color', 'notas', 'image_filename', 'image_url'):
                setattr(alfajor, field, value or None)
            elif value not in (None, ''):
                setattr(alfajor, field, value)

    ratings, overall = extract_rating_values(data)
    for field, value in ratings.items():
        setattr(alfajor, field, value)
    alfajor.rating_overall = overall


def apply_alfajor_sort(query, sort_key):
    sort_date = db.func.coalesce(Alfajor.date_modified, Alfajor.date_added)

    if sort_key == 'page_desc':
        return query.order_by(Alfajor.page_number.desc())
    if sort_key == 'rating_desc':
        return query.order_by(
            Alfajor.rating_overall.is_(None),
            Alfajor.rating_overall.desc(),
            sort_date.desc(),
            Alfajor.page_number.asc(),
        )
    if sort_key == 'rating_asc':
        return query.order_by(
            Alfajor.rating_overall.is_(None),
            Alfajor.rating_overall.asc(),
            sort_date.desc(),
            Alfajor.page_number.asc(),
        )
    if sort_key == 'date_desc':
        return query.order_by(
            sort_date.is_(None),
            sort_date.desc(),
            Alfajor.page_number.desc(),
        )
    if sort_key == 'date_asc':
        return query.order_by(
            sort_date.is_(None),
            sort_date.asc(),
            Alfajor.page_number.asc(),
        )

    return query.order_by(Alfajor.page_number.asc())


def parse_iso_datetime(value):
    if not value or not isinstance(value, str):
        return None

    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None


def get_burger_sort_timestamp(item):
    parsed = parse_iso_datetime(item.get('dateModified') or item.get('dateAdded'))
    if parsed is None:
        return 0
    return int(parsed.timestamp())


def get_burger_storage_path():
    return Path(BURGERS_DATA_FILE)


def load_burgers_map():
    storage_path = get_burger_storage_path()
    if not storage_path.exists():
        return {}

    try:
        raw_content = storage_path.read_text(encoding='utf-8')
        if not raw_content.strip():
            return {}
        payload = json.loads(raw_content)
    except Exception as error:
        print(f'Warning: could not load burgers storage: {error}')
        return {}

    if isinstance(payload, list):
        mapped = {}
        for item in payload:
            if not isinstance(item, dict):
                continue
            burger_id = str(item.get('id') or '').strip()
            if not burger_id:
                continue
            mapped[burger_id] = item
        return mapped

    if not isinstance(payload, dict):
        return {}

    mapped = {}
    for key, value in payload.items():
        if not isinstance(value, dict):
            continue
        burger_id = str(value.get('id') or key or '').strip()
        if not burger_id:
            continue
        normalized = dict(value)
        normalized['id'] = burger_id
        mapped[burger_id] = normalized
    return mapped


def save_burgers_map(burgers_map):
    storage_path = get_burger_storage_path()
    storage_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = storage_path.with_suffix('.tmp')
    temp_path.write_text(json.dumps(burgers_map, ensure_ascii=False), encoding='utf-8')
    temp_path.replace(storage_path)


def normalize_burger_record(record):
    if not isinstance(record, dict):
        raise ValueError('Formato de burger inválido')

    burger_id = str(record.get('id') or '').strip()
    if not burger_id:
        raise ValueError('id es obligatorio para guardar burger')

    now_iso = datetime.utcnow().isoformat()
    normalized = dict(record)
    normalized['id'] = burger_id
    normalized['dateAdded'] = normalized.get('dateAdded') or now_iso
    normalized['dateModified'] = now_iso

    if not isinstance(normalized.get('ratings'), dict):
        normalized['ratings'] = {}
    if not isinstance(normalized.get('ratingComments'), dict):
        normalized['ratingComments'] = {}
    if not isinstance(normalized.get('images'), list):
        normalized['images'] = []

    try:
        normalized['overallScore'] = round(float(normalized.get('overallScore') or 0), 1)
    except Exception:
        normalized['overallScore'] = 0

    return normalized


def sort_burgers_list(items):
    def sort_key(item):
        score = float(item.get('overallScore') or 0)
        return (-score, -get_burger_sort_timestamp(item), str(item.get('id') or ''))

    return sorted(items, key=sort_key)


with app.app_context():
    db.create_all()
    ensure_alfajor_schema()

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'Alfajores API is running', 'database': DATABASE_KIND})

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
    sort = request.args.get('sort', 'page_desc')
    
    query = Alfajor.query.options(defer(Alfajor.image_data))
    
    # Apply filters
    if marca:
        query = query.filter(Alfajor.marca.ilike(f'%{marca}%'))
    if pais:
        query = query.filter(Alfajor.pais.ilike(f'%{pais}%'))
    if sabor:
        query = query.filter(Alfajor.sabor.ilike(f'%{sabor}%'))
    if status:
        query = query.filter(Alfajor.status == status)

    query = apply_alfajor_sort(query, sort)
    
    # Paginate results
    alfajores = query.paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    result = alfajores_summary_schema.dump(alfajores.items)
    
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
        
        alfajor = Alfajor()
        apply_alfajor_payload(alfajor, data, is_new=True)
        db.session.add(alfajor)
        db.session.commit()
        
        result = alfajor_summary_schema.dump(alfajor)
        return jsonify({
            'message': 'Alfajor saved successfully',
            'alfajor': result
        })
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error saving alfajor: {str(e)}'}), 500

@app.route('/api/alfajores/<int:page_number>', methods=['GET'])
def get_alfajor_by_page(page_number):
    """Get alfajor by page number."""
    alfajor = (
        Alfajor.query.options(defer(Alfajor.image_data))
        .filter_by(page_number=page_number)
        .first()
    )

    if alfajor is None:
        return jsonify({'error': 'Alfajor not found'}), 404

    return jsonify(alfajor_summary_schema.dump(alfajor))

@app.route('/api/alfajores/<int:alfajor_id>', methods=['PUT'])
def update_alfajor(alfajor_id):
    """Update an existing alfajor."""
    alfajor = Alfajor.query.get_or_404(alfajor_id)

    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        apply_alfajor_payload(alfajor, data)
        alfajor.date_modified = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'message': 'Alfajor updated successfully',
            'alfajor': alfajor_summary_schema.dump(alfajor)
        })
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error updating alfajor: {str(e)}'}), 500

@app.route('/api/alfajores/<int:alfajor_id>', methods=['DELETE'])
def delete_alfajor(alfajor_id):
    """Delete alfajor by id."""
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
    """Delete alfajor by page number."""
    try:
        alfajor = Alfajor.query.filter_by(page_number=page_number).first()
        if alfajor is None:
            return jsonify({'error': 'Alfajor not found'}), 404

        db.session.delete(alfajor)
        db.session.commit()
        return jsonify({'message': f'Alfajor from page {page_number} deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error deleting alfajor: {str(e)}'}), 500

@app.route('/api/alfajores/next-page', methods=['GET'])
def get_next_page():
    """Return the next available page number."""
    max_page = db.session.query(db.func.max(Alfajor.page_number)).scalar()
    next_page = (max_page or 0) + 1
    return jsonify({'next_page': next_page})

@app.route('/api/burgers', methods=['GET'])
def get_burgers():
    """Return persisted burgers list."""
    with BURGERS_STORE_LOCK:
        burgers_map = load_burgers_map()

    burgers = sort_burgers_list(list(burgers_map.values()))
    return jsonify({
        'burgers': burgers,
        'total': len(burgers)
    })


@app.route('/api/burgers', methods=['POST'])
def save_burger():
    """Create or update a burger review."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        burger = normalize_burger_record(data)

        with BURGERS_STORE_LOCK:
            burgers_map = load_burgers_map()
            existing = burgers_map.get(burger['id'])
            if existing and existing.get('dateAdded'):
                burger['dateAdded'] = existing['dateAdded']
            burgers_map[burger['id']] = burger
            save_burgers_map(burgers_map)

        return jsonify({
            'message': 'Burger saved successfully',
            'burger': burger
        })
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    except Exception as error:
        return jsonify({'error': f'Error saving burger: {error}'}), 500


@app.route('/api/burgers/<burger_id>', methods=['DELETE'])
def delete_burger(burger_id):
    """Delete a single burger review."""
    with BURGERS_STORE_LOCK:
        burgers_map = load_burgers_map()
        if burger_id not in burgers_map:
            return jsonify({'error': 'Burger not found'}), 404

        deleted = burgers_map.pop(burger_id)
        save_burgers_map(burgers_map)

    return jsonify({
        'message': 'Burger deleted successfully',
        'burger': deleted
    })


@app.route('/api/burgers', methods=['DELETE'])
def delete_all_burgers():
    """Delete all persisted burger reviews."""
    with BURGERS_STORE_LOCK:
        save_burgers_map({})

    return jsonify({'message': 'All burgers deleted successfully'})


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

        rated_alfajores = Alfajor.query.filter(Alfajor.rating_overall.isnot(None)).count()
        average_rating = db.session.query(db.func.avg(Alfajor.rating_overall)).scalar()

        return jsonify({
            'total_alfajores': total_alfajores,
            'rated_alfajores': rated_alfajores,
            'average_rating': round(float(average_rating), 2) if average_rating is not None else None,
            'by_marca': [{'name': m[0], 'count': m[1]} for m in marca_stats],
            'by_pais': [{'name': p[0], 'count': p[1]} for p in pais_stats],
            'by_sabor': [{'name': s[0], 'count': s[1]} for s in sabor_stats],
            'by_color': [{'name': c[0] or 'No especificado', 'count': c[1]} for c in color_stats]
        })
        
    except Exception as e:
        return jsonify({'error': f'Error getting stats: {str(e)}'}), 500

@app.route('/api/export', methods=['GET'])
def export_data():
    """Export all alfajores as JSON."""
    try:
        alfajores = (
            Alfajor.query.options(defer(Alfajor.image_data))
            .order_by(Alfajor.page_number.asc())
            .all()
        )
        return jsonify({
            'export_date': datetime.utcnow().isoformat(),
            'total_alfajores': len(alfajores),
            'alfajores': alfajores_summary_schema.dump(alfajores)
        })
    except Exception as e:
        return jsonify({'error': f'Error exporting data: {str(e)}'}), 500

@app.route('/api/dropdown-options', methods=['GET'])
def get_dropdown_options():
    """Get unique values used by the admin UI dropdowns."""
    try:
        marcas = db.session.query(Alfajor.marca).distinct().order_by(Alfajor.marca).all()
        sabores = db.session.query(Alfajor.sabor).distinct().order_by(Alfajor.sabor).all()
        paises = db.session.query(Alfajor.pais).distinct().order_by(Alfajor.pais).all()
        colores = (
            db.session.query(Alfajor.color)
            .filter(Alfajor.color.isnot(None))
            .filter(Alfajor.color != '')
            .distinct()
            .order_by(Alfajor.color)
            .all()
        )

        return jsonify({
            'marcas': [m[0] for m in marcas],
            'sabores': [s[0] for s in sabores],
            'paises': [p[0] for p in paises],
            'colores': [c[0] for c in colores]
        })
    except Exception as e:
        return jsonify({'error': f'Error getting dropdown options: {str(e)}'}), 500

@app.route('/api/images/<filename>')
def serve_image(filename):
    """Serve images from database or local files"""
    safe_filename = Path(filename).name
    if safe_filename != filename:
        return jsonify({'error': 'Invalid image filename'}), 400

    # First try to find image in database
    alfajor = Alfajor.query.filter_by(image_filename=safe_filename).first()
    if alfajor and alfajor.image_data:
        # Decode base64 image data
        try:
            image_bytes = base64.b64decode(alfajor.image_data)
            return send_file(
                io.BytesIO(image_bytes),
                mimetype='image/jpeg',
                as_attachment=False,
                download_name=safe_filename
            )
        except Exception as e:
            print(f"Error serving image from database: {e}")

    candidate_filenames = [safe_filename]
    page_stem = Path(safe_filename).stem
    page_ext = Path(safe_filename).suffix.lower()

    # Fly deploy commonly ships only the lighter JPEG companion images.
    if page_ext == '.png' and safe_filename.startswith('page_'):
        candidate_filenames.append(f"{page_stem}_1.jpg")

    if page_ext == '.jpg':
        candidate_filenames.append(f"{page_stem}.jpeg")
    elif page_ext == '.jpeg':
        candidate_filenames.append(f"{page_stem}.jpg")

    search_dirs = [
        app.config['IMAGES_FOLDER'],
        app.config['UPLOAD_FOLDER'],
        '/data/images',
        '/data/uploads',
        '/data',
    ]

    for directory in search_dirs:
        for candidate in candidate_filenames:
            image_path = os.path.join(directory, candidate)
            if os.path.exists(image_path) and os.path.isfile(image_path):
                return send_file(image_path)

    # Last network fallback: try legacy backends that still host historical images.
    current_host = request.host_url.rstrip('/')
    for legacy_base in LEGACY_IMAGE_BASES:
        if legacy_base.startswith(current_host):
            continue

        for candidate in candidate_filenames:
            legacy_url = f'{legacy_base}/{quote(candidate)}'
            try:
                req = Request(legacy_url, headers={'User-Agent': 'smash-sweet-image-fallback/1.0'})
                with urlopen(req, timeout=6) as response:
                    status = getattr(response, 'status', response.getcode())
                    if status != 200:
                        continue

                    content_type = response.headers.get('Content-Type', '')
                    if not content_type.lower().startswith('image/'):
                        continue

                    image_bytes = response.read()
                    if not image_bytes:
                        continue

                    # Cache recovered image on the mounted volume when available.
                    try:
                        cache_dir = Path('/data/uploads')
                        cache_dir.mkdir(parents=True, exist_ok=True)
                        (cache_dir / candidate).write_bytes(image_bytes)
                    except Exception as cache_error:
                        print(f'Image cache warning for {candidate}: {cache_error}')

                    return send_file(
                        io.BytesIO(image_bytes),
                        mimetype=content_type.split(';', 1)[0],
                        as_attachment=False,
                        download_name=candidate,
                    )
            except Exception:
                continue

    # Last resort: return an inline placeholder image so clients don't render broken-image icons.
    placeholder_svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600">'
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0%" stop-color="#f3f4f6"/><stop offset="100%" stop-color="#e5e7eb"/>'
        '</linearGradient></defs>'
        '<rect width="1200" height="1600" fill="url(#g)"/>'
        '<text x="50%" y="46%" text-anchor="middle" font-size="220">🍪</text>'
        '<text x="50%" y="56%" text-anchor="middle" font-size="56" fill="#4b5563" '
        'font-family="Arial, sans-serif">Imagen no disponible</text>'
        '</svg>'
    )
    response = Response(placeholder_svg, mimetype='image/svg+xml')
    response.headers['X-Image-Status'] = 'missing'
    response.headers['Cache-Control'] = 'public, max-age=120'
    return response

# API status routes
@app.route('/')
def index():
    """Serve the public gallery UI."""
    try:
        return send_file('search.html', mimetype='text/html')
    except FileNotFoundError:
        return api_info()

@app.route('/search')
def search_page():
    """Serve the public gallery UI."""
    try:
        return send_file('search.html', mimetype='text/html')
    except FileNotFoundError:
        return api_info()

@app.route('/admin')
@app.route('/categorization')
def admin_page():
    """Serve the admin/categorization UI."""
    try:
        return send_file('index.html', mimetype='text/html')
    except FileNotFoundError:
        return api_info()

@app.route('/styles.css')
def serve_styles():
    """Serve admin UI stylesheet."""
    try:
        return send_file('styles.css', mimetype='text/css')
    except FileNotFoundError:
        return '', 404

@app.route('/script.js')
def serve_script():
    """Serve admin UI script."""
    try:
        return send_file('script.js', mimetype='application/javascript')
    except FileNotFoundError:
        return '', 404

@app.route('/Adobe Scan Aug 29, 2025.pdf')
def serve_seed_pdf():
    """Serve the bundled reference PDF used by the admin UI."""
    try:
        return send_file('Adobe Scan Aug 29, 2025.pdf', mimetype='application/pdf')
    except FileNotFoundError:
        return '', 404

@app.route('/api')
def api_info():
    """API status endpoint."""
    return jsonify({
        "message": "Smash & Sweet API",
        "status": "running",
        "database": DATABASE_KIND,
        "endpoints": {
            "web_interface": "/",
            "search_page": "/search",
            "categorization_page": "/categorization",
            "legacy_admin_page": "/admin",
            "alfajores": "/api/alfajores",
            "burgers": "/api/burgers",
            "stats": "/api/stats", 
            "images": "/api/images/<filename>"
        },
        "total_alfajores": get_total_alfajores(),
        "version": "2.0.0"
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        
    # Use PORT environment variable for deployment, default to 3000 for local
    port = int(os.environ.get('PORT', 3000))
    
    print("🚀 Starting Smash & Sweet Server")
    print(f"📱 API: http://localhost:{port}/api")
    print(f"📊 Health Check: http://localhost:{port}/api/health")
    
    app.run(debug=False, port=port, host='0.0.0.0')
