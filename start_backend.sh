#!/bin/bash
# Start script for Smash & Sweet Backend

echo "🚀 Starting Smash & Sweet Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📚 Installing dependencies..."
pip install -r backend/requirements.txt

# Install additional dependencies for PDF processing
echo "🔧 Installing system dependencies for PDF processing..."
if command -v brew &> /dev/null; then
    echo "Installing poppler via Homebrew..."
    brew install poppler
elif command -v apt-get &> /dev/null; then
    echo "Installing poppler via apt-get..."
    sudo apt-get update && sudo apt-get install -y poppler-utils
elif command -v yum &> /dev/null; then
    echo "Installing poppler via yum..."
    sudo yum install -y poppler-utils
else
    echo "⚠️  Please install poppler manually for your system"
    echo "   macOS: brew install poppler"
    echo "   Ubuntu/Debian: sudo apt-get install poppler-utils"
    echo "   CentOS/RHEL: sudo yum install poppler-utils"
fi

# Initialize database
echo "🗄️  Initializing database..."
cd backend
python init_db.py

# Start the backend server
echo "🌐 Starting Flask server on http://localhost:5000..."
python app.py
