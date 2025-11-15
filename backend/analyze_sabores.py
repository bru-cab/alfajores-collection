#!/usr/bin/env python3
"""
Analyze sabores (flavors) to find duplicates and inconsistencies
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import app, db, Alfajor
from collections import defaultdict

def analyze_sabores():
    with app.app_context():
        # Fetch all alfajores
        all_alfajores = Alfajor.query.all()
        
        # Normalize function
        def normalize(value):
            if not value:
                return 'no especificado'
            return value.strip().lower()
        
        # Group by normalized sabor
        sabor_groups = defaultdict(list)
        
        for alfajor in all_alfajores:
            sabor_raw = alfajor.sabor or ''
            sabor_normalized = normalize(sabor_raw)
            sabor_groups[sabor_normalized].append({
                'id': alfajor.id,
                'page': alfajor.page_number,
                'sabor': alfajor.sabor,
                'marca': alfajor.marca,
                'pais': alfajor.pais
            })
        
        print("=" * 80)
        print("ANÁLISIS DE SABORES - Duplicados y Variaciones")
        print("=" * 80)
        print()
        
        # Find groups with multiple variations (potential duplicates)
        duplicates_found = False
        
        for normalized, entries in sorted(sabor_groups.items(), key=lambda x: len(x[1]), reverse=True):
            if len(entries) > 1:
                # Check if there are different capitalizations/variations
                unique_variations = set(e['sabor'] for e in entries if e['sabor'])
                
                if len(unique_variations) > 1:
                    duplicates_found = True
                    print(f"🔍 Grupo: '{normalized}' ({len(entries)} entradas)")
                    print(f"   Variaciones encontradas: {sorted(unique_variations)}")
                    print(f"   Entradas:")
                    for entry in sorted(entries, key=lambda x: x['page']):
                        print(f"      • ID: {entry['id']:3d}, Page: {entry['page']:3d}, "
                              f"Sabor: '{entry['sabor']}', Marca: {entry['marca']}, País: {entry['pais']}")
                    print()
        
        if not duplicates_found:
            print("✅ No se encontraron variaciones de sabores que necesiten corrección")
            print()
        
        # Show all sabores sorted by frequency
        print("=" * 80)
        print("TODOS LOS SABORES (ordenados por frecuencia)")
        print("=" * 80)
        print()
        
        # Count by normalized sabor
        sabor_counts = {}
        sabor_examples = {}
        
        for normalized, entries in sabor_groups.items():
            sabor_counts[normalized] = len(entries)
            # Get an example with proper capitalization
            for entry in entries:
                if entry['sabor'] and entry['sabor'][0].isupper():
                    sabor_examples[normalized] = entry['sabor']
                    break
            if normalized not in sabor_examples:
                sabor_examples[normalized] = entries[0]['sabor'] if entries[0]['sabor'] else normalized.title()
        
        # Sort by count
        sorted_sabores = sorted(sabor_counts.items(), key=lambda x: x[1], reverse=True)
        
        print(f"{'Sabor':<40} {'Cantidad':<10} {'Ejemplo'}")
        print("-" * 80)
        
        for normalized, count in sorted_sabores:
            example = sabor_examples.get(normalized, normalized.title())
            print(f"{normalized:<40} {count:<10} {example}")
        
        print()
        print(f"Total de sabores únicos (normalizados): {len(sabor_counts)}")
        print(f"Total de alfajores: {sum(sabor_counts.values())}")

if __name__ == '__main__':
    analyze_sabores()

