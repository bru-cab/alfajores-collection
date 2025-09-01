# 🍪 Alfajores Collection Manager

A comprehensive system for managing and cataloging your alfajor collection, featuring both a web interface and native iOS app with cloud synchronization.

## 📱 **Features**

### **Web Interface**
- 📊 **Collection Management**: Add, edit, and view alfajores
- 🔍 **Advanced Search**: Filter by marca, país, sabor, color
- 📈 **Statistics Dashboard**: Collection analytics and insights
- 📄 **PDF Processing**: Extract images from PDF documents
- 🖼️ **Image Gallery**: View and manage alfajor photos

### **iOS Mobile App**
- 📷 **Camera Integration**: Take photos directly
- 📚 **Photo Library**: Import existing photos
- 🏷️ **Easy Categorization**: Quick alfajor details entry
- 🔄 **Cloud Sync**: Real-time synchronization with web
- 📱 **Offline Mode**: Works without internet, syncs when connected
- 🔍 **Mobile Search**: Find alfajores on the go

### **Cloud Backend**
- 🌐 **PostgreSQL Database**: Scalable cloud storage
- 🔄 **Real-time Sync**: Instant updates across platforms
- 📸 **Image Storage**: Compressed images in database
- 🚀 **API-first**: RESTful API for extensibility

## 🛠️ **Tech Stack**

### **Backend**
- **Python 3.10+**
- **Flask** - Web framework
- **SQLAlchemy** - Database ORM
- **PostgreSQL** - Cloud database
- **Flask-CORS** - Cross-origin requests
- **Marshmallow** - Data serialization
- **pdf2image** - PDF processing
- **Pillow** - Image processing

### **Frontend Web**
- **HTML5/CSS3/JavaScript**
- **Responsive Design**
- **Local Storage** fallback

### **iOS App**
- **Swift 5.0+**
- **SwiftUI** - Modern UI framework
- **Core Data** - Local storage
- **PDFKit** - PDF handling
- **PhotosUI** - Photo library access
- **UIImagePickerController** - Camera integration

### **Cloud Infrastructure**
- **Render.com** - Backend hosting
- **PostgreSQL** - Managed database
- **Base64 Image Storage** - No file system dependencies

## 🚀 **Quick Start**

### **1. Backend Setup**

```bash
# Clone repository
git clone <your-repo-url>
cd alfajores

# Setup Python environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
cd backend
pip install -r requirements.txt

# Setup environment variables
export DATABASE_URL="your-postgresql-url"

# Run development server
python app.py
```

### **2. iOS App Setup**

```bash
# Open Xcode project
cd AlfajoresApp
open AlfajoresApp.xcodeproj

# Update API URL in APIClient.swift
# Build and run on simulator or device
```

### **3. Deploy to Render**

