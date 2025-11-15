#!/usr/bin/env python3
"""
Fix common sabor inconsistencies in the database
"""
import requests
import json

API_BASE = 'https://alfajores-backend.onrender.com/api'

def normalize(value):
    if not value:
        return 'no especificado'
    return value.strip().lower()

# Common fixes - map normalized to preferred capitalization
FIXES = {
    'dulce de leche': 'Dulce de leche',
    'blanco': 'Blanco',
    'negro': 'Negro',
    'chocolate': 'Chocolate',
}

def fix_sabores():
    print("Cargando datos de producción...")
    
    # Fetch all alfajores
    all_alfajores = []
    page = 1
    per_page = 500
    
    while True:
        response = requests.get(f"{API_BASE}/alfajores?page={page}&per_page={per_page}")
        if not response.ok:
            print(f"Error: {response.status_code}")
            break
        
        data = response.json()
        all_alfajores.extend(data.get('alfajores', []))
        
        if page >= data.get('pages', 1):
            break
        page += 1
    
    print(f"✓ Cargados {len(all_alfajores)} alfajores\n")
    
    fixes_made = 0
    
    print("Aplicando correcciones...")
    print("=" * 80)
    
    for alfajor in all_alfajores:
        sabor_raw = alfajor.get('sabor', '') or ''
        sabor_normalized = normalize(sabor_raw)
        
        # Check if this needs fixing
        if sabor_normalized in FIXES:
            preferred = FIXES[sabor_normalized]
            
            # Only fix if it's different
            if sabor_raw != preferred:
                alfajor_id = alfajor.get('id')
                page_num = alfajor.get('page_number')
                
                # Update via API
                update_data = {'sabor': preferred}
                response = requests.put(
                    f"{API_BASE}/alfajores/{alfajor_id}",
                    json=update_data,
                    headers={'Content-Type': 'application/json'}
                )
                
                if response.ok:
                    print(f"✓ Fixed: Page {page_num:3d} - '{sabor_raw}' → '{preferred}'")
                    fixes_made += 1
                else:
                    print(f"✗ Error fixing Page {page_num}: {response.status_code}")
    
    print("=" * 80)
    print(f"\n✅ Correcciones aplicadas: {fixes_made}")

if __name__ == '__main__':
    try:
        import requests
        fix_sabores()
    except ImportError:
        print("Error: requests module not found. Install with: pip install requests")
        print("\nOr use the manual fix commands below:")
        print("\nTo fix 'dulce de leche' → 'Dulce de leche':")
        print("  Find entries with lowercase and update them via API")
        print("\nTo fix 'Blanco ' → 'Blanco':")
        print("  Find entries with trailing space and update them via API")

