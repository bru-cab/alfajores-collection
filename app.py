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
from app import app

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    app.run(debug=False, port=port, host='0.0.0.0')

