# 🌐 Cloud Database Setup Guide

## 📋 **Overview**

This guide will help you set up a cloud database that both your iOS app and Render web backend can access. You'll have real-time sync between mobile and web!

## 🛠️ **Option 1: PostgreSQL on Render (Recommended)**

### **Step 1: Add PostgreSQL to Your Render Account**

1. **Go to [render.com](https://render.com)** and log into your account
2. **Click "New +"** → **"PostgreSQL"**
3. **Configure Database:**
   - **Name**: `alfajores-db`
   - **Region**: Same as your web service
   - **Plan**: Free tier (suitable for development)
4. **Click "Create Database"**

### **Step 2: Get Connection Details**

After creation, you'll see:
- **Internal Database URL**: `postgres://username:password@hostname:5432/database_name`
- **External Database URL**: For connecting from outside Render

**Copy the Internal Database URL** - you'll need it!

### **Step 3: Update Your Render Web Service**

1. **Go to your existing web service** on Render
2. **Click "Environment"** tab
3. **Add Environment Variable:**
   - **Key**: `DATABASE_URL`
   - **Value**: The Internal Database URL from Step 2
4. **Click "Save Changes"**

### **Step 4: Deploy Updated Backend**

Replace your current `backend/app.py` with the new cloud version:

```bash
cd /Users/bruno/Documents/alfajores/backend
cp app.py app_local_backup.py
cp app_cloud.py app.py
```

Add PostgreSQL to requirements:

```bash
echo "psycopg2-binary==2.9.7" >> requirements.txt
```

**Deploy to Render:**
- Your service will automatically redeploy
- Check logs to ensure database connection works

### **Step 5: Update iOS App Configuration**

In `APIClient.swift`, update the `baseURL`:

```swift
private let baseURL = "https://YOUR-APP-NAME.onrender.com/api"
```

Replace `YOUR-APP-NAME` with your actual Render app name.

## 🚀 **Option 2: Supabase (Alternative)**

If you prefer a managed solution:

### **Step 1: Create Supabase Project**
1. Go to [supabase.com](https://supabase.com)
2. Create free account
3. "New Project" → Name: "alfajores"

### **Step 2: Get API Details**
- **URL**: `https://your-project.supabase.co`
- **Anon Key**: For public access

### **Step 3: Create Tables**
Run this SQL in Supabase dashboard:

```sql
CREATE TABLE alfajores (
    id SERIAL PRIMARY KEY,
    page_number INTEGER UNIQUE NOT NULL,
    marca VARCHAR(100) NOT NULL,
    sabor VARCHAR(100) NOT NULL,
    pais VARCHAR(100) NOT NULL,
    color VARCHAR(50),
    notas TEXT,
    image_filename VARCHAR(255),
    image_url VARCHAR(500),
    date_added TIMESTAMP DEFAULT NOW(),
    date_modified TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'categorized',
    created_from VARCHAR(20) DEFAULT 'web'
);
```

## 📱 **Testing the Setup**

### **Step 1: Test Backend Health**
```bash
curl https://your-app-name.onrender.com/api/health
```

Should return:
```json
{
  "status": "healthy",
  "database": "cloud",
  "message": "Alfajores API is running"
}
```

### **Step 2: Test iOS App**
1. **Build and install** updated iOS app
2. **Check connectivity** in the app
3. **Add a new alfajor** from mobile
4. **Check your web interface** - should show mobile data!

### **Step 3: Test Data Sync**
1. **Add alfajor via web interface**
2. **Refresh iOS app** - should show web data
3. **Add alfajor via iOS app**
4. **Check web interface** - should show mobile data

## 🔧 **Migration from SQLite**

If you have existing data in SQLite:

### **Export from SQLite:**
```python
import sqlite3
import json

conn = sqlite3.connect('backend/instance/alfajores.db')
cursor = conn.cursor()

cursor.execute("SELECT * FROM alfajor")
rows = cursor.fetchall()
columns = [description[0] for description in cursor.description]

alfajores = []
for row in rows:
    alfajor = dict(zip(columns, row))
    alfajores.append(alfajor)

with open('alfajores_export.json', 'w') as f:
    json.dump(alfajores, f, indent=2, default=str)

print(f"Exported {len(alfajores)} alfajores to alfajores_export.json")
```

### **Import to PostgreSQL:**
Use the existing `/api/import` endpoint on your cloud backend.

## 🌟 **Features You'll Get**

### **✅ Real-time Sync**
- Add alfajor on iPhone → Appears on web instantly
- Add alfajor on web → Appears on iPhone instantly

### **✅ Offline Support**
- iOS app works offline
- Syncs when connection restored

### **✅ Image Storage**
- Images uploaded from iPhone
- Accessible from web interface

### **✅ Cross-platform Statistics**
- Combined stats from mobile + web
- Platform breakdown (iOS vs Web usage)

### **✅ Backup & Recovery**
- Cloud database is automatically backed up
- No risk of losing data

## 🔐 **Security Notes**

- Database is private to your Render account
- iOS app connects via HTTPS
- Images are served securely
- No authentication required for demo (add later if needed)

## 📊 **Monitoring**

### **Check Database Status:**
```bash
curl https://your-app-name.onrender.com/api/stats
```

### **Monitor Usage:**
- Render dashboard shows database connections
- API logs show mobile vs web usage

## 🆘 **Troubleshooting**

### **"Database connection failed"**
- Check `DATABASE_URL` environment variable
- Ensure PostgreSQL service is running
- Check Render logs

### **iOS app shows "offline"**
- Verify `baseURL` in `APIClient.swift`
- Check internet connection
- Test backend health endpoint

### **Data not syncing**
- Check API logs for errors
- Verify JSON format matches
- Test individual API endpoints

---

**Once set up, you'll have a production-ready system where your iPhone alfajor categorizations automatically sync with your web interface! 🎉📱💻**
