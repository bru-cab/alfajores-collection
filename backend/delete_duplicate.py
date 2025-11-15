#!/usr/bin/env python3
"""
Quick script to delete duplicate One Love alfajor
Run: python delete_duplicate.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import app, db, Alfajor

with app.app_context():
    # Find all alfajores with "one love" (case insensitive)
    duplicates = Alfajor.query.filter(
        db.or_(
            Alfajor.marca.ilike('%one love%'),
            Alfajor.sabor.ilike('%one love%')
        )
    ).order_by(Alfajor.date_added.asc()).all()
    
    print(f"Found {len(duplicates)} entries with 'one love':")
    for i, alfajor in enumerate(duplicates):
        print(f"  {i+1}. ID: {alfajor.id}, Page: {alfajor.page_number}, "
              f"Marca: {alfajor.marca}, Sabor: {alfajor.sabor}, "
              f"Added: {alfajor.date_added}")
    
    if len(duplicates) < 2:
        print("\n✅ No duplicates found - nothing to delete!")
        sys.exit(0)
    
    # Delete the second oldest (first duplicate)
    to_delete = duplicates[1]
    print(f"\n🗑️  Deleting duplicate: ID {to_delete.id}, Page {to_delete.page_number}")
    
    db.session.delete(to_delete)
    db.session.commit()
    
    print(f"✅ Deleted successfully! Remaining: {len(duplicates) - 1}")

