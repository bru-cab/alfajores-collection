"""
Wrapper to run the backend app from root directory.
This allows Render's start command 'python app.py' to work.
"""
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Change to backend directory so relative paths work
os.chdir(os.path.join(os.path.dirname(__file__), 'backend'))

# Import and run the app
from app import app, db

if __name__ == '__main__':
    # Initialize database tables
    with app.app_context():
        db.create_all()
        print("✅ Database tables created/verified")
    
    port = int(os.environ.get('PORT', 3000))
    
    print("🚀 Starting Alfajores Collection Backend (app.py)")
    print(f"📱 Frontend: http://localhost:{port}")
    print(f"🔧 API: http://localhost:{port}/api")
    print(f"📊 Health Check: http://localhost:{port}/api/health")
    print(f"📝 Categorization: http://localhost:{port}/categorization")
    
    app.run(debug=False, port=port, host='0.0.0.0')

