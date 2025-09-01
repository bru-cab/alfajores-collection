#!/bin/bash
# Simple All-in-One Start Script for Alfajores Collection

echo "🍪 Starting Alfajores Collection - All-in-One Server"

# Kill any existing Flask processes on port 5000
echo "🔄 Stopping any existing servers..."
pkill -f "python.*app.py" 2>/dev/null
pkill -f "python.*http.server" 2>/dev/null

# Wait a moment for processes to stop
sleep 2

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies if needed
if [ ! -f "venv/installed" ]; then
    echo "📚 Installing dependencies..."
    pip install -r requirements.txt
    
    # Install poppler if needed (macOS)
    if command -v brew &> /dev/null; then
        echo "🔧 Installing poppler via Homebrew..."
        brew install poppler 2>/dev/null || echo "Poppler already installed or brew not available"
    fi
    
    touch venv/installed
fi

# Initialize database
echo "🗄️  Initializing database..."
cd backend
python init_db.py

# Start the all-in-one server
echo ""
echo "🚀 Starting All-in-One Server..."
echo "📱 Open in browser: http://localhost:3000"
echo "🔧 API available at: http://localhost:3000/api"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python app.py
