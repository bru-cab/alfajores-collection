#!/usr/bin/env python3
"""
Script para actualizar los datos del sitio estático
"""
import json
import requests
from datetime import datetime
import sys

def update_data():
    try:
        print("🔄 Descargando datos del API local...")
        
        # Download data from local API
        response = requests.get('http://localhost:3000/api/alfajores?per_page=1000')
        response.raise_for_status()
        
        data = response.json()
        alfajores = data['alfajores']
        
        print(f"📊 Descargados {len(alfajores)} alfajores")
        
        # Process image URLs
        for alfajor in alfajores:
            if alfajor.get('image_filename'):
                # Option 1: GitHub Pages (change 'yourusername' and 'repository-name')
                # alfajor['image_url'] = f"https://yourusername.github.io/repository-name/images/{alfajor['image_filename']}"
                
                # Option 2: Keep local reference for now
                alfajor['image_url'] = f"images/{alfajor['image_filename']}"
            else:
                alfajor['image_url'] = None
        
        # Generate data.js
        js_content = f'''// Datos de la colección de alfajores
// Generado automáticamente el {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

const alfajoresData = {{
    "lastUpdate": "{datetime.now().strftime('%d/%m/%Y %H:%M:%S')}",
    "alfajores": {json.dumps(alfajores, indent=2, ensure_ascii=False)}
}};'''
        
        with open('data.js', 'w', encoding='utf-8') as f:
            f.write(js_content)
        
        print("✅ data.js actualizado correctamente")
        print("🌐 Sube el archivo a GitHub/Netlify para actualizar el sitio")
        
    except requests.exceptions.ConnectionError:
        print("❌ Error: No se puede conectar al API local")
        print("💡 Asegúrate de que el backend esté funcionando en http://localhost:3000")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    update_data()
