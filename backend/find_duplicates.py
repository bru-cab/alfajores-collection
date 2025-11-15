#!/usr/bin/env python3
"""
Script to find duplicate alfajores in the database
"""
from app import app, db, Alfajor

def find_duplicates():
    with app.app_context():
        # Find all alfajores
        all_alfajores = Alfajor.query.order_by(Alfajor.marca, Alfajor.sabor, Alfajor.date_added).all()
        
        # Group by marca + sabor
        from collections import defaultdict
        groups = defaultdict(list)
        
        for alfajor in all_alfajores:
            key = f"{alfajor.marca.lower().strip()} - {alfajor.sabor.lower().strip()}"
            groups[key].append(alfajor)
        
        # Find duplicates
        print("🔍 Looking for duplicates...\n")
        duplicates_found = False
        
        for key, alfajores in groups.items():
            if len(alfajores) > 1:
                duplicates_found = True
                print(f"📋 Found {len(alfajores)} entries for: {key}")
                for alfajor in alfajores:
                    print(f"   • ID: {alfajor.id}, Page: {alfajor.page_number}, "
                          f"País: {alfajor.pais}, Added: {alfajor.date_added}")
                print()
        
        if not duplicates_found:
            print("✅ No duplicates found!")
        
        # Also specifically search for "one love"
        print("\n🔍 Searching for entries containing 'one love'...\n")
        one_love = Alfajor.query.filter(
            db.or_(
                Alfajor.marca.ilike('%one love%'),
                Alfajor.sabor.ilike('%one love%')
            )
        ).order_by(Alfajor.date_added).all()
        
        if one_love:
            print(f"Found {len(one_love)} entry/entries with 'one love':")
            for alfajor in one_love:
                print(f"   • ID: {alfajor.id}, Marca: {alfajor.marca}, Sabor: {alfajor.sabor}, "
                      f"Page: {alfajor.page_number}, Added: {alfajor.date_added}")
        else:
            print("No entries found with 'one love'")

if __name__ == '__main__':
    find_duplicates()

