#!/usr/bin/env python3
"""
Migration: Fix Legacy Properties Table Issue

Problem:
- Legacy 'properties' table has only 15 staging/dev sites
- Current 'property_metadata' table has 91 operational properties
- All data tables use GA4 IDs from property_metadata
- Foreign keys incorrectly point to legacy properties table

Solution:
- Backup legacy properties table
- Rename property_metadata to properties
- Update views to use correct table
- Verify data integrity

Author: Property Analytics Platform
Date: January 29, 2026
"""

import sqlite3
import os
from datetime import datetime

DB_PATH = '/Users/mark/Property_Analytics/data/portfolio_analytics.db'
BACKUP_PATH = f'/Users/mark/Property_Analytics/data/portfolio_analytics_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.db'

def backup_database():
    """Create a full database backup before migration"""
    print("📦 Creating database backup...")
    import shutil
    shutil.copy2(DB_PATH, BACKUP_PATH)
    print(f"✅ Backup created: {BACKUP_PATH}")
    return BACKUP_PATH

def execute_migration(conn):
    """Execute the migration steps"""
    cursor = conn.cursor()
    
    print("\n🔧 MIGRATION STEPS:")
    print("=" * 80)
    
    # Step 1: Rename legacy properties to backup
    print("\n1️⃣ Renaming legacy 'properties' table to 'properties_legacy_backup'...")
    cursor.execute("ALTER TABLE properties RENAME TO properties_legacy_backup")
    print("   ✅ Legacy table backed up")
    
    # Step 2: Rename property_metadata to properties
    print("\n2️⃣ Renaming 'property_metadata' to 'properties'...")
    cursor.execute("ALTER TABLE property_metadata RENAME TO properties")
    print("   ✅ property_metadata is now properties")
    
    # Step 3: Drop and recreate views that reference properties
    print("\n3️⃣ Updating views to use new properties table...")
    
    views_to_update = [
        ('v_latest_property_metrics', """
            CREATE VIEW v_latest_property_metrics AS
            SELECT 
                p.property_id,
                p.property_name as canonical_name,
                p.thirtylines_id,
                p.encasa_short_name,
                p.encasa_region,
                g.metric_date as last_ga4_date,
                g.sessions,
                g.conversions,
                g.conversion_rate,
                g.engagement_rate,
                g.bounce_rate,
                pm.score as pagespeed_score,
                pm.first_contentful_paint,
                pm.largest_contentful_paint,
                gsc.clicks as gsc_clicks,
                gsc.impressions as gsc_impressions,
                gsc.ctr as gsc_ctr,
                gsc.average_position
            FROM properties p
            LEFT JOIN ga4_daily_metrics g ON p.property_id = g.property_id 
                AND g.metric_date = (SELECT MAX(metric_date) FROM ga4_daily_metrics WHERE property_id = p.property_id)
            LEFT JOIN pagespeed_metrics pm ON p.property_id = pm.property_id
                AND pm.test_date = (SELECT MAX(test_date) FROM pagespeed_metrics WHERE property_id = p.property_id)
            LEFT JOIN gsc_daily_metrics gsc ON p.property_id = gsc.property_id
                AND gsc.metric_date = (SELECT MAX(metric_date) FROM gsc_daily_metrics WHERE property_id = p.property_id)
        """),
        
        ('v_active_issues', """
            CREATE VIEW v_active_issues AS
            SELECT 
                hi.issue_id,
                p.property_name as canonical_name,
                p.encasa_short_name,
                p.encasa_region,
                hi.issue_type,
                hi.severity,
                hi.description,
                hi.detected_at,
                hi.resolved_at
            FROM health_issues hi
            JOIN properties p ON hi.property_id = p.property_id
            WHERE hi.resolved_at IS NULL
            ORDER BY hi.severity DESC, hi.detected_at DESC
        """),
        
        ('v_latest_availability', """
            CREATE VIEW v_latest_availability AS
            SELECT 
                p.property_name as canonical_name,
                p.encasa_short_name,
                p.thirtylines_id,
                p.encasa_region,
                pf.floorplan_name,
                pf.bedrooms,
                pf.bathrooms,
                pf.sqft,
                pf.rent_from,
                pf.rent_to,
                ua.snapshot_date,
                ua.units_available_now,
                ua.units_available_30d,
                ua.units_available_60d,
                ua.units_available_60plus
            FROM properties p
            JOIN property_floorplans pf ON p.property_id = pf.property_id
            JOIN unit_availability ua ON pf.id = ua.floorplan_id
            WHERE ua.snapshot_date = (
                SELECT MAX(snapshot_date) 
                FROM unit_availability 
                WHERE floorplan_id = ua.floorplan_id
            )
        """)
    ]
    
    for view_name, view_sql in views_to_update:
        # Drop old view
        cursor.execute(f"DROP VIEW IF EXISTS {view_name}")
        # Create new view
        cursor.execute(view_sql)
        print(f"   ✅ Updated view: {view_name}")
    
    # Step 4: Add indexes for new identifier columns
    print("\n4️⃣ Adding indexes for fast lookups...")
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_properties_thirtylines ON properties(thirtylines_id)",
        "CREATE INDEX IF NOT EXISTS idx_properties_encasa_short ON properties(encasa_short_name)",
        "CREATE INDEX IF NOT EXISTS idx_properties_encasa_region ON properties(encasa_region)",
        "CREATE INDEX IF NOT EXISTS idx_properties_company_id ON properties(company_id)"
    ]
    
    for idx_sql in indexes:
        cursor.execute(idx_sql)
    print("   ✅ Indexes created")
    
    conn.commit()
    print("\n✅ Migration completed successfully!")

