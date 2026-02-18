#!/usr/bin/env python3
"""
ThirtyLines Unit Availability Collector

Collects unit availability and pricing data from Venterra's ThirtyLines feed including:
- Floorplan specifications (bedrooms, baths, sqft)
- Current availability counts
- Available unit details with pricing
- Leasing pipeline (30/60 day forecasts)

Integrates with the Property Analytics platform for comprehensive leasing analysis.

Author: Property Analytics Platform
Date: January 2026
"""

import os
import sys
import json
import time
import logging
import requests
import sqlite3
from datetime import datetime, date
from typing import Dict, List, Optional, Any


class ThirtyLinesCollector:
    """Collects unit availability and pricing data from ThirtyLines feed"""
    
    def __init__(self, db_path: str):
        """Initialize the ThirtyLines collector
        
        Args:
            db_path: Path to the SQLite database
        """
        self.db_path = db_path
        self.feed_url = "https://online.venterraliving.com/encasa-external/ThirtyLines"
        
        # Setup logging
        self.setup_logging()
        
        # Track collection metrics
        self.metrics = {
            'properties_attempted': 0,
            'properties_succeeded': 0,
            'properties_failed': 0,
            'total_floorplans': 0,
            'total_units_available': 0,
            'api_calls': 0,
            'errors': []
        }
        
    def setup_logging(self):
        """Setup logging for ThirtyLines operations"""
        log_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'logs')
        os.makedirs(log_dir, exist_ok=True)
        
        log_file = os.path.join(log_dir, 'thirtylines_collector.log')
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler(sys.stdout)
            ]
        )
        
        self.logger = logging.getLogger(__name__)
    
    def fetch_feed_data(self) -> Optional[List[Dict[str, Any]]]:
        """Fetch data from ThirtyLines API feed
        
        Returns:
            List of property dictionaries or None if error
        """
        try:
            self.logger.info(f"📡 Fetching data from {self.feed_url}")
            self.metrics['api_calls'] += 1
            
            response = requests.get(self.feed_url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            self.logger.info(f"✅ Successfully fetched data for {len(data)} properties")
            return data
            
        except requests.RequestException as e:
            self.logger.error(f"❌ Failed to fetch ThirtyLines feed: {e}")
            self.metrics['errors'].append(f"API fetch failed: {e}")
            return None
        except json.JSONDecodeError as e:
            self.logger.error(f"❌ Failed to parse JSON response: {e}")
            self.metrics['errors'].append(f"JSON parse failed: {e}")
            return None
    
    def map_thirtylines_to_property_id(self, thirtylines_id: str, property_name: str) -> Optional[str]:
        """Map ThirtyLines property ID to our property_id
        
        Args:
            thirtylines_id: ThirtyLines property code (e.g., "TX4KS")
            property_name: Property name from feed
            
        Returns:
            property_id or None if not found
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # First try direct thirtylines_id match (if already mapped)
            cursor.execute("""
                SELECT property_id 
                FROM properties 
                WHERE thirtylines_id = ?
                LIMIT 1
            """, (thirtylines_id,))
            
            result = cursor.fetchone()
            
            if result:
                conn.close()
                return result[0]
            
            # If not mapped, try to match by name
            cursor.execute("""
                SELECT property_id 
                FROM properties
                WHERE LOWER(property_name) LIKE LOWER(?)
                   OR LOWER(property_name) = LOWER(?)
                LIMIT 1
            """, (f"%{property_name}%", property_name))
            
            result = cursor.fetchone()
            
            # If found by name, store the thirtylines_id for future lookups
            if result:
                property_id = result[0]
                cursor.execute("""
                    UPDATE properties 
                    SET thirtylines_id = ?
                    WHERE property_id = ?
                """, (thirtylines_id, property_id))
                conn.commit()
                conn.close()
                self.logger.info(f"📝 Auto-mapped {property_name} ({thirtylines_id}) -> {property_id}")
                return property_id
            
            conn.close()
            self.logger.warning(f"⚠️ No property_id mapping found for {property_name} ({thirtylines_id})")
            return None
                
        except sqlite3.Error as e:
            self.logger.error(f"❌ Database error mapping property: {e}")
            return None
    
    def store_floorplan_data(self, property_id: str, floorplan: Dict[str, Any], collection_id: int):
        """Store floorplan specifications in database
        
        Args:
            property_id: Property ID (GA4 property ID)
            floorplan: Floorplan data dictionary
            collection_id: Collection run ID
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Extract floorplan details
            floorplan_name = floorplan.get('name', '')
            bedrooms = floorplan.get('bedrooms', 0)
            bathrooms = floorplan.get('baths', 0.0)
            dens = floorplan.get('dens', 0)
            offices = floorplan.get('offices', 0)
            sqft = floorplan.get('sqFtg', 0)
            rent_from = floorplan.get('rentFrom', 0.0)
            rent_to = floorplan.get('rentTo', 0.0)
            security_deposit = floorplan.get('securityDepositFrom', 0.0)
            max_roommates = floorplan.get('maximums', {}).get('maxRoomates', 0)
            max_vehicles = floorplan.get('maximums', {}).get('maxVehicleAllowance', 0)
            
            # URLs
            diagram_url = floorplan.get('floorplanDiagram', '')
            pdf_url = floorplan.get('floorplanDiagramPdf', '')
            matterport_url = floorplan.get('matterportUrl', '')
            pipeline_url = floorplan.get('pipelineURL', '')
            
            # Upsert floorplan (insert or update if exists)
            cursor.execute("""
                INSERT INTO property_floorplans (
                    property_id, floorplan_name, bedrooms, bathrooms, dens, offices,
                    sqft, rent_from, rent_to, security_deposit_from,
                    max_roommates, max_vehicles, floorplan_diagram_url,
                    floorplan_pdf_url, matterport_url, pipeline_url, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(property_id, floorplan_name) DO UPDATE SET
                    bedrooms = excluded.bedrooms,
                    bathrooms = excluded.bathrooms,
                    dens = excluded.dens,
                    offices = excluded.offices,
                    sqft = excluded.sqft,
                    rent_from = excluded.rent_from,
                    rent_to = excluded.rent_to,
                    security_deposit_from = excluded.security_deposit_from,
                    max_roommates = excluded.max_roommates,
                    max_vehicles = excluded.max_vehicles,
                    floorplan_diagram_url = excluded.floorplan_diagram_url,
                    floorplan_pdf_url = excluded.floorplan_pdf_url,
                    matterport_url = excluded.matterport_url,
                    pipeline_url = excluded.pipeline_url,
                    updated_at = CURRENT_TIMESTAMP
            """, (
                property_id, floorplan_name, bedrooms, bathrooms, dens, offices,
                sqft, rent_from, rent_to, security_deposit,
                max_roommates, max_vehicles, diagram_url,
                pdf_url, matterport_url, pipeline_url
            ))
            
            conn.commit()
            conn.close()
            
            self.metrics['total_floorplans'] += 1
            
        except sqlite3.Error as e:
            self.logger.error(f"❌ Failed to store floorplan data: {e}")
            self.metrics['errors'].append(f"Floorplan storage error: {e}")
    
    def store_availability_data(self, property_id: str, floorplan_name: str, 
                               floorplan: Dict[str, Any], snapshot_date: date,
                               collection_id: int):
        """Store unit availability snapshot in database
        
        Args:
            property_id: Property ID (GA4 property ID)
            floorplan_name: Floorplan name
            floorplan: Floorplan data with availability
            snapshot_date: Date of this snapshot
            collection_id: Collection run ID
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Extract availability counts
            units_now = floorplan.get('unitsAvailable', 0)
            units_30d = floorplan.get('unitsAvailable30', 0)
            units_60d = floorplan.get('unitsAvailable60', 0)
            units_after_60d = floorplan.get('unitsAvailableAfter60', 0)
            
            # Store full unit details as JSON
            available_units = floorplan.get('availableApartments', [])
            units_json = json.dumps(available_units)
            
            # Insert availability snapshot
            cursor.execute("""
                INSERT INTO unit_availability (
                    property_id, floorplan_name, snapshot_date, collection_id,
                    units_available_now, units_available_30d, units_available_60d,
                    units_available_after_60d, available_units_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, floorplan_name, snapshot_date) DO UPDATE SET
                    collection_id = excluded.collection_id,
                    units_available_now = excluded.units_available_now,
                    units_available_30d = excluded.units_available_30d,
                    units_available_60d = excluded.units_available_60d,
                    units_available_after_60d = excluded.units_available_after_60d,
                    available_units_json = excluded.available_units_json
            """, (
                property_id, floorplan_name, snapshot_date.isoformat(), collection_id,
                units_now, units_30d, units_60d, units_after_60d, units_json
            ))
            
            conn.commit()
            conn.close()
            
            self.metrics['total_units_available'] += units_now
            
        except sqlite3.Error as e:
            self.logger.error(f"❌ Failed to store availability data: {e}")
            self.metrics['errors'].append(f"Availability storage error: {e}")
    
    def store_unit_details(self, property_id: str, floorplan_name: str, 
                          available_units: List[Dict[str, Any]], snapshot_date: date):
        """Store individual unit details for tracking over time
        
        Args:
            property_id: Property ID
            floorplan_name: Floorplan name
            available_units: List of available unit dictionaries
            snapshot_date: Date of this snapshot
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            for unit in available_units:
                unit_id = unit.get('unitID', '')
                if not unit_id:
                    continue
                
                building = unit.get('building', '')
                apt_number = unit.get('aptNumber', '')
                level = unit.get('level', '')
                rent_from = unit.get('rentFrom', 0.0)
                rent_to = unit.get('rentTo', 0.0)
                moved_out_date = unit.get('movedOutDate', '')
                available_date = unit.get('availableDate', '')
                tour_url = unit.get('tourURL', '')
                quote_url = unit.get('quoteURL', '')
                application_url = unit.get('applicationURL', '')
                features = json.dumps(unit.get('features', []))
                
                # Check if unit already exists
                cursor.execute("""
                    SELECT id, first_seen_date, last_seen_date 
                    FROM available_units 
                    WHERE unit_id = ?
                """, (unit_id,))
                
                existing = cursor.fetchone()
                
                if existing:
                    # Update existing unit
                    unit_db_id, first_seen, last_seen = existing
                    
                    # Calculate days on market
                    days_on_market = (snapshot_date - date.fromisoformat(first_seen)).days
                    
                    cursor.execute("""
                        UPDATE available_units SET
                            last_seen_date = ?,
                            days_on_market = ?,
                            rent_from = ?,
                            rent_to = ?,
                            available_date = ?,
                            status = 'available',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    """, (
                        snapshot_date.isoformat(), days_on_market,
                        rent_from, rent_to, available_date, unit_db_id
                    ))
                else:
                    # Insert new unit
                    cursor.execute("""
                        INSERT INTO available_units (
                            property_id, floorplan_name, unit_id, building, apt_number,
                            level, rent_from, rent_to, moved_out_date, available_date,
                            first_seen_date, last_seen_date, days_on_market,
                            tour_url, quote_url, application_url, features_json, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')
                    """, (
                        property_id, floorplan_name, unit_id, building, apt_number,
                        level, rent_from, rent_to, moved_out_date, available_date,
                        snapshot_date.isoformat(), snapshot_date.isoformat(), 0,
                        tour_url, quote_url, application_url, features
                    ))
            
            # Mark units not seen today as potentially leased
            cursor.execute("""
                UPDATE available_units 
                SET status = 'unknown'
                WHERE property_id = ? 
                  AND floorplan_name = ?
                  AND last_seen_date < ?
                  AND status = 'available'
            """, (property_id, floorplan_name, snapshot_date.isoformat()))
            
            conn.commit()
            conn.close()
            
        except sqlite3.Error as e:
            self.logger.error(f"❌ Failed to store unit details: {e}")
            self.metrics['errors'].append(f"Unit details storage error: {e}")
    
    def store_pricing_history(self, property_id: str, floorplan_name: str,
                             rent_from: float, rent_to: float, units_count: int,
                             snapshot_date: date):
        """Store pricing history for trend analysis
        
        Args:
            property_id: Property ID
            floorplan_name: Floorplan name
            rent_from: Minimum rent
            rent_to: Maximum rent
            units_count: Number of units at this price
            snapshot_date: Date of snapshot
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO floorplan_pricing_history (
                    property_id, floorplan_name, snapshot_date,
                    rent_from, rent_to, units_at_price
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, floorplan_name, snapshot_date) DO UPDATE SET
                    rent_from = excluded.rent_from,
                    rent_to = excluded.rent_to,
                    units_at_price = excluded.units_at_price
            """, (
                property_id, floorplan_name, snapshot_date.isoformat(),
                rent_from, rent_to, units_count
            ))
            
            conn.commit()
            conn.close()
            
        except sqlite3.Error as e:
            self.logger.error(f"❌ Failed to store pricing history: {e}")
    
    def collect_all_properties(self, collection_date: date = None) -> Dict[str, Any]:
        """Collect availability data for all properties from ThirtyLines feed
        
        Args:
            collection_date: Date to record for this collection (default: today)
            
        Returns:
            Dictionary with collection results and metrics
        """
        if collection_date is None:
            collection_date = date.today()
        
        self.logger.info(f"🚀 Starting ThirtyLines data collection for {collection_date}")
        
        # Create collection record
        collection_id = self._start_collection_record(collection_date)
        
        # Fetch feed data
        feed_data = self.fetch_feed_data()
        
        if not feed_data:
            self._complete_collection_record(collection_id, 'failed', 
                                            'Failed to fetch feed data')
            return self.metrics
        
        # Process each property in the feed
        for property_data in feed_data:
            self.metrics['properties_attempted'] += 1
            
            try:
                thirtylines_id = property_data.get('id', '')
                property_name = property_data.get('name', '')
                
                self.logger.info(f"📋 Processing {property_name} ({thirtylines_id})")
                
                # Map to our property ID
                property_id = self.map_thirtylines_to_property_id(thirtylines_id, property_name)
                
                if not property_id:
                    self.logger.warning(f"⚠️ Skipping {property_name} - no property ID mapping")
                    self.metrics['properties_failed'] += 1
                    continue
                
                # Process floorplans
                floorplans = property_data.get('floorplans', [])
                
                for floorplan in floorplans:
                    floorplan_name = floorplan.get('name', '')
                    
                    # Store floorplan specifications
                    self.store_floorplan_data(property_id, floorplan, collection_id)
                    
                    # Store availability snapshot
                    self.store_availability_data(property_id, floorplan_name, 
                                                floorplan, collection_date, collection_id)
                    
                    # Store individual unit details
                    available_units = floorplan.get('availableApartments', [])
                    if available_units:
                        self.store_unit_details(property_id, floorplan_name,
                                              available_units, collection_date)
                    
                    # Store pricing history
                    rent_from = floorplan.get('rentFrom', 0.0)
                    rent_to = floorplan.get('rentTo', 0.0)
                    units_count = floorplan.get('unitsAvailable', 0)
                    self.store_pricing_history(property_id, floorplan_name,
                                              rent_from, rent_to, units_count,
                                              collection_date)
                
                # WRITE VERIFICATION: Confirm data was actually written for this property
                try:
                    conn = sqlite3.connect(self.db_path)
                    cursor = conn.cursor()
                    cursor.execute("""
                        SELECT COUNT(*) FROM property_floorplans 
                        WHERE property_id = ? AND DATE(updated_at) = DATE('now')
                    """, (property_id,))
                    floorplans_written = cursor.fetchone()[0]
                    
                    cursor.execute("""
                        SELECT COUNT(*) FROM unit_availability
                        WHERE property_id = ? AND snapshot_date = ?
                    """, (property_id, collection_date.isoformat()))
                    availability_written = cursor.fetchone()[0]
                    conn.close()
                    
                    if floorplans_written == 0 or availability_written == 0:
                        raise Exception(f"Write verification failed: floorplans={floorplans_written}, availability={availability_written}")
                except Exception as verify_error:
                    self.logger.error(f"❌ Verification failed for {property_name}: {verify_error}")
                    self.metrics['properties_failed'] += 1
                    self.metrics['properties_succeeded'] -= 1  # Rollback success count
                    self.metrics['errors'].append(f"{property_name}: {verify_error}")
                    continue
                
                self.metrics['properties_succeeded'] += 1
                self.logger.info(f"✅ Completed {property_name} - {len(floorplans)} floorplans (verified)")
                
            except Exception as e:
                self.logger.error(f"❌ Error processing {property_name}: {e}")
                self.metrics['properties_failed'] += 1
                self.metrics['errors'].append(f"{property_name}: {e}")
        
        # DATABASE VERIFICATION: Confirm collection actually wrote data
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Count total records written today
            cursor.execute("""
                SELECT COUNT(DISTINCT property_id) FROM unit_availability
                WHERE snapshot_date = ?
            """, (collection_date.isoformat(),))
            properties_with_data = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT COUNT(*) FROM property_floorplans
                WHERE DATE(updated_at) = DATE('now')
            """)
            total_floorplans = cursor.fetchone()[0]
            
            conn.close()
            
            self.logger.info(f"📊 Verification: {properties_with_data} properties, {total_floorplans} floorplans written")
            
            if properties_with_data == 0:
                status = 'failed'
                self._complete_collection_record(collection_id, status, 
                                                'No data written to database (verification failed)')
                return self.metrics
        except Exception as e:
            self.logger.error(f"❌ Verification query failed: {e}")
            status = 'failed'
            self._complete_collection_record(collection_id, status, f'Verification failed: {e}')
            return self.metrics
        
        # Complete collection record
        status = 'completed' if self.metrics['properties_succeeded'] > 0 else 'failed'
        self._complete_collection_record(collection_id, status)
        
        # Log final summary
        self.logger.info("="*60)
        self.logger.info("📊 ThirtyLines Collection Summary:")
        self.logger.info(f"   Properties Attempted: {self.metrics['properties_attempted']}")
        self.logger.info(f"   Properties Succeeded: {self.metrics['properties_succeeded']}")
        self.logger.info(f"   Properties Failed: {self.metrics['properties_failed']}")
        self.logger.info(f"   Total Floorplans: {self.metrics['total_floorplans']}")
        self.logger.info(f"   Total Units Available: {self.metrics['total_units_available']}")
        self.logger.info(f"   API Calls: {self.metrics['api_calls']}")
        if self.metrics['errors']:
            self.logger.info(f"   Errors: {len(self.metrics['errors'])}")
        self.logger.info("="*60)
        
        return self.metrics
    
    def _start_collection_record(self, collection_date: date) -> int:
        """Create a collection record in the database
        
        Args:
            collection_date: Date being collected
            
        Returns:
            Collection ID
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO data_collections (
                    collection_date, collection_type, data_source,
                    started_at, status, properties_total
                ) VALUES (?, 'daily', 'thirtylines', CURRENT_TIMESTAMP, 'in_progress', ?)
            """, (collection_date.isoformat(), self.metrics.get('properties_attempted', 0)))
            
            collection_id = cursor.lastrowid
            
            conn.commit()
            conn.close()
            
            return collection_id
            
        except sqlite3.Error as e:
            self.logger.error(f"❌ Failed to create collection record: {e}")
            return 0
    
    def _complete_collection_record(self, collection_id: int, status: str, 
                                   error_message: str = None):
        """Update collection record with completion status
        
        Args:
            collection_id: Collection ID
            status: Final status (completed, failed)
            error_message: Optional error message
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE data_collections SET
                    completed_at = CURRENT_TIMESTAMP,
                    status = ?,
                    properties_total = ?,
                    properties_collected = ?,
                    properties_success = ?,
                    properties_failed = ?,
                    properties_skipped = ?,
                    error_message = ?,
                    api_calls_total = ?,
                    duration_seconds = (
                        (julianday(CURRENT_TIMESTAMP) - julianday(started_at)) * 86400
                    )
                WHERE collection_id = ?
            """, (
                status,
                self.metrics.get('properties_attempted', 0),
                self.metrics['properties_succeeded'],
                self.metrics['properties_succeeded'],
                self.metrics['properties_failed'],
                max(0, (self.metrics.get('properties_attempted', 0) or 0) - (self.metrics['properties_succeeded'] + self.metrics['properties_failed'])),
                error_message,
                self.metrics['api_calls'],
                collection_id
            ))
            
            conn.commit()
            conn.close()
            
        except sqlite3.Error as e:
            self.logger.error(f"❌ Failed to update collection record: {e}")


def main():
    """Main execution function for standalone testing"""
    import sys
    
    # Get database path
    db_path = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'portfolio_analytics.db')
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        sys.exit(1)
    
    # Create collector
    collector = ThirtyLinesCollector(db_path)
    
    # Run collection
    results = collector.collect_all_properties()
    
    # Exit with appropriate code
    if results['properties_succeeded'] > 0:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == '__main__':
    main()
