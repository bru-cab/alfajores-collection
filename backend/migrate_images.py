"""
Migrate local images to database as base64 for cloud deployment
"""
import os
import base64
import requests
from app import app, db, Alfajor

def migrate_images_to_database():
    """Upload local images to database as base64"""
    with app.app_context():
        images_dir = app.config['IMAGES_FOLDER']
        updated_count = 0
        
        # Get all alfajores that have image_filename but no image_data
        alfajores = Alfajor.query.filter(
            Alfajor.image_filename.isnot(None),
            Alfajor.image_data.is_(None)
        ).all()
        
        print(f"Found {len(alfajores)} alfajores with local images to migrate")
        
        for alfajor in alfajores:
            image_path = os.path.join(images_dir, alfajor.image_filename)
            
            if os.path.exists(image_path):
                try:
                    # Read and encode image
                    with open(image_path, 'rb') as img_file:
                        image_bytes = img_file.read()
                        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                    
                    # Store in database
                    alfajor.image_data = image_base64
                    updated_count += 1
                    
                    print(f"✅ Migrated image for page {alfajor.page_number}: {alfajor.marca} - {alfajor.sabor}")
                    
                except Exception as e:
                    print(f"❌ Error migrating {alfajor.image_filename}: {e}")
            else:
                print(f"⚠️  Image file not found: {image_path}")
        
        if updated_count > 0:
            db.session.commit()
            print(f"\n✅ Successfully migrated {updated_count} images to database")
        else:
            print("\n⚠️  No images to migrate")
        
        return updated_count

def upload_images_to_cloud():
    """Upload migrated images to cloud database via API"""
    with app.app_context():
        alfajores = Alfajor.query.filter(Alfajor.image_data.isnot(None)).all()
        
        print(f"\nUploading {len(alfajores)} images to cloud database...")
        
        cloud_url = input("Enter your Render URL (e.g., https://alfajores-backend.onrender.com): ").strip()
        
        for alfajor in alfajores:
            try:
                data = {
                    'page_number': alfajor.page_number,
                    'marca': alfajor.marca,
                    'sabor': alfajor.sabor,
                    'pais': alfajor.pais,
                    'color': alfajor.color,
                    'notas': alfajor.notas,
                    'image_filename': alfajor.image_filename,
                    'image_data': alfajor.image_data,
                    'status': alfajor.status
                }
                
                response = requests.post(f"{cloud_url}/api/alfajores", json=data)
                
                if response.ok:
                    print(f"✅ Uploaded page {alfajor.page_number}: {alfajor.marca}")
                else:
                    print(f"❌ Failed page {alfajor.page_number}: {response.text}")
                    
            except Exception as e:
                print(f"❌ Error uploading page {alfajor.page_number}: {e}")

if __name__ == '__main__':
    print("🖼️  Image Migration Tool\n")
    print("Step 1: Migrate local images to local database...")
    migrate_images_to_database()
    
    print("\n" + "="*60)
    upload = input("\nStep 2: Upload to cloud? (y/n): ").strip().lower()
    
    if upload == 'y':
        upload_images_to_cloud()
        print("\n✅ Migration complete!")
    else:
        print("\n💡 To upload later, run this script again")

