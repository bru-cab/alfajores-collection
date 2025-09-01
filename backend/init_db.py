#!/usr/bin/env python3
"""
Database initialization script for Alfajores Collection API
"""

import os
import sys
from app import app, db, Alfajor, PDFDocument
from sqlalchemy import text

def init_database():
    """Initialize the database with tables and sample data"""
    
    print("🚀 Initializing Alfajores Collection Database...")
    
    with app.app_context():
        try:
            # Drop all tables (be careful in production!)
            print("📝 Dropping existing tables...")
            db.drop_all()
            
            # Create all tables
            print("🏗️  Creating database tables...")
            db.create_all()
            
            # Verify tables were created
            result = db.session.execute(text("SELECT name FROM sqlite_master WHERE type='table';"))
            tables = result.fetchall()
            print(f"✅ Created tables: {[table[0] for table in tables]}")
            
            print("✨ Database initialized successfully!")
            print("\n📋 Next steps:")
            print("1. Start the backend server: python backend/app.py")
            print("2. Upload your PDF through the web interface")
            print("3. Start categorizing your alfajores!")
            
        except Exception as e:
            print(f"❌ Error initializing database: {e}")
            sys.exit(1)

def create_sample_data():
    """Create some sample data for testing"""
    
    print("📊 Creating sample data...")
    
    sample_alfajores = [
        {
            'page_number': 1,
            'marca': 'Havanna',
            'sabor': 'Dulce de leche',
            'pais': 'Argentina',
            'tipo': 'Premium',
            'tamaño': 'Grande',
            'cobertura': 'Chocolate',
            'año': 2023,
            'rareza': 'Común',
            'notas': 'Alfajor clásico argentino'
        },
        {
            'page_number': 2,
            'marca': 'Cachafaz',
            'sabor': 'Chocolate',
            'pais': 'Argentina',
            'tipo': 'Tradicional',
            'tamaño': 'Mediano',
            'cobertura': 'Chocolate negro',
            'año': 2022,
            'rareza': 'Poco común',
            'notas': 'Tradicional porteño'
        },
        {
            'page_number': 3,
            'marca': 'Jorgito',
            'sabor': 'Dulce de leche',
            'pais': 'Argentina',
            'tipo': 'Industrial',
            'tamaño': 'Chico',
            'cobertura': 'Coco',
            'año': 2023,
            'rareza': 'Común',
            'notas': 'Alfajor popular y económico'
        }
    ]
    
    with app.app_context():
        try:
            for data in sample_alfajores:
                alfajor = Alfajor(**data)
                db.session.add(alfajor)
            
            db.session.commit()
            print(f"✅ Created {len(sample_alfajores)} sample alfajores")
            
        except Exception as e:
            print(f"❌ Error creating sample data: {e}")
            db.session.rollback()

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--with-samples":
        init_database()
        create_sample_data()
    else:
        init_database()