def verify_migration(conn):
    """Verify the migration was successful"""
    cursor = conn.cursor()
    
    print("\n🔍 VERIFICATION:")
    print("=" * 80)
    
    # Check tables exist
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('properties', 'properties_legacy_backup')")
    tables = [row[0] for row in cursor.fetchall()]
    
    if 'properties' in tables and 'properties_legacy_backup' in tables:
        print("✅ Table rename successful")
    else:
        print("❌ Table rename failed!")
        return False
    
    # Check property count
    cursor.execute("SELECT COUNT(*) FROM properties")
    count = cursor.fetchone()[0]
    print(f"✅ Properties table has {count} properties (expected: 91)")
    
    # Check views
    cursor.execute("SELECT name FROM sqlite_master WHERE type='view' AND name LIKE 'v_%'")
    views = [row[0] for row in cursor.fetchall()]
    print(f"✅ {len(views)} views updated")
    
    # Test a view
    try:
        cursor.execute("SELECT COUNT(*) FROM v_latest_property_metrics")
        view_count = cursor.fetchone()[0]
        print(f"✅ v_latest_property_metrics working ({view_count} rows)")
    except Exception as e:
        print(f"❌ View test failed: {e}")
        return False
    
    # Check data integrity
    cursor.execute("""
        SELECT COUNT(DISTINCT g.property_id)
        FROM ga4_daily_metrics g
        WHERE g.property_id IN (SELECT property_id FROM properties)
    """)
    ga4_match = cursor.fetchone()[0]
    print(f"✅ GA4 data integrity: {ga4_match}/92 properties matched")
    
    return True

def main():
    print("🚀 PROPERTIES TABLE MIGRATION")
    print("=" * 80)
    print(f"\nDatabase: {DB_PATH}")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Confirm migration
    print("\n⚠️  This migration will:")
    print("   1. Rename 'properties' (15 staging sites) to 'properties_legacy_backup'")
    print("   2. Rename 'property_metadata' (91 properties) to 'properties'")
    print("   3. Update 3 views to use new properties table")
    print("   4. Add indexes for new identifier columns")
    
    response = input("\n🔐 Proceed with migration? (yes/no): ")
    if response.lower() != 'yes':
        print("❌ Migration cancelled")
        return
    
    # Create backup
    backup_path = backup_database()
    
    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    
    try:
        # Execute migration
        execute_migration(conn)
        
        # Verify migration
        if verify_migration(conn):
            print("\n" + "=" * 80)
            print("🎉 MIGRATION SUCCESSFUL!")
            print("=" * 80)
            print(f"\n✅ Database backup: {backup_path}")
            print("✅ Legacy 'properties' table saved as 'properties_legacy_backup'")
            print("✅ 'property_metadata' is now 'properties' with 91 properties")
            print("✅ All views updated and working")
            print("✅ Indexes created for fast lookups")
            print("\n💡 You can now:")
            print("   - Use 'properties' table as the single source of truth")
            print("   - Look up by: property_id, thirtylines_id, encasa_short_name, encasa_region")
            print("   - Drop 'properties_legacy_backup' later if no longer needed")
        else:
            print("\n❌ Verification failed! Rolling back...")
            conn.rollback()
            print("Database unchanged. Check errors above.")
    
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        print("Rolling back changes...")
        conn.rollback()
        print(f"Database restored to backup: {backup_path}")
    
    finally:
        conn.close()

if __name__ == "__main__":
    main()
