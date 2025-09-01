# iOS App Deployment Guide

## Overview
Your iOS app now has 3 clear sections:
1. **Subir** - Upload images from camera, gallery, or PDF
2. **Categorizar** - Categorize alfajores and save to PostgreSQL
3. **Ver Todo** - View all data like the Render web interface

## Manual Xcode Setup (Required)

Since Xcode projects can't be created via command line easily, follow these steps:

### 1. Create New Xcode Project
```bash
# Open Xcode
open -a Xcode
```

1. Choose "Create a new Xcode project"
2. Select "iOS" → "App"
3. Product Name: `AlfajoresApp`
4. Interface: SwiftUI
5. Language: Swift
6. Save in: `/Users/bruno/Documents/alfajores/`

### 2. Replace Default Files

Copy these files from the current structure to your new Xcode project:

**Main App File:**
- `AlfajoresApp/AlfajoresAppApp.swift` → Replace the default App file

**Views Folder:**
- `AlfajoresApp/Views/ContentView.swift` → Replace default ContentView
- `AlfajoresApp/Views/UploadView.swift` → Add to project
- `AlfajoresApp/Views/CategoryView.swift` → Add to project  
- `AlfajoresApp/Views/ViewAllDataView.swift` → Add to project

**Services Folder:**
- `AlfajoresApp/Services/APIClient.swift` → Add to project

**Core Folder:**
- `AlfajoresApp/Core/ImageManager.swift` → Add to project

### 3. Add Required Frameworks

In Xcode project settings, add these frameworks:
- `PDFKit.framework`
- `PhotosUI.framework`

### 4. Update Info.plist

Add these permissions:
```xml
<key>NSCameraUsageDescription</key>
<string>This app needs camera access to take photos of alfajores</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>This app needs photo library access to import alfajor images</string>
```

### 5. Configure Backend URL

In `APIClient.swift`, the backend URL is already set to:
```swift
private let baseURL = "https://alfajores-backend.onrender.com/api"
```

## Features

### Upload Section
- ✅ Take photos with camera
- ✅ Import from photo library
- ✅ Import and convert PDF to image
- ✅ Preview selected image
- ✅ Clear/reset functionality

### Categorization Section  
- ✅ Shows current uploaded image
- ✅ Form fields: Marca, Sabor, País, Color, Notas
- ✅ Validates required fields
- ✅ Uploads image to backend
- ✅ Saves categorization data to PostgreSQL
- ✅ Shows connection status
- ✅ Success/error feedback

### View All Section
- ✅ Displays all alfajores like web interface
- ✅ Search functionality
- ✅ Pagination (load more)
- ✅ Pull to refresh
- ✅ Shows total count
- ✅ Formatted like web cards
- ✅ Connection status indicator

## Backend Integration

The app connects to your PostgreSQL backend at:
`https://alfajores-backend.onrender.com`

### API Endpoints Used:
- `GET /api/health` - Connection check
- `POST /api/mobile/upload-image` - Image upload
- `POST /api/mobile/alfajores` - Create alfajor
- `GET /api/mobile/alfajores` - Fetch alfajores list

## Next Steps

1. Create the Xcode project manually
2. Add all the source files
3. Build and test on simulator
4. Deploy to your iPhone using the same steps as before:
   - Connect iPhone
   - Select your device in Xcode
   - Click Run
   - Trust the developer certificate on iPhone

## App Structure

```
AlfajoresApp/
├── AlfajoresAppApp.swift          # Main app entry point
├── Views/
│   ├── ContentView.swift          # Main tab view
│   ├── UploadView.swift           # Camera/gallery/PDF upload
│   ├── CategoryView.swift         # Categorization form
│   └── ViewAllDataView.swift      # Display all data
├── Services/
│   └── APIClient.swift            # Backend communication
└── Core/
    └── ImageManager.swift         # Shared image state
```

The app now provides a complete workflow: Upload → Categorize → View, all connected to your PostgreSQL database!
