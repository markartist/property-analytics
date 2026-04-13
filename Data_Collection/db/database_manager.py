#!/usr/bin/env python3
"""
Database Manager for Portfolio Monitoring System

Handles all database operations including:
- Schema initialization
- Data insertion/updates
- Queries for monitoring and reporting
- Data migration from JSON to SQLite
"""

import sqlite3
import json
import logging
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from contextlib import contextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database location - supports env var for shared database
import os
DB_PATH_ENV = os.getenv('PORTFOLIO_ANALYTICS_DB_PATH')
if DB_PATH_ENV:
    DB_PATH = Path(DB_PATH_ENV)
else:
    # Default to canonical shared location
    DB_PATH = Path(__file__).parent.parent.parent.parent / "data" / "portfolio_analytics.db"

SCHEMA_PATH = Path(__file__).parent.parent.parent / "schema" / "portfolio_database_schema.sql"

# Master registry for property URL → GA4 ID mapping
REGISTRY_PATH = Path('/Users/mark/Property_Analytics/config/venterra_properties_official.json')


class DatabaseManager:
    """Manages all database operations for the portfolio monitoring system."""
    
    def __init__(self, db_path: Optional[Path] = None):
        """Initialize database manager.
        
        Args:
            db_path: Path to SQLite database file. Uses default if None.
        """
        self.db_path = db_path or DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Initialize database if it doesn't exist
        if not self.db_path.exists():
            logger.info(f"Database does not exist. Creating new database at {self.db_path}")
            self.initialize_database()
        
        # Load GSC URL → GA4 ID mapping for dual-write
        self._gsc_url_to_ga4_map = self._load_gsc_mapping()

        # Ensure runtime-added tables exist for existing databases.
        self._ensure_runtime_tables()
        
        logger.info(f"Database manager initialized: {self.db_path}")

    def _ensure_runtime_tables(self) -> None:
        """Create runtime tables that may not exist in older databases."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS gsc_url_inspection (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    property_id TEXT NOT NULL,
                    gsc_site_url TEXT NOT NULL,
                    inspected_url TEXT NOT NULL,
                    inspection_date DATE NOT NULL,
                    collection_id INTEGER,
                    verdict TEXT,
                    coverage_state TEXT,
                    indexing_state TEXT,
                    page_fetch_state TEXT,
                    robots_txt_state TEXT,
                    crawled_as TEXT,
                    last_crawl_time TEXT,
                    google_canonical TEXT,
                    user_canonical TEXT,
                    mobile_usability_verdict TEXT,
                    rich_results_verdict TEXT,
                    referring_urls_count INTEGER DEFAULT 0,
                    sitemaps_count INTEGER DEFAULT 0,
                    raw_response_json TEXT,
                    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(property_id, inspected_url, inspection_date),
                    FOREIGN KEY (collection_id) REFERENCES data_collections(collection_id)
                )
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_gsc_url_inspection_property_date
                ON gsc_url_inspection(property_id, inspection_date)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_gsc_url_inspection_site_url
                ON gsc_url_inspection(gsc_site_url)
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS crux_history_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    property_id TEXT NOT NULL,
                    property_url TEXT NOT NULL,
                    form_factor TEXT NOT NULL,
                    metric_name TEXT NOT NULL,
                    period_start_date DATE NOT NULL,
                    period_end_date DATE NOT NULL,
                    p75_value REAL,
                    collection_id INTEGER,
                    raw_value TEXT,
                    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(property_id, form_factor, metric_name, period_end_date),
                    FOREIGN KEY (collection_id) REFERENCES data_collections(collection_id)
                )
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_crux_history_property_date
                ON crux_history_metrics(property_id, period_end_date)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_crux_history_metric_ff
                ON crux_history_metrics(metric_name, form_factor)
            """)
            columns = {row["name"] for row in cursor.execute("PRAGMA table_info(ga4_traffic_sources)").fetchall()}
            if "new_users" not in columns:
                cursor.execute("ALTER TABLE ga4_traffic_sources ADD COLUMN new_users INTEGER DEFAULT 0")
            if "total_users" not in columns:
                cursor.execute("ALTER TABLE ga4_traffic_sources ADD COLUMN total_users INTEGER DEFAULT 0")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pilot_homepage_audit_evidence (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    property_id TEXT NOT NULL,
                    property_name TEXT NOT NULL,
                    page_url TEXT NOT NULL,
                    metric_date DATE NOT NULL,
                    collection_id INTEGER,
                    device_profile TEXT NOT NULL DEFAULT 'mobile_chrome_headless',
                    lcp_start_time_ms REAL,
                    lcp_size REAL,
                    lcp_url TEXT,
                    lcp_tag_name TEXT,
                    lcp_class_name TEXT,
                    lcp_text TEXT,
                    lcp_outer_html TEXT,
                    lcp_background_image TEXT,
                    screenshot_path TEXT,
                    main_document_status_code INTEGER,
                    main_document_headers_json TEXT,
                    lcp_resource_status_code INTEGER,
                    lcp_resource_headers_json TEXT,
                    total_request_count INTEGER,
                    failed_request_count INTEGER,
                    total_transfer_size INTEGER,
                    network_summary_json TEXT,
                    blocking_resources_json TEXT,
                    console_errors_json TEXT,
                    browserstack_desktop_classification TEXT,
                    browserstack_desktop_screenshot_path TEXT,
                    browserstack_iphone_classification TEXT,
                    browserstack_iphone_screenshot_path TEXT,
                    browserstack_summary_json TEXT,
                    raw_probe_json TEXT,
                    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(property_id, page_url, metric_date, device_profile),
                    FOREIGN KEY (collection_id) REFERENCES data_collections(collection_id)
                )
            """)
            homepage_audit_columns = {
                row["name"] for row in cursor.execute("PRAGMA table_info(pilot_homepage_audit_evidence)").fetchall()
            }
            required_homepage_audit_columns = {
                "main_document_status_code": "INTEGER",
                "main_document_headers_json": "TEXT",
                "lcp_resource_status_code": "INTEGER",
                "lcp_resource_headers_json": "TEXT",
                "total_request_count": "INTEGER",
                "failed_request_count": "INTEGER",
                "total_transfer_size": "INTEGER",
                "network_summary_json": "TEXT",
                "blocking_resources_json": "TEXT",
                "console_errors_json": "TEXT",
                "browserstack_desktop_classification": "TEXT",
                "browserstack_desktop_screenshot_path": "TEXT",
                "browserstack_iphone_classification": "TEXT",
                "browserstack_iphone_screenshot_path": "TEXT",
                "browserstack_summary_json": "TEXT",
            }
            for column_name, column_type in required_homepage_audit_columns.items():
                if column_name not in homepage_audit_columns:
                    cursor.execute(
                        f"ALTER TABLE pilot_homepage_audit_evidence ADD COLUMN {column_name} {column_type}"
                    )
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_pilot_homepage_audit_property_date
                ON pilot_homepage_audit_evidence(property_id, metric_date DESC)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_pilot_homepage_audit_date
                ON pilot_homepage_audit_evidence(metric_date DESC)
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cloudflare_cache_synthetic_checks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    property_id TEXT NOT NULL,
                    property_name TEXT NOT NULL,
                    normalized_domain TEXT NOT NULL,
                    zone_name TEXT NOT NULL,
                    zone_tag TEXT,
                    request_date DATE NOT NULL,
                    path_tested TEXT NOT NULL,
                    variant_key TEXT NOT NULL DEFAULT 'clean',
                    request_sequence INTEGER NOT NULL,
                    final_url TEXT,
                    http_status INTEGER,
                    cf_cache_status TEXT,
                    ttfb_ms REAL,
                    total_time_ms REAL,
                    response_bytes INTEGER,
                    headers_json TEXT,
                    notes_json TEXT,
                    audit_status TEXT,
                    request_timestamp TEXT,
                    collection_id INTEGER,
                    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(property_id, request_date, path_tested, variant_key, request_sequence),
                    FOREIGN KEY (collection_id) REFERENCES data_collections(collection_id)
                )
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_cf_cache_synth_property_date
                ON cloudflare_cache_synthetic_checks(property_id, request_date DESC)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_cf_cache_synth_domain_date
                ON cloudflare_cache_synthetic_checks(normalized_domain, request_date DESC)
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cloudflare_zone_cache_daily (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    property_id TEXT NOT NULL,
                    property_name TEXT NOT NULL,
                    normalized_domain TEXT NOT NULL,
                    zone_name TEXT NOT NULL,
                    zone_tag TEXT,
                    hostname TEXT,
                    metric_date DATE NOT NULL,
                    window_start TEXT,
                    window_end TEXT,
                    dataset_name TEXT,
                    total_requests INTEGER,
                    cached_requests INTEGER,
                    uncached_requests INTEGER,
                    cache_hit_ratio REAL,
                    cache_status_breakdown_json TEXT,
                    supported_dimensions_json TEXT,
                    supported_sum_fields_json TEXT,
                    query_attempts_json TEXT,
                    raw_response_json TEXT,
                    query_status TEXT,
                    audit_status TEXT,
                    collection_id INTEGER,
                    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(property_id, metric_date, normalized_domain),
                    FOREIGN KEY (collection_id) REFERENCES data_collections(collection_id)
                )
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_cf_zone_cache_property_date
                ON cloudflare_zone_cache_daily(property_id, metric_date DESC)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_cf_zone_cache_domain_date
                ON cloudflare_zone_cache_daily(normalized_domain, metric_date DESC)
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cloudflare_zone_config_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    property_id TEXT NOT NULL,
                    property_name TEXT NOT NULL,
                    normalized_domain TEXT NOT NULL,
                    zone_name TEXT NOT NULL,
                    zone_tag TEXT,
                    snapshot_date DATE NOT NULL,
                    snapshot_status TEXT,
                    zone_summary_json TEXT,
                    cache_settings_json TEXT,
                    rulesets_json TEXT,
                    raw_snapshot_json TEXT,
                    collection_id INTEGER,
                    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(property_id, snapshot_date, normalized_domain),
                    FOREIGN KEY (collection_id) REFERENCES data_collections(collection_id)
                )
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_cf_zone_snapshot_domain_date
                ON cloudflare_zone_config_snapshots(normalized_domain, snapshot_date DESC)
            """)
            cf_synth_columns = {
                row["name"] for row in cursor.execute("PRAGMA table_info(cloudflare_cache_synthetic_checks)").fetchall()
            }
            required_cf_synth_columns = {
                "device_profile": "TEXT DEFAULT 'desktop'",
                "requested_url": "TEXT",
                "redirect_count": "INTEGER DEFAULT 0",
                "redirect_chain_json": "TEXT",
                "cacheability_json": "TEXT",
                "headers_full_json": "TEXT",
            }
            for column_name, column_type in required_cf_synth_columns.items():
                if column_name not in cf_synth_columns:
                    cursor.execute(
                        f"ALTER TABLE cloudflare_cache_synthetic_checks ADD COLUMN {column_name} {column_type}"
                    )
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections.
        
        Usage:
            with db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM properties")
        """
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row  # Enable column access by name
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            conn.close()
    
    def _load_gsc_mapping(self) -> Dict[str, str]:
        """Load GSC URL → GA4 ID mapping from registry.
        
        Returns:
            Dict mapping GSC URL to GA4 numeric ID
        """
        try:
            with open(REGISTRY_PATH) as f:
                registry = json.load(f)
            
            url_to_ga4 = {}
            for prop in registry['properties']:
                gsc_url = prop.get('gsc_url') or prop.get('full_url')
                ga4_id = prop.get('ga4_property_id')
                
                if gsc_url and ga4_id:
                    # Normalize URL (ensure trailing slash)
                    if not gsc_url.endswith('/'):
                        gsc_url += '/'
                    url_to_ga4[gsc_url] = ga4_id
            
            logger.info(f"Loaded {len(url_to_ga4)} GSC URL → GA4 ID mappings")
            return url_to_ga4
        except Exception as e:
            logger.error(f"Failed to load GSC mapping: {e}")
            return {}
    
    def initialize_database(self):
        """Initialize database from schema file."""
        if not SCHEMA_PATH.exists():
            raise FileNotFoundError(f"Schema file not found: {SCHEMA_PATH}")
        
        logger.info("Initializing database schema...")
        
        with open(SCHEMA_PATH, 'r') as f:
            schema_sql = f.read()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.executescript(schema_sql)
        
        logger.info("Database schema initialized successfully")
    
    # =========================================================================
    # PROPERTY MANAGEMENT
    # =========================================================================
    
    def upsert_property(self, property_id: str, canonical_name: str,
                       url: Optional[str] = None, location: Optional[str] = None,
                       manager: Optional[str] = None, property_type: Optional[str] = None,
                       active: bool = True) -> None:
        """Insert or update property in database.
        
        Args:
            property_id: GA4 Property ID
            canonical_name: Display name for property
            url: Property website URL
            location: City, State
            manager: Property manager name
            property_type: Type of property (apartment, townhome, etc.)
            active: Whether property is active
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO properties (property_id, canonical_name, url, location, manager, property_type, active)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id) DO UPDATE SET
                    canonical_name = excluded.canonical_name,
                    url = excluded.url,
                    location = excluded.location,
                    manager = excluded.manager,
                    property_type = excluded.property_type,
                    active = excluded.active,
                    updated_at = CURRENT_TIMESTAMP
            """, (property_id, canonical_name, url, location, manager, property_type, active))
        
        logger.debug(f"Upserted property: {canonical_name} ({property_id})")
    
    def add_property_alias(self, property_id: str, alias: str) -> None:
        """Add an alias for a property.
        
        Args:
            property_id: GA4 Property ID
            alias: Alternative name for the property
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR IGNORE INTO property_aliases (property_id, alias)
                VALUES (?, ?)
            """, (property_id, alias))
    
    def get_property(self, property_id: str) -> Optional[Dict]:
        """Retrieve property details.
        
        Args:
            property_id: GA4 Property ID
            
        Returns:
            Property details as dictionary, or None if not found
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM properties WHERE property_id = ?", (property_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def get_all_active_properties(self) -> List[Dict]:
        """Get all active properties.
        
        Returns:
            List of property dictionaries
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM properties WHERE active = 1 ORDER BY canonical_name")
            return [dict(row) for row in cursor.fetchall()]
    
    # =========================================================================
    # DATA COLLECTION TRACKING
    # =========================================================================
    
    def start_data_collection(self, collection_date: date, collection_type: str,
                             data_source: str) -> int:
        """Start a new data collection run.
        
        Args:
            collection_date: Date the data represents
            collection_type: daily, weekly, monthly
            data_source: ga4, gtmetrix, psi, semrush, gsc
            
        Returns:
            Collection ID
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO data_collections 
                (collection_date, collection_type, data_source, started_at, status)
                VALUES (?, ?, ?, ?, 'in_progress')
            """, (collection_date, collection_type, data_source, datetime.now()))
            
            return cursor.lastrowid
    
    def complete_data_collection(self, collection_id: int, 
                                 properties_collected: int,
                                 properties_failed: int = 0,
                                 error_message: Optional[str] = None) -> None:
        """Mark a data collection run as complete.
        
        Args:
            collection_id: Collection ID from start_data_collection
            properties_collected: Number of properties successfully collected
            properties_failed: Number of properties that failed
            error_message: Error message if collection failed
        """
        status = 'completed' if properties_failed == 0 else 'failed'
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE data_collections
                SET completed_at = ?,
                    status = ?,
                    properties_collected = ?,
                    properties_failed = ?,
                    error_message = ?
                WHERE collection_id = ?
            """, (datetime.now(), status, properties_collected, properties_failed, 
                  error_message, collection_id))

    # =========================================================================
    # GTMETRIX DATA INSERTION
    # =========================================================================

    def insert_gtmetrix_metrics(
        self,
        property_id: str,
        metric_date: date,
        data: Dict,
        collection_id: Optional[int] = None,
    ) -> None:
        """Insert or update GTMetrix metrics for a property/date."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO gtmetrix_metrics
                (
                    property_id, metric_date, collection_id,
                    pagespeed_score, yslow_score, structure_score,
                    fully_loaded_time_ms, onload_time_ms,
                    first_contentful_paint_ms, time_to_interactive_ms,
                    page_bytes, page_requests,
                    test_server_location, test_browser
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, metric_date) DO UPDATE SET
                    collection_id = excluded.collection_id,
                    pagespeed_score = excluded.pagespeed_score,
                    yslow_score = excluded.yslow_score,
                    structure_score = excluded.structure_score,
                    fully_loaded_time_ms = excluded.fully_loaded_time_ms,
                    onload_time_ms = excluded.onload_time_ms,
                    first_contentful_paint_ms = excluded.first_contentful_paint_ms,
                    time_to_interactive_ms = excluded.time_to_interactive_ms,
                    page_bytes = excluded.page_bytes,
                    page_requests = excluded.page_requests,
                    test_server_location = excluded.test_server_location,
                    test_browser = excluded.test_browser,
                    collected_at = CURRENT_TIMESTAMP
                """,
                (
                    property_id,
                    metric_date,
                    collection_id,
                    data.get("pagespeed_score"),
                    data.get("yslow_score"),
                    data.get("structure_score"),
                    data.get("fully_loaded_time_ms"),
                    data.get("onload_time_ms"),
                    data.get("first_contentful_paint_ms"),
                    data.get("time_to_interactive_ms"),
                    data.get("page_bytes"),
                    data.get("page_requests"),
                    data.get("test_server_location"),
                    data.get("test_browser"),
                ),
            )
    
    # =========================================================================
    # GA4 DATA INSERTION
    # =========================================================================
    
    def insert_ga4_daily_metrics(self, property_id: str, metric_date: date,
                                 data: Dict, collection_id: Optional[int] = None) -> None:
        """Insert GA4 daily metrics.
        
        Args:
            property_id: GA4 Property ID
            metric_date: Date the metrics represent
            data: Dictionary containing GA4 metrics
            collection_id: Optional collection ID
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO ga4_daily_metrics 
                (property_id, metric_date, collection_id,
                 sessions, engaged_sessions, sessions_per_user, avg_session_duration, bounce_rate,
                 total_users, new_users, returning_users,
                 engagement_rate, engaged_sessions_per_user, events_per_session,
                 conversions, conversion_rate, conversions_per_user,
                 total_revenue, average_revenue_per_user, pageviews)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, metric_date) DO UPDATE SET
                    collection_id = excluded.collection_id,
                    sessions = excluded.sessions,
                    engaged_sessions = excluded.engaged_sessions,
                    sessions_per_user = excluded.sessions_per_user,
                    bounce_rate = excluded.bounce_rate,
                    total_users = excluded.total_users,
                    new_users = excluded.new_users,
                    returning_users = excluded.returning_users,
                    engagement_rate = excluded.engagement_rate,
                    engaged_sessions_per_user = excluded.engaged_sessions_per_user,
                    events_per_session = excluded.events_per_session,
                    conversions = excluded.conversions,
                    conversion_rate = excluded.conversion_rate,
                    conversions_per_user = excluded.conversions_per_user,
                    pageviews = excluded.pageviews,
                    avg_session_duration = excluded.avg_session_duration,
                    total_revenue = excluded.total_revenue,
                    average_revenue_per_user = excluded.average_revenue_per_user,
                    collected_at = CURRENT_TIMESTAMP
            """, (
                property_id, metric_date, collection_id,
                data.get('sessions', 0),
                data.get('engaged_sessions', 0),
                data.get('sessions_per_user'),
                data.get('avg_session_duration'),
                data.get('bounce_rate'),
                data.get('total_users', 0),
                data.get('new_users', 0),
                data.get('returning_users', 0),
                data.get('engagement_rate'),
                data.get('engaged_sessions_per_user'),
                data.get('events_per_session'),
                data.get('conversions', 0),
                data.get('conversion_rate'),
                data.get('conversions_per_user'),
                data.get('total_revenue', 0),
                data.get('average_revenue_per_user'),
                data.get('pageviews', 0)
            ))
        
        logger.debug(f"Inserted GA4 metrics for {property_id} on {metric_date}")
    
    def insert_ga4_traffic_source(self, property_id: str, metric_date: date,
                                  channel_group: str, data: Dict,
                                  collection_id: Optional[int] = None) -> None:
        """Insert GA4 traffic source breakdown.
        
        Args:
            property_id: GA4 Property ID
            metric_date: Date the metrics represent
            channel_group: Traffic channel (Organic Search, Direct, etc.)
            data: Dictionary containing channel metrics
            collection_id: Optional collection ID
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO ga4_traffic_sources
                (property_id, metric_date, collection_id, channel_group,
                 sessions, engaged_sessions, conversions, engagement_rate, bounce_rate, new_users, total_users)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, metric_date, channel_group) DO UPDATE SET
                    collection_id = excluded.collection_id,
                    sessions = excluded.sessions,
                    engaged_sessions = excluded.engaged_sessions,
                    conversions = excluded.conversions,
                    engagement_rate = excluded.engagement_rate,
                    bounce_rate = excluded.bounce_rate,
                    new_users = excluded.new_users,
                    total_users = excluded.total_users,
                    collected_at = CURRENT_TIMESTAMP
            """, (
                property_id, metric_date, collection_id, channel_group,
                data.get('sessions', 0),
                data.get('engaged_sessions', 0),
                data.get('conversions', 0),
                data.get('engagement_rate'),
                data.get('bounce_rate'),
                data.get('new_users', 0),
                data.get('total_users', 0),
            ))
    
    def insert_ga4_device_metrics(self, property_id: str, metric_date: date,
                                  device_category: str, data: Dict,
                                  collection_id: Optional[int] = None) -> None:
        """Insert GA4 device breakdown metrics.
        
        Args:
            property_id: GA4 Property ID
            metric_date: Date the metrics represent
            device_category: Device type (mobile, desktop, tablet)
            data: Dictionary containing device metrics
            collection_id: Optional collection ID
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO ga4_device_metrics
                (property_id, metric_date, collection_id, device_category,
                 sessions, engaged_sessions, conversions, engagement_rate, bounce_rate, avg_session_duration)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, metric_date, device_category) DO UPDATE SET
                    sessions = excluded.sessions,
                    engaged_sessions = excluded.engaged_sessions,
                    conversions = excluded.conversions,
                    collected_at = CURRENT_TIMESTAMP
            """, (
                property_id, metric_date, collection_id, device_category,
                data.get('sessions', 0),
                data.get('engaged_sessions', 0),
                data.get('conversions', 0),
                data.get('engagement_rate'),
                data.get('bounce_rate'),
                data.get('avg_session_duration')
            ))
    
    def insert_ga4_event_facts(self, event_data: Dict, collection_id: Optional[int] = None) -> None:
        """Insert GA4 event-level facts.
        
        Per GA4_EVENTS_COLLECTOR_SPEC.md v1 - records raw event facts without interpretation.
        
        Args:
            event_data: Dictionary containing all event fields per spec
            collection_id: Optional collection ID
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO ga4_event_facts
                (event_name, event_date, event_timestamp, event_count,
                 property_id, property_name, site_type,
                 hostname, page_location, page_path, page_title, landing_page,
                 source, medium, campaign, default_channel_group, gclid,
                 device_category, operating_system, browser,
                 session_id, user_pseudo_id, session_number, engagement_time_msec, is_new_user,
                 event_params_json, collection_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, event_name, event_timestamp) DO UPDATE SET
                    event_count = excluded.event_count,
                    session_id = excluded.session_id,
                    user_pseudo_id = excluded.user_pseudo_id,
                    collected_at = CURRENT_TIMESTAMP
            """, (
                event_data['event_name'],
                event_data['event_date'],
                event_data['event_timestamp'],
                event_data.get('event_count', 1),
                event_data['property_id'],
                event_data['property_name'],
                event_data.get('site_type'),
                event_data.get('hostname'),
                event_data.get('page_location'),
                event_data.get('page_path'),
                event_data.get('page_title'),
                event_data.get('landing_page'),
                event_data.get('source'),
                event_data.get('medium'),
                event_data.get('campaign'),
                event_data.get('default_channel_group'),
                event_data.get('gclid'),
                event_data.get('device_category'),
                event_data.get('operating_system'),
                event_data.get('browser'),
                event_data.get('session_id'),
                event_data.get('user_pseudo_id'),
                event_data.get('session_number'),
                event_data.get('engagement_time_msec'),
                event_data.get('is_new_user'),
                event_data.get('event_params_json'),
                collection_id
            ))
        
        logger.debug(f"Inserted event fact: {event_data['event_name']} for {event_data['property_id']}")
    
    # =========================================================================
    # GSC DATA INSERTION
    # =========================================================================
    
    def insert_gsc_daily_metrics(self, property_id: str, metric_date: date,
                                data: Dict, collection_id: Optional[int] = None) -> None:
        """Insert Google Search Console daily metrics.
        
        PHASE 3 DUAL-WRITE: Writes property_id (legacy URL), gsc_site_url, and ga4_property_id.
        
        Args:
            property_id: Property identifier (GSC URL - legacy)
            metric_date: Date the metrics represent
            data: Dictionary containing GSC metrics
            collection_id: Optional collection ID
        """
        # Normalize URL
        site_url = property_id if property_id.endswith('/') else property_id + '/'
        
        # Map to GA4 ID
        ga4_id = self._gsc_url_to_ga4_map.get(site_url)
        
        if not ga4_id:
            logger.warning(f"UNMAPPED GSC URL: {site_url} - skipping insert")
            return  # Skip row if unmapped
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO gsc_daily_metrics
                (property_id, metric_date, collection_id,
                 clicks, impressions, ctr, average_position,
                 gsc_site_url, ga4_property_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, metric_date) DO UPDATE SET
                    clicks = excluded.clicks,
                    impressions = excluded.impressions,
                    ctr = excluded.ctr,
                    average_position = excluded.average_position,
                    gsc_site_url = excluded.gsc_site_url,
                    ga4_property_id = excluded.ga4_property_id,
                    collected_at = CURRENT_TIMESTAMP
            """, (
                property_id, metric_date, collection_id,
                data.get('clicks', 0),
                data.get('impressions', 0),
                data.get('ctr', 0.0),
                data.get('position', 0.0),
                site_url,        # gsc_site_url (dedicated field)
                ga4_id           # ga4_property_id (canonical)
            ))
        
        logger.debug(f"Inserted GSC metrics for {property_id} on {metric_date} (GA4: {ga4_id})")
    
    def insert_gsc_query(self, property_id: str, metric_date: str, query: str,
                         clicks: int, impressions: int, ctr: float, position: float,
                         gsc_site_url: str, ga4_property_id: str,
                         collection_id: Optional[int] = None) -> None:
        """Insert individual GSC query data.
        
        Args:
            property_id: GA4 Property ID (canonical)
            metric_date: Date the metrics represent (YYYY-MM-DD)
            query: Search query text
            clicks: Number of clicks
            impressions: Number of impressions
            ctr: Click-through rate (0-1)
            position: Average position
            gsc_site_url: GSC site URL
            ga4_property_id: GA4 property ID
            collection_id: Optional collection ID
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            # First delete existing record if any
            cursor.execute("""
                DELETE FROM gsc_queries 
                WHERE property_id = ? AND metric_date = ? AND query = ?
            """, (property_id, metric_date, query))
            
            # Then insert new record
            cursor.execute("""
                INSERT INTO gsc_queries
                (property_id, metric_date, query, collection_id,
                 clicks, impressions, ctr, average_position,
                 gsc_site_url, ga4_property_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                property_id, metric_date, query, collection_id,
                clicks, impressions, ctr, position,
                gsc_site_url, ga4_property_id
            ))
        
        logger.debug(f"Inserted GSC query '{query}' for {property_id} on {metric_date}")

    def insert_gsc_url_inspection(
        self,
        property_id: str,
        gsc_site_url: str,
        inspected_url: str,
        inspection_date: str,
        inspection_data: Dict[str, Any],
        collection_id: Optional[int] = None
    ) -> None:
        """Insert URL inspection result from GSC URL Inspection API.

        Args:
            property_id: GA4 Property ID
            gsc_site_url: GSC property URL used for inspection
            inspected_url: URL inspected
            inspection_date: Date of inspection run (YYYY-MM-DD)
            inspection_data: Parsed index/mobile/rich-result status fields
            collection_id: Optional collection ID
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO gsc_url_inspection
                (property_id, gsc_site_url, inspected_url, inspection_date, collection_id,
                 verdict, coverage_state, indexing_state, page_fetch_state, robots_txt_state,
                 crawled_as, last_crawl_time, google_canonical, user_canonical,
                 mobile_usability_verdict, rich_results_verdict,
                 referring_urls_count, sitemaps_count, raw_response_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, inspected_url, inspection_date) DO UPDATE SET
                    collection_id = excluded.collection_id,
                    verdict = excluded.verdict,
                    coverage_state = excluded.coverage_state,
                    indexing_state = excluded.indexing_state,
                    page_fetch_state = excluded.page_fetch_state,
                    robots_txt_state = excluded.robots_txt_state,
                    crawled_as = excluded.crawled_as,
                    last_crawl_time = excluded.last_crawl_time,
                    google_canonical = excluded.google_canonical,
                    user_canonical = excluded.user_canonical,
                    mobile_usability_verdict = excluded.mobile_usability_verdict,
                    rich_results_verdict = excluded.rich_results_verdict,
                    referring_urls_count = excluded.referring_urls_count,
                    sitemaps_count = excluded.sitemaps_count,
                    raw_response_json = excluded.raw_response_json,
                    collected_at = CURRENT_TIMESTAMP
            """, (
                property_id,
                gsc_site_url,
                inspected_url,
                inspection_date,
                collection_id,
                inspection_data.get('verdict'),
                inspection_data.get('coverage_state'),
                inspection_data.get('indexing_state'),
                inspection_data.get('page_fetch_state'),
                inspection_data.get('robots_txt_state'),
                inspection_data.get('crawled_as'),
                inspection_data.get('last_crawl_time'),
                inspection_data.get('google_canonical'),
                inspection_data.get('user_canonical'),
                inspection_data.get('mobile_usability_verdict'),
                inspection_data.get('rich_results_verdict'),
                inspection_data.get('referring_urls_count', 0),
                inspection_data.get('sitemaps_count', 0),
                inspection_data.get('raw_response_json')
            ))

    def insert_pilot_homepage_audit_evidence(
        self,
        property_id: str,
        property_name: str,
        page_url: str,
        metric_date: str,
        evidence: Dict[str, Any],
        collection_id: Optional[int] = None
    ) -> None:
        """Insert daily homepage browser-evidence row for a pilot property."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO pilot_homepage_audit_evidence
                (
                    property_id, property_name, page_url, metric_date, collection_id,
                    device_profile, lcp_start_time_ms, lcp_size, lcp_url,
                    lcp_tag_name, lcp_class_name, lcp_text, lcp_outer_html,
                    lcp_background_image, screenshot_path, main_document_status_code,
                    main_document_headers_json, lcp_resource_status_code, lcp_resource_headers_json,
                    total_request_count, failed_request_count, total_transfer_size,
                    network_summary_json, blocking_resources_json, console_errors_json,
                    browserstack_desktop_classification, browserstack_desktop_screenshot_path,
                    browserstack_iphone_classification, browserstack_iphone_screenshot_path,
                    browserstack_summary_json, raw_probe_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, page_url, metric_date, device_profile) DO UPDATE SET
                    collection_id = excluded.collection_id,
                    lcp_start_time_ms = excluded.lcp_start_time_ms,
                    lcp_size = excluded.lcp_size,
                    lcp_url = excluded.lcp_url,
                    lcp_tag_name = excluded.lcp_tag_name,
                    lcp_class_name = excluded.lcp_class_name,
                    lcp_text = excluded.lcp_text,
                    lcp_outer_html = excluded.lcp_outer_html,
                    lcp_background_image = excluded.lcp_background_image,
                    screenshot_path = excluded.screenshot_path,
                    main_document_status_code = excluded.main_document_status_code,
                    main_document_headers_json = excluded.main_document_headers_json,
                    lcp_resource_status_code = excluded.lcp_resource_status_code,
                    lcp_resource_headers_json = excluded.lcp_resource_headers_json,
                    total_request_count = excluded.total_request_count,
                    failed_request_count = excluded.failed_request_count,
                    total_transfer_size = excluded.total_transfer_size,
                    network_summary_json = excluded.network_summary_json,
                    blocking_resources_json = excluded.blocking_resources_json,
                    console_errors_json = excluded.console_errors_json,
                    browserstack_desktop_classification = excluded.browserstack_desktop_classification,
                    browserstack_desktop_screenshot_path = excluded.browserstack_desktop_screenshot_path,
                    browserstack_iphone_classification = excluded.browserstack_iphone_classification,
                    browserstack_iphone_screenshot_path = excluded.browserstack_iphone_screenshot_path,
                    browserstack_summary_json = excluded.browserstack_summary_json,
                    raw_probe_json = excluded.raw_probe_json,
                    collected_at = CURRENT_TIMESTAMP
            """, (
                property_id,
                property_name,
                page_url,
                metric_date,
                collection_id,
                evidence.get("device_profile", "mobile_chrome_headless"),
                evidence.get("lcp_start_time_ms"),
                evidence.get("lcp_size"),
                evidence.get("lcp_url"),
                evidence.get("lcp_tag_name"),
                evidence.get("lcp_class_name"),
                evidence.get("lcp_text"),
                evidence.get("lcp_outer_html"),
                evidence.get("lcp_background_image"),
                evidence.get("screenshot_path"),
                evidence.get("main_document_status_code"),
                evidence.get("main_document_headers_json"),
                evidence.get("lcp_resource_status_code"),
                evidence.get("lcp_resource_headers_json"),
                evidence.get("total_request_count"),
                evidence.get("failed_request_count"),
                evidence.get("total_transfer_size"),
                evidence.get("network_summary_json"),
                evidence.get("blocking_resources_json"),
                evidence.get("console_errors_json"),
                evidence.get("browserstack_desktop_classification"),
                evidence.get("browserstack_desktop_screenshot_path"),
                evidence.get("browserstack_iphone_classification"),
                evidence.get("browserstack_iphone_screenshot_path"),
                evidence.get("browserstack_summary_json"),
                evidence.get("raw_probe_json"),
            ))

    def get_gsc_url_inspection_history(self, property_id: str, days: int = 90) -> List[Dict]:
        """Get URL inspection history for a property.

        Args:
            property_id: GA4 Property ID
            days: Number of days to return

        Returns:
            URL inspection records newest first
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM gsc_url_inspection
                WHERE property_id = ?
                  AND inspection_date >= DATE('now', ? || ' days')
                ORDER BY inspection_date DESC, inspected_url ASC
            """, (property_id, -days))
            return [dict(row) for row in cursor.fetchall()]

    def insert_crux_history_metric(
        self,
        property_id: str,
        property_url: str,
        form_factor: str,
        metric_name: str,
        period_start_date: str,
        period_end_date: str,
        p75_value: Optional[float],
        raw_value: Optional[str] = None,
        collection_id: Optional[int] = None
    ) -> None:
        """Insert one CrUX History API metric timeseries point."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO crux_history_metrics
                (property_id, property_url, form_factor, metric_name,
                 period_start_date, period_end_date, p75_value, collection_id, raw_value)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, form_factor, metric_name, period_end_date) DO UPDATE SET
                    property_url = excluded.property_url,
                    period_start_date = excluded.period_start_date,
                    p75_value = excluded.p75_value,
                    collection_id = excluded.collection_id,
                    raw_value = excluded.raw_value,
                    collected_at = CURRENT_TIMESTAMP
            """, (
                property_id,
                property_url,
                form_factor,
                metric_name,
                period_start_date,
                period_end_date,
                p75_value,
                collection_id,
                raw_value
            ))

    def get_crux_history(self, property_id: str, days: int = 400) -> List[Dict]:
        """Get CrUX history rows for a property."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT *
                FROM crux_history_metrics
                WHERE property_id = ?
                  AND period_end_date >= DATE('now', ? || ' days')
                ORDER BY period_end_date DESC, metric_name ASC, form_factor ASC
            """, (property_id, -days))
            return [dict(row) for row in cursor.fetchall()]

    # =========================================================================
    # CLOUDFLARE CACHE AUDIT
    # =========================================================================

    def insert_cloudflare_cache_synthetic_check(
        self,
        *,
        property_id: str,
        property_name: str,
        normalized_domain: str,
        zone_name: str,
        zone_tag: Optional[str],
        request_date: str,
        path_tested: str,
        variant_key: str,
        request_sequence: int,
        request_data: Dict[str, Any],
        collection_id: Optional[int] = None,
    ) -> None:
        """Insert one Cloudflare synthetic cache-check row."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO cloudflare_cache_synthetic_checks
                (
                    property_id, property_name, normalized_domain, zone_name, zone_tag,
                    request_date, path_tested, variant_key, request_sequence,
                    final_url, http_status, cf_cache_status, ttfb_ms, total_time_ms,
                    response_bytes, headers_json, notes_json, audit_status,
                    request_timestamp, collection_id, device_profile, requested_url,
                    redirect_count, redirect_chain_json, cacheability_json, headers_full_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, request_date, path_tested, variant_key, request_sequence) DO UPDATE SET
                    property_name = excluded.property_name,
                    normalized_domain = excluded.normalized_domain,
                    zone_name = excluded.zone_name,
                    zone_tag = excluded.zone_tag,
                    final_url = excluded.final_url,
                    http_status = excluded.http_status,
                    cf_cache_status = excluded.cf_cache_status,
                    ttfb_ms = excluded.ttfb_ms,
                    total_time_ms = excluded.total_time_ms,
                    response_bytes = excluded.response_bytes,
                    headers_json = excluded.headers_json,
                    notes_json = excluded.notes_json,
                    audit_status = excluded.audit_status,
                    request_timestamp = excluded.request_timestamp,
                    device_profile = excluded.device_profile,
                    requested_url = excluded.requested_url,
                    redirect_count = excluded.redirect_count,
                    redirect_chain_json = excluded.redirect_chain_json,
                    cacheability_json = excluded.cacheability_json,
                    headers_full_json = excluded.headers_full_json,
                    collection_id = excluded.collection_id,
                    collected_at = CURRENT_TIMESTAMP
            """, (
                property_id,
                property_name,
                normalized_domain,
                zone_name,
                zone_tag,
                request_date,
                path_tested,
                variant_key,
                request_sequence,
                request_data.get('final_url'),
                request_data.get('http_status'),
                request_data.get('cf_cache_status'),
                request_data.get('ttfb_ms'),
                request_data.get('total_time_ms'),
                request_data.get('response_bytes'),
                request_data.get('headers_json'),
                request_data.get('notes_json'),
                request_data.get('audit_status'),
                request_data.get('timestamp'),
                collection_id,
                request_data.get('device_profile'),
                request_data.get('requested_url'),
                request_data.get('redirect_count'),
                request_data.get('redirect_chain_json'),
                request_data.get('cacheability_json'),
                request_data.get('headers_full_json'),
            ))

    def insert_cloudflare_zone_cache_daily(
        self,
        *,
        property_id: str,
        property_name: str,
        normalized_domain: str,
        zone_name: str,
        zone_tag: Optional[str],
        hostname: Optional[str],
        metric_date: str,
        zone_data: Dict[str, Any],
        collection_id: Optional[int] = None,
    ) -> None:
        """Insert one Cloudflare zone/day analytics row."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO cloudflare_zone_cache_daily
                (
                    property_id, property_name, normalized_domain, zone_name, zone_tag, hostname,
                    metric_date, window_start, window_end, dataset_name,
                    total_requests, cached_requests, uncached_requests, cache_hit_ratio,
                    cache_status_breakdown_json, supported_dimensions_json, supported_sum_fields_json,
                    query_attempts_json, raw_response_json, query_status, audit_status, collection_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, metric_date, normalized_domain) DO UPDATE SET
                    property_name = excluded.property_name,
                    zone_name = excluded.zone_name,
                    zone_tag = excluded.zone_tag,
                    hostname = excluded.hostname,
                    window_start = excluded.window_start,
                    window_end = excluded.window_end,
                    dataset_name = excluded.dataset_name,
                    total_requests = excluded.total_requests,
                    cached_requests = excluded.cached_requests,
                    uncached_requests = excluded.uncached_requests,
                    cache_hit_ratio = excluded.cache_hit_ratio,
                    cache_status_breakdown_json = excluded.cache_status_breakdown_json,
                    supported_dimensions_json = excluded.supported_dimensions_json,
                    supported_sum_fields_json = excluded.supported_sum_fields_json,
                    query_attempts_json = excluded.query_attempts_json,
                    raw_response_json = excluded.raw_response_json,
                    query_status = excluded.query_status,
                    audit_status = excluded.audit_status,
                    collection_id = excluded.collection_id,
                    collected_at = CURRENT_TIMESTAMP
            """, (
                property_id,
                property_name,
                normalized_domain,
                zone_name,
                zone_tag,
                hostname,
                metric_date,
                zone_data.get('window_start'),
                zone_data.get('window_end'),
                zone_data.get('dataset_name'),
                zone_data.get('total_requests'),
                zone_data.get('cached_requests'),
                zone_data.get('uncached_requests'),
                zone_data.get('cache_hit_ratio'),
                zone_data.get('cache_status_breakdown_json'),
                zone_data.get('supported_dimensions_json'),
                zone_data.get('supported_sum_fields_json'),
                zone_data.get('query_attempts_json'),
                zone_data.get('raw_response_json'),
                zone_data.get('query_status'),
                zone_data.get('audit_status'),
                collection_id,
            ))

    def get_cloudflare_cache_daily_summary(self, audit_date: str) -> List[Dict]:
        """Return per-domain cache summary rows for a given audit date."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                WITH synth AS (
                    SELECT
                        property_id,
                        property_name,
                        normalized_domain,
                        MAX(CASE WHEN path_tested = '/' AND variant_key = 'clean_desktop' AND request_sequence = 2 THEN audit_status END) AS homepage_status,
                        AVG(CASE WHEN path_tested = '/' AND variant_key = 'clean_desktop' AND request_sequence = 2 THEN ttfb_ms END) AS homepage_second_ttfb_ms,
                        MAX(CASE WHEN path_tested = '/' AND variant_key = 'clean_mobile' AND request_sequence = 2 THEN audit_status END) AS homepage_mobile_status,
                        AVG(CASE WHEN path_tested = '/' AND variant_key = 'clean_mobile' AND request_sequence = 2 THEN ttfb_ms END) AS homepage_mobile_second_ttfb_ms,
                        SUM(CASE WHEN request_sequence = 2 THEN 1 ELSE 0 END) AS total_second_requests,
                        SUM(CASE WHEN request_sequence = 2 AND UPPER(COALESCE(cf_cache_status, '')) = 'HIT' THEN 1 ELSE 0 END) AS second_request_hits
                    FROM cloudflare_cache_synthetic_checks
                    WHERE request_date = ?
                    GROUP BY property_id, property_name, normalized_domain
                )
                SELECT
                    synth.property_id,
                    synth.property_name,
                    synth.normalized_domain AS domain,
                    synth.homepage_status,
                    synth.homepage_second_ttfb_ms,
                    synth.homepage_mobile_status,
                    synth.homepage_mobile_second_ttfb_ms,
                    CASE
                        WHEN synth.total_second_requests > 0
                        THEN ROUND((CAST(synth.second_request_hits AS REAL) / synth.total_second_requests) * 100, 2)
                        ELSE NULL
                    END AS warm_hit_percent,
                    zone.cache_hit_ratio AS graphql_cache_hit_ratio,
                    zone.total_requests AS graphql_total_requests,
                    zone.cached_requests AS graphql_cached_requests,
                    zone.uncached_requests AS graphql_uncached_requests
                FROM synth
                LEFT JOIN cloudflare_zone_cache_daily AS zone
                  ON zone.property_id = synth.property_id
                 AND zone.metric_date = ?
                 AND zone.normalized_domain = synth.normalized_domain
                ORDER BY synth.normalized_domain ASC
            """, (audit_date, audit_date))
            return [dict(row) for row in cursor.fetchall()]

    def insert_cloudflare_zone_config_snapshot(
        self,
        *,
        property_id: str,
        property_name: str,
        normalized_domain: str,
        zone_name: str,
        zone_tag: Optional[str],
        snapshot_date: str,
        snapshot: Dict[str, Any],
        collection_id: Optional[int] = None,
    ) -> None:
        """Insert one Cloudflare zone config snapshot."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO cloudflare_zone_config_snapshots
                (
                    property_id, property_name, normalized_domain, zone_name, zone_tag,
                    snapshot_date, snapshot_status, zone_summary_json, cache_settings_json,
                    rulesets_json, raw_snapshot_json, collection_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, snapshot_date, normalized_domain) DO UPDATE SET
                    property_name = excluded.property_name,
                    zone_name = excluded.zone_name,
                    zone_tag = excluded.zone_tag,
                    snapshot_status = excluded.snapshot_status,
                    zone_summary_json = excluded.zone_summary_json,
                    cache_settings_json = excluded.cache_settings_json,
                    rulesets_json = excluded.rulesets_json,
                    raw_snapshot_json = excluded.raw_snapshot_json,
                    collection_id = excluded.collection_id,
                    collected_at = CURRENT_TIMESTAMP
            """, (
                property_id,
                property_name,
                normalized_domain,
                zone_name,
                zone_tag,
                snapshot_date,
                "ok" if snapshot.get("ok") else "error",
                json.dumps(snapshot.get("zone") or {}, sort_keys=True),
                json.dumps(snapshot.get("cache_related_settings") or [], sort_keys=True),
                json.dumps(snapshot.get("rulesets") or [], sort_keys=True),
                json.dumps(snapshot, sort_keys=True),
                collection_id,
            ))
    
    # =========================================================================
    # SEMRUSH DATA INSERTION
    # =========================================================================
    
    def insert_semrush_domain_metrics(self, property_id: str, metric_date: date,
                                     data: Dict, collection_id: Optional[int] = None) -> None:
        """Insert SEMRush domain metrics.
        
        Args:
            property_id: GA4 Property ID
            metric_date: Date the metrics represent
            data: Dictionary containing SEMRush metrics
            collection_id: Optional collection ID
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO semrush_domain_metrics
                (property_id, metric_date, collection_id,
                 organic_keywords_count, organic_keywords_top_3, organic_keywords_top_10,
                 organic_keywords_top_100, organic_traffic_estimate, organic_traffic_cost_estimate,
                 paid_traffic_estimate, visibility_score, average_position,
                 backlinks_count, referring_domains)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, metric_date) DO UPDATE SET
                    organic_keywords_count = excluded.organic_keywords_count,
                    organic_keywords_top_3 = excluded.organic_keywords_top_3,
                    organic_keywords_top_10 = excluded.organic_keywords_top_10,
                    organic_keywords_top_100 = excluded.organic_keywords_top_100,
                    organic_traffic_estimate = excluded.organic_traffic_estimate,
                    collected_at = CURRENT_TIMESTAMP
            """, (
                property_id, metric_date, collection_id,
                data.get('organic_keywords_count', 0),
                data.get('organic_keywords_top_3', 0),
                data.get('organic_keywords_top_10', 0),
                data.get('organic_keywords_top_100', 0),
                data.get('organic_traffic_estimate', 0),
                data.get('organic_traffic_cost_estimate'),
                data.get('paid_traffic_estimate'),
                data.get('visibility_score'),
                data.get('average_position'),
                data.get('backlinks_count'),
                data.get('referring_domains')
            ))
        
        logger.debug(f"Inserted SEMRush metrics for {property_id} on {metric_date}")
    
    # =========================================================================
    # GOOGLE BUSINESS PROFILE (GBP) DATA
    # =========================================================================
    
    def insert_gbp_daily_metrics(self, property_id: str, gbp_location_id: str,
                                metric_date: date, data: Dict,
                                collection_id: Optional[int] = None) -> None:
        """Insert Google Business Profile daily metrics.
        
        Args:
            property_id: GA4 Property ID
            gbp_location_id: GBP location resource name
            metric_date: Date the metrics represent
            data: Dictionary containing GBP metrics
            collection_id: Optional collection ID
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO gbp_daily_metrics
                (property_id, gbp_location_id, metric_date, collection_id,
                 business_impressions_desktop_maps, business_impressions_desktop_search,
                 business_impressions_mobile_maps, business_impressions_mobile_search,
                 business_conversations, business_direction_requests,
                 call_clicks, website_clicks,
                 business_bookings, business_food_orders, business_food_menu_clicks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, metric_date) DO UPDATE SET
                    business_impressions_desktop_maps = excluded.business_impressions_desktop_maps,
                    business_impressions_desktop_search = excluded.business_impressions_desktop_search,
                    business_impressions_mobile_maps = excluded.business_impressions_mobile_maps,
                    business_impressions_mobile_search = excluded.business_impressions_mobile_search,
                    business_conversations = excluded.business_conversations,
                    business_direction_requests = excluded.business_direction_requests,
                    call_clicks = excluded.call_clicks,
                    website_clicks = excluded.website_clicks,
                    business_bookings = excluded.business_bookings,
                    business_food_orders = excluded.business_food_orders,
                    business_food_menu_clicks = excluded.business_food_menu_clicks,
                    collected_at = CURRENT_TIMESTAMP
            """, (
                property_id, gbp_location_id, metric_date, collection_id,
                data.get('business_impressions_desktop_maps', 0),
                data.get('business_impressions_desktop_search', 0),
                data.get('business_impressions_mobile_maps', 0),
                data.get('business_impressions_mobile_search', 0),
                data.get('business_conversations', 0),
                data.get('business_direction_requests', 0),
                data.get('call_clicks', 0),
                data.get('website_clicks', 0),
                data.get('business_bookings', 0),
                data.get('business_food_orders', 0),
                data.get('business_food_menu_clicks', 0)
            ))
        
        logger.debug(f"Inserted GBP metrics for {property_id} on {metric_date}")
    
    def insert_gbp_search_keyword(self, property_id: str, gbp_location_id: str,
                                 year: int, month: int, keyword: str,
                                 impressions: int,
                                 collection_id: Optional[int] = None) -> None:
        """Insert Google Business Profile search keyword impression data.
        
        Args:
            property_id: GA4 Property ID
            gbp_location_id: GBP location resource name
            year: Year of the data
            month: Month (1-12)
            keyword: Search keyword
            impressions: Number of impressions
            collection_id: Optional collection ID
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO gbp_search_keywords
                (property_id, gbp_location_id, year, month, keyword, impressions, collection_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, year, month, keyword) DO UPDATE SET
                    impressions = excluded.impressions,
                    collected_at = CURRENT_TIMESTAMP
            """, (
                property_id, gbp_location_id, year, month, keyword, impressions, collection_id
            ))
        
        logger.debug(f"Inserted GBP keyword '{keyword}' for {property_id} ({year}-{month:02d})")
    
    def insert_gbp_search_keywords_batch(self, property_id: str, gbp_location_id: str,
                                        year: int, month: int,
                                        keywords: List[Dict],
                                        collection_id: Optional[int] = None) -> None:
        """Batch insert GBP search keywords.
        
        Args:
            property_id: GA4 Property ID
            gbp_location_id: GBP location resource name
            year: Year of the data
            month: Month (1-12)
            keywords: List of dicts with 'keyword' and 'impressions' keys
            collection_id: Optional collection ID
        """
        for kw in keywords:
            self.insert_gbp_search_keyword(
                property_id=property_id,
                gbp_location_id=gbp_location_id,
                year=year,
                month=month,
                keyword=kw['keyword'],
                impressions=kw['impressions'],
                collection_id=collection_id
            )
        
        logger.debug(f"Batch inserted {len(keywords)} GBP keywords for {property_id}")
    
    def insert_gbp_reviews_summary(self, property_id: str, gbp_location_id: str,
                                  metric_date: date, data: Dict,
                                  collection_id: Optional[int] = None) -> None:
        """Insert Google Business Profile reviews summary.
        
        Args:
            property_id: GA4 Property ID
            gbp_location_id: GBP location resource name
            metric_date: Date the data represents
            data: Dictionary with review metrics
            collection_id: Optional collection ID
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO gbp_reviews_summary
                (property_id, gbp_location_id, metric_date, collection_id,
                 total_review_count, average_rating, new_reviews_count)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, metric_date) DO UPDATE SET
                    total_review_count = excluded.total_review_count,
                    average_rating = excluded.average_rating,
                    new_reviews_count = excluded.new_reviews_count,
                    collected_at = CURRENT_TIMESTAMP
            """, (
                property_id, gbp_location_id, metric_date, collection_id,
                data.get('total_review_count', 0),
                data.get('average_rating'),
                data.get('new_reviews_count', 0)
            ))
        
        logger.debug(f"Inserted GBP reviews summary for {property_id} on {metric_date}")
    
    def get_gbp_metrics(self, property_id: str, days: int = 30) -> List[Dict]:
        """Get historical GBP metrics for a property.
        
        Args:
            property_id: GA4 Property ID
            days: Number of days of history to retrieve
            
        Returns:
            List of daily GBP metrics, newest first
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM gbp_daily_metrics
                WHERE property_id = ?
                  AND metric_date >= DATE('now', ? || ' days')
                ORDER BY metric_date DESC
            """, (property_id, -days))
            return [dict(row) for row in cursor.fetchall()]
    
    def get_gbp_search_keywords(self, property_id: str, year: int, month: int,
                               limit: int = 50) -> List[Dict]:
        """Get top GBP search keywords for a property.
        
        Args:
            property_id: GA4 Property ID
            year: Year
            month: Month (1-12)
            limit: Maximum number of keywords to return
            
        Returns:
            List of keyword dictionaries, sorted by impressions desc
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM gbp_search_keywords
                WHERE property_id = ?
                  AND year = ?
                  AND month = ?
                ORDER BY impressions DESC
                LIMIT ?
            """, (property_id, year, month, limit))
            return [dict(row) for row in cursor.fetchall()]
    
    def insert_gbp_review(self, review_data: Dict, property_id: str,
                         gbp_location_id: str,
                         collection_id: Optional[int] = None) -> None:
        """Insert a Google Business Profile review.
        
        Args:
            review_data: Dictionary with review fields (from GBPCollector.parse_review())
            property_id: GA4 Property ID
            gbp_location_id: GBP location ID
            collection_id: Optional collection ID
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO gbp_reviews
                (property_id, gbp_location_id, review_id, collection_id,
                 star_rating, star_rating_numeric, comment,
                 reviewer_display_name, reviewer_profile_photo_url, reviewer_is_anonymous,
                 has_reply, reply_comment, reply_update_time,
                 review_create_time, review_update_time, review_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                property_id, gbp_location_id,
                review_data.get('review_id'),
                collection_id,
                review_data.get('star_rating'),
                review_data.get('star_rating_numeric'),
                review_data.get('comment'),
                review_data.get('reviewer_display_name'),
                review_data.get('reviewer_profile_photo_url'),
                review_data.get('reviewer_is_anonymous', False),
                review_data.get('has_reply', False),
                review_data.get('reply_comment'),
                review_data.get('reply_update_time'),
                review_data.get('review_create_time'),
                review_data.get('review_update_time'),
                review_data.get('review_name')
            ))
        
        logger.debug(f"Inserted review {review_data.get('review_id')} for {property_id}")
    
    def insert_gbp_reviews_batch(self, reviews: List[Dict], property_id: str,
                                gbp_location_id: str,
                                collection_id: Optional[int] = None) -> int:
        """Batch insert GBP reviews.
        
        Args:
            reviews: List of review dictionaries
            property_id: GA4 Property ID
            gbp_location_id: GBP location ID
            collection_id: Optional collection ID
        
        Returns:
            Number of reviews inserted
        """
        count = 0
        for review in reviews:
            try:
                self.insert_gbp_review(review, property_id, gbp_location_id, collection_id)
                count += 1
            except Exception as e:
                logger.error(f"Error inserting review {review.get('review_id')}: {e}")
        
        logger.info(f"Batch inserted {count}/{len(reviews)} reviews for {property_id}")
        return count
    
    def get_gbp_reviews(self, property_id: str, limit: int = 100,
                       min_rating: Optional[int] = None,
                       has_comment: bool = True) -> List[Dict]:
        """Get GBP reviews for a property.
        
        Args:
            property_id: GA4 Property ID
            limit: Maximum number of reviews to return
            min_rating: Optional minimum star rating (1-5)
            has_comment: If True, only return reviews with comments
        
        Returns:
            List of review dictionaries, newest first
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            query = "SELECT * FROM gbp_reviews WHERE property_id = ?"
            params = [property_id]
            
            if min_rating:
                query += " AND star_rating_numeric >= ?"
                params.append(min_rating)
            
            if has_comment:
                query += " AND comment IS NOT NULL AND comment != ''"
            
            query += " ORDER BY review_create_time DESC LIMIT ?"
            params.append(limit)
            
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]
    
    def insert_review_sentiment(self, review_id: str, property_id: str,
                               sentiment_data: Dict) -> None:
        """Insert sentiment analysis for a review.
        
        Args:
            review_id: GBP review ID
            property_id: GA4 Property ID
            sentiment_data: Dictionary with sentiment analysis results
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO gbp_review_sentiment
                (review_id, property_id,
                 sentiment_score, sentiment_label, sentiment_confidence, emotion,
                 theme_maintenance, theme_staff, theme_amenities, theme_noise,
                 theme_location, theme_value, theme_move_in, theme_move_out,
                 theme_pets, theme_parking,
                 key_phrases, requires_attention, action_items,
                 openai_model, openai_prompt_tokens, openai_completion_tokens, analysis_cost_usd)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                review_id, property_id,
                sentiment_data.get('sentiment_score'),
                sentiment_data.get('sentiment_label'),
                sentiment_data.get('sentiment_confidence'),
                sentiment_data.get('emotion'),
                sentiment_data.get('theme_maintenance', False),
                sentiment_data.get('theme_staff', False),
                sentiment_data.get('theme_amenities', False),
                sentiment_data.get('theme_noise', False),
                sentiment_data.get('theme_location', False),
                sentiment_data.get('theme_value', False),
                sentiment_data.get('theme_move_in', False),
                sentiment_data.get('theme_move_out', False),
                sentiment_data.get('theme_pets', False),
                sentiment_data.get('theme_parking', False),
                sentiment_data.get('key_phrases'),
                sentiment_data.get('requires_attention', False),
                sentiment_data.get('action_items'),
                sentiment_data.get('openai_model'),
                sentiment_data.get('openai_prompt_tokens'),
                sentiment_data.get('openai_completion_tokens'),
                sentiment_data.get('analysis_cost_usd')
            ))
        
        logger.debug(f"Inserted sentiment for review {review_id}")
    
    def get_reviews_with_sentiment(self, property_id: str, days: int = 90) -> List[Dict]:
        """Get reviews with sentiment analysis for a property.
        
        Args:
            property_id: GA4 Property ID
            days: Number of days of history to retrieve
        
        Returns:
            List of reviews with sentiment data joined
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT r.*, s.*
                FROM gbp_reviews r
                LEFT JOIN gbp_review_sentiment s ON r.review_id = s.review_id
                WHERE r.property_id = ?
                  AND r.review_create_time >= datetime('now', ? || ' days')
                ORDER BY r.review_create_time DESC
            """, (property_id, -days))
            return [dict(row) for row in cursor.fetchall()]
    
    # =========================================================================
    # HEALTH SCORING
    # =========================================================================
    
    def insert_property_health(self, property_id: str, metric_date: date,
                              health_score: int, status: str,
                              traffic_score: Optional[int] = None,
                              engagement_score: Optional[int] = None,
                              conversion_score: Optional[int] = None,
                              performance_score: Optional[int] = None,
                              seo_score: Optional[int] = None,
                              traffic_change_7d: Optional[float] = None,
                              traffic_change_30d: Optional[float] = None) -> None:
        """Insert property health score and status.
        
        Args:
            property_id: GA4 Property ID
            metric_date: Date the health was calculated
            health_score: Overall health score (0-100)
            status: Health status (healthy, warning, degraded, critical, unknown)
            traffic_score: Traffic component score
            engagement_score: Engagement component score
            conversion_score: Conversion component score
            performance_score: Performance component score
            seo_score: SEO component score
            traffic_change_7d: 7-day traffic change percentage
            traffic_change_30d: 30-day traffic change percentage
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO property_health
                (property_id, metric_date, health_score, status,
                 traffic_score, engagement_score, conversion_score, performance_score, seo_score,
                 traffic_change_7d, traffic_change_30d)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(property_id, metric_date) DO UPDATE SET
                    health_score = excluded.health_score,
                    status = excluded.status,
                    traffic_score = excluded.traffic_score,
                    traffic_change_7d = excluded.traffic_change_7d,
                    traffic_change_30d = excluded.traffic_change_30d,
                    calculated_at = CURRENT_TIMESTAMP
            """, (
                property_id, metric_date, health_score, status,
                traffic_score, engagement_score, conversion_score, performance_score, seo_score,
                traffic_change_7d, traffic_change_30d
            ))
    
    def insert_health_issue(self, property_id: str, metric_date: date,
                           issue_type: str, severity: str, description: str,
                           metric_value: Optional[float] = None,
                           threshold_value: Optional[float] = None) -> None:
        """Record a health issue for a property.
        
        Args:
            property_id: GA4 Property ID
            metric_date: Date the issue was detected
            issue_type: Type of issue (traffic_drop, conversion_drop, etc.)
            severity: Issue severity (critical, high, medium, low)
            description: Human-readable description
            metric_value: Actual metric value
            threshold_value: Threshold that was crossed
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO health_issues
                (property_id, metric_date, issue_type, severity, description,
                 metric_value, threshold_value, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
            """, (
                property_id, metric_date, issue_type, severity, description,
                metric_value, threshold_value
            ))
    
    # =========================================================================
    # QUERIES FOR MONITORING
    # =========================================================================
    
    def get_latest_metrics_for_property(self, property_id: str) -> Optional[Dict]:
        """Get the most recent metrics for a property.
        
        Args:
            property_id: GA4 Property ID
            
        Returns:
            Dictionary with latest metrics, or None if no data
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM v_latest_property_metrics
                WHERE property_id = ?
            """, (property_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def get_portfolio_health_summary(self, metric_date: Optional[date] = None) -> Dict:
        """Get portfolio-wide health summary.
        
        Args:
            metric_date: Date to get summary for (defaults to today)
            
        Returns:
            Dictionary with portfolio health metrics
        """
        if metric_date is None:
            metric_date = date.today()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM portfolio_daily_summary
                WHERE metric_date = ?
            """, (metric_date,))
            row = cursor.fetchone()
            return dict(row) if row else {}
    
    def get_active_issues(self, limit: int = 50) -> List[Dict]:
        """Get active health issues across portfolio.
        
        Args:
            limit: Maximum number of issues to return
            
        Returns:
            List of issue dictionaries, sorted by severity
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM v_active_issues
                LIMIT ?
            """, (limit,))
            return [dict(row) for row in cursor.fetchall()]
    
    def get_historical_metrics(self, property_id: str, days: int = 30) -> List[Dict]:
        """Get historical GA4 metrics for a property.
        
        Args:
            property_id: GA4 Property ID
            days: Number of days of history to retrieve
            
        Returns:
            List of daily metrics, newest first
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM ga4_daily_metrics
                WHERE property_id = ?
                  AND metric_date >= DATE('now', ? || ' days')
                ORDER BY metric_date DESC
            """, (property_id, -days))
            return [dict(row) for row in cursor.fetchall()]
    
    # =========================================================================
    # MIGRATION & IMPORT
    # =========================================================================
    
    def import_from_json_snapshot(self, json_path: Path) -> Tuple[int, int]:
        """Import data from a portfolio monitor JSON snapshot.
        
        Args:
            json_path: Path to JSON file from portfolio_daily_monitor.py
            
        Returns:
            Tuple of (properties_imported, properties_failed)
        """
        with open(json_path, 'r') as f:
            snapshot = json.load(f)
        
        metric_date = datetime.strptime(snapshot['date'], '%Y-%m-%d').date()
        properties_imported = 0
        properties_failed = 0
        
        # Start collection tracking
        collection_id = self.start_data_collection(
            metric_date, 'daily', 'ga4'
        )
        
        for property_data in snapshot['properties']:
            try:
                property_id = property_data['property_id']
                
                # Ensure property exists
                self.upsert_property(
                    property_id=property_id,
                    canonical_name=property_data['name'],
                    active=True
                )
                
                # Insert GA4 metrics
                if property_data['status'] != 'unknown':
                    ga4_data = {
                        'sessions': property_data['current_sessions'],
                        'conversions': property_data['current_conversions'],
                        'engagement_rate': property_data['engagement_rate']
                    }
                    self.insert_ga4_daily_metrics(property_id, metric_date, ga4_data, collection_id)
                    
                    # Insert health score
                    self.insert_property_health(
                        property_id=property_id,
                        metric_date=metric_date,
                        health_score=property_data['health_score'],
                        status=property_data['status'],
                        traffic_change_7d=property_data['change_percent']
                    )
                    
                    # Insert issues
                    for issue in property_data.get('issues', []):
                        self.insert_health_issue(
                            property_id=property_id,
                            metric_date=metric_date,
                            issue_type='traffic_drop',
                            severity='high',
                            description=issue
                        )
                
                properties_imported += 1
                
            except Exception as e:
                logger.error(f"Failed to import {property_data.get('name', 'unknown')}: {e}")
                properties_failed += 1
        
        # Complete collection
        self.complete_data_collection(collection_id, properties_imported, properties_failed)
        
        logger.info(f"Imported {properties_imported} properties from {json_path}")
        return properties_imported, properties_failed


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def get_db() -> DatabaseManager:
    """Get database manager instance (singleton pattern).
    
    Returns:
        DatabaseManager instance
    """
    if not hasattr(get_db, '_instance'):
        get_db._instance = DatabaseManager()
    return get_db._instance


if __name__ == "__main__":
    # Test database initialization
    db = get_db()
    
    # Show database stats
    with db.get_connection() as conn:
        cursor = conn.cursor()
        
        # Count properties
        cursor.execute("SELECT COUNT(*) FROM properties")
        property_count = cursor.fetchone()[0]
        print(f"Properties in database: {property_count}")
        
        # Count daily metrics
        cursor.execute("SELECT COUNT(*) FROM ga4_daily_metrics")
        metrics_count = cursor.fetchone()[0]
        print(f"GA4 daily metrics records: {metrics_count}")
        
        # Count health records
        cursor.execute("SELECT COUNT(*) FROM property_health")
        health_count = cursor.fetchone()[0]
        print(f"Health records: {health_count}")
        
        # Show tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"\nTables in database ({len(tables)}):")
        for table in tables:
            print(f"  - {table}")