1. **Create Render account** at [render.com](https://render.com)
2. **Connect your repository**
3. **Add environment variable**: `DATABASE_URL`
4. **Deploy automatically**

## 📊 **Database Schema**

### **Alfajor Table**
```sql
CREATE TABLE alfajor (
    id SERIAL PRIMARY KEY,
    page_number INTEGER UNIQUE NOT NULL,
    marca VARCHAR(100) NOT NULL,
    sabor VARCHAR(100) NOT NULL,
    pais VARCHAR(100) NOT NULL,
    color VARCHAR(50),
    notas TEXT,
    image_filename VARCHAR(255),
    image_url VARCHAR(500),
    image_data TEXT,  -- Base64 encoded images
    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'categorized',
    created_from VARCHAR(20) DEFAULT 'web'  -- 'web' or 'ios'
);
```

## 🌐 **API Endpoints**

### **Web Endpoints**
- `GET /api/alfajores` - List alfajores
- `POST /api/alfajores` - Create alfajor
- `PUT /api/alfajores/<id>` - Update alfajor
- `DELETE /api/alfajores/<id>` - Delete alfajor
- `GET /api/stats` - Collection statistics
- `GET /api/images/<filename>` - Serve images

### **Mobile Endpoints**
- `GET /api/mobile/alfajores` - Mobile-optimized list
- `POST /api/mobile/alfajores` - Create/update from mobile
- `POST /api/mobile/upload-image` - Upload photos
- `POST /api/mobile/sync` - Sync offline data

### **Utility Endpoints**
- `GET /api/health` - System health check
- `POST /api/import` - Import data
- `GET /api/export` - Export collection

## 📱 **iOS App Architecture**

```
ContentView (TabView)
├── PDFImportView (PDF upload + Camera)
├── CategoryView (Alfajor categorization)
├── SearchView (Search and filter)
└── StatsView (Statistics dashboard)

Services/
├── APIClient (Cloud communication)
├── CloudDataManager (Data management)
└── ImageProcessor (Image handling)
```

## 🔄 **Data Flow**

```
📱 iPhone App ←→ 🌐 Cloud API ←→ 💻 Web Interface
                     ↓
              🗄️ PostgreSQL Database
                     ↓
              📸 Base64 Images
```

## 🛡️ **Data Migration**

### **From SQLite to PostgreSQL**
```bash
# Run migration script
cd backend
python migrate_alfajores_only.py

# Migrate images to database
python migrate_images_to_db.py
```

### **Image Optimization**
- **Original**: 3-4MB PNG files
- **Optimized**: 150-200KB JPEG (~95% compression)
- **Storage**: Base64 in PostgreSQL TEXT field
- **Serving**: Real-time decoding and delivery

## 📦 **Project Structure**

```
alfajores/
├── backend/                    # Flask backend
│   ├── app.py                 # Main application
│   ├── app_cloud.py          # Cloud-enabled version
│   ├── requirements.txt       # Python dependencies
│   ├── migrate_*.py          # Database migration scripts
│   └── instance/             # Local database
├── AlfajoresApp/              # iOS application
│   ├── AlfajoresApp.xcodeproj # Xcode project
│   ├── AlfajoresApp/         # Swift source code
│   │   ├── ContentView.swift # Main UI
│   │   ├── Services/         # API and data services
│   │   ├── Core/            # Core data management
│   │   └── Views/           # Individual view components
│   └── README.md            # iOS setup guide
├── docs/                     # Documentation
├── deploy/                   # Deployment files
└── *.html                   # Web frontend files
```

## 🔧 **Configuration**

### **Environment Variables**
```bash
# Required for cloud deployment
DATABASE_URL=postgresql://user:pass@host/db

# Optional
DEBUG=false
PORT=3000
```

### **iOS Configuration**
Update `APIClient.swift`:
```swift
private let baseURL = "https://your-app.onrender.com/api"
```

## 📊 **Statistics & Analytics**

- **Total alfajores** in collection
- **Distribution by marca** (brand)
- **Geographic distribution** (país)
- **Flavor analysis** (sabor)
- **Color categorization**
- **Platform usage** (iOS vs Web)
- **Collection growth** over time

## 🚀 **Deployment**

### **Backend (Render)**
1. Connect GitHub repository
2. Set environment variables
3. Auto-deploy on push

### **iOS App**
1. Connect device to Xcode
2. Build and install
3. Trust developer certificate

## 🐛 **Troubleshooting**

### **Common Issues**
- **Database connection failed**: Check `DATABASE_URL`
- **Images not loading**: Verify Base64 data migration
- **iOS app offline**: Update API URL
- **Build errors**: Clean and rebuild Xcode project

### **Debugging**
```bash
# Check backend health
curl https://your-app.onrender.com/api/health

# View logs
heroku logs --tail  # If using Heroku
# Or check Render dashboard logs
```

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 **License**

This project is open source and available under the [MIT License](LICENSE).

## 🙏 **Acknowledgments**

- **Flask** community for excellent web framework
- **Apple** for SwiftUI and iOS development tools
- **Render** for reliable cloud hosting
- **PostgreSQL** for robust database solutions

---

**🍪 Happy alfajor collecting!** 

*Track, categorize, and enjoy your alfajor journey across web and mobile platforms.*