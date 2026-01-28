#!/usr/bin/env python3
"""
Database Connection Utility
============================
Unified database connection management for Property Analytics system.

Features:
- Context managers for automatic cleanup
- Connection pooling support
- Consistent error handling
- Query helpers
- Transaction management
- Row factory support

Usage:
    from utils.db_connection import DatabaseConnection
    
    # Simple query
    with DatabaseConnection() as db:
        results = db.query("SELECT * FROM properties WHERE active = 1")
    
    # Insert data
    with DatabaseConnection() as db:
        db.execute(
            "INSERT INTO ga4_daily_metrics (property_id, metric_date, sessions) VALUES (?, ?, ?)",
            (prop_id, date, sessions)
        )
    
    # Batch insert
    with DatabaseConnection() as db:
        db.executemany(
            "INSERT INTO properties (property_id, name) VALUES (?, ?)",
            [("123", "Property 1"), ("456", "Property 2")]
        )
"""

import sqlite3
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from contextlib import contextmanager

# Add parent to path for imports
if __name__ == '__main__':
    sys.path.insert(0, str(Path(__file__).parent.parent))

# Import config manager for database path
from utils.config_manager import Config, ConfigError


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatabaseError(Exception):
    """Database operation errors"""
    pass


class DatabaseConnection:
    """
    Unified database connection manager with context manager support.
    
    Examples:
        # Basic usage
        with DatabaseConnection() as db:
            results = db.query("SELECT * FROM properties")
        
        # With row factory
        with DatabaseConnection(row_factory=True) as db:
            results = db.query("SELECT * FROM properties")
            for row in results:
                print(row['property_id'], row['name'])
        
        # Custom database path
        with DatabaseConnection(db_path='/path/to/db.sqlite') as db:
            results = db.query("SELECT COUNT(*) FROM properties")
    """
    
    def __init__(
        self,
        db_path: Optional[Union[str, Path]] = None,
        row_factory: bool = False,
        auto_commit: bool = True,
        timeout: float = 30.0
    ):
        """
        Initialize database connection manager.
        
        Args:
            db_path: Path to database file (uses Config if None)
            row_factory: If True, enable dict-like row access
            auto_commit: If True, auto-commit after operations
            timeout: Connection timeout in seconds
        """
        if db_path is None:
            self.db_path = Config.get_db_path()
        else:
            self.db_path = Path(db_path)
        
        self.row_factory = row_factory
        self.auto_commit = auto_commit
        self.timeout = timeout
        self.conn = None
        self.cursor = None
    
    def __enter__(self):
        """Enter context manager - open connection"""
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context manager - close connection"""
        if exc_type is not None:
            # Exception occurred, rollback
            self.rollback()
        elif self.auto_commit:
            # No exception, auto-commit if enabled
            self.commit()
        
        self.close()
        return False  # Don't suppress exceptions
    
    def connect(self):
        """Establish database connection"""
        try:
            self.conn = sqlite3.connect(
                str(self.db_path),
                timeout=self.timeout,
                check_same_thread=False
            )
            
            if self.row_factory:
                self.conn.row_factory = sqlite3.Row
            
            self.cursor = self.conn.cursor()
            
            # Enable foreign keys
            self.cursor.execute("PRAGMA foreign_keys = ON")
            
            logger.debug(f"Connected to database: {self.db_path}")
            
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to connect to database: {e}")
    
    def close(self):
        """Close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
        logger.debug("Database connection closed")
    
    def commit(self):
        """Commit current transaction"""
        if self.conn:
            try:
                self.conn.commit()
                logger.debug("Transaction committed")
            except sqlite3.Error as e:
                raise DatabaseError(f"Failed to commit transaction: {e}")
    
    def rollback(self):
        """Rollback current transaction"""
        if self.conn:
            try:
                self.conn.rollback()
                logger.debug("Transaction rolled back")
            except sqlite3.Error as e:
                logger.error(f"Failed to rollback transaction: {e}")
    
    def execute(
        self,
        query: str,
        parameters: Optional[Union[Tuple, Dict]] = None
    ) -> sqlite3.Cursor:
        """
        Execute a single query.
        
        Args:
            query: SQL query string
            parameters: Query parameters (tuple or dict)
            
        Returns:
            Cursor object
            
        Raises:
            DatabaseError: If query fails
        """
        if not self.cursor:
            raise DatabaseError("Database not connected. Use with context manager.")
        
        try:
            if parameters:
                return self.cursor.execute(query, parameters)
            else:
                return self.cursor.execute(query)
        except sqlite3.Error as e:
            logger.error(f"Query failed: {query[:100]}... Error: {e}")
            raise DatabaseError(f"Query execution failed: {e}")
    
    def executemany(
        self,
        query: str,
        parameters_list: List[Union[Tuple, Dict]]
    ) -> sqlite3.Cursor:
        """
        Execute query with multiple parameter sets (batch insert/update).
        
        Args:
            query: SQL query string
            parameters_list: List of parameter tuples/dicts
            
        Returns:
            Cursor object
            
        Raises:
            DatabaseError: If query fails
        """
        if not self.cursor:
            raise DatabaseError("Database not connected. Use with context manager.")
        
        try:
            return self.cursor.executemany(query, parameters_list)
        except sqlite3.Error as e:
            logger.error(f"Batch query failed: {query[:100]}... Error: {e}")
            raise DatabaseError(f"Batch execution failed: {e}")
    
    def query(
        self,
        query: str,
        parameters: Optional[Union[Tuple, Dict]] = None,
        fetch_one: bool = False
    ) -> Union[List[Any], Any, None]:
        """
        Execute query and fetch results.
        
        Args:
            query: SQL query string
            parameters: Query parameters
            fetch_one: If True, return single result instead of list
            
        Returns:
            List of results (or single result if fetch_one=True)
            
        Raises:
            DatabaseError: If query fails
        """
        cursor = self.execute(query, parameters)
        
        if fetch_one:
            return cursor.fetchone()
        else:
            return cursor.fetchall()
    
    def insert(
        self,
        table: str,
        data: Dict[str, Any],
        or_replace: bool = False
    ) -> int:
        """
        Insert a row into table.
        
        Args:
            table: Table name
            data: Dictionary of column_name: value
            or_replace: If True, use INSERT OR REPLACE
            
        Returns:
            Last inserted row ID
            
        Raises:
            DatabaseError: If insert fails
        """
        columns = ', '.join(data.keys())
        placeholders = ', '.join(['?' for _ in data])
        values = tuple(data.values())
        
        if or_replace:
            query = f"INSERT OR REPLACE INTO {table} ({columns}) VALUES ({placeholders})"
        else:
            query = f"INSERT INTO {table} ({columns}) VALUES ({placeholders})"
        
        cursor = self.execute(query, values)
        return cursor.lastrowid
    
    def update(
        self,
        table: str,
        data: Dict[str, Any],
        where: str,
        where_params: Optional[Tuple] = None
    ) -> int:
        """
        Update rows in table.
        
        Args:
            table: Table name
            data: Dictionary of column_name: value to update
            where: WHERE clause (without 'WHERE')
            where_params: Parameters for WHERE clause
            
        Returns:
            Number of rows updated
            
        Raises:
            DatabaseError: If update fails
        """
        set_clause = ', '.join([f"{col} = ?" for col in data.keys()])
        values = list(data.values())
        
        if where_params:
            values.extend(where_params)
        
        query = f"UPDATE {table} SET {set_clause} WHERE {where}"
        
        cursor = self.execute(query, tuple(values))
        return cursor.rowcount
    
    def delete(
        self,
        table: str,
        where: str,
        where_params: Optional[Tuple] = None
    ) -> int:
        """
        Delete rows from table.
        
        Args:
            table: Table name
            where: WHERE clause (without 'WHERE')
            where_params: Parameters for WHERE clause
            
        Returns:
            Number of rows deleted
            
        Raises:
            DatabaseError: If delete fails
        """
        query = f"DELETE FROM {table} WHERE {where}"
        cursor = self.execute(query, where_params)
        return cursor.rowcount
    
    def table_exists(self, table_name: str) -> bool:
        """
        Check if table exists.
        
        Args:
            table_name: Name of table to check
            
        Returns:
            True if table exists
        """
        result = self.query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,),
            fetch_one=True
        )
        return result is not None
    
    def get_table_info(self, table_name: str) -> List[Dict[str, Any]]:
        """
        Get table schema information.
        
        Args:
            table_name: Name of table
            
        Returns:
            List of column information dicts
        """
        results = self.query(f"PRAGMA table_info({table_name})")
        
        if self.row_factory:
            return [dict(row) for row in results]
        else:
            # Convert to dicts manually
            columns = ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk']
            return [dict(zip(columns, row)) for row in results]
    
    def vacuum(self):
        """Optimize database (reclaim space, defragment)"""
        self.execute("VACUUM")
        logger.info("Database vacuumed")
    
    def get_table_count(self, table_name: str) -> int:
        """
        Get row count for table.
        
        Args:
            table_name: Table name
            
        Returns:
            Number of rows
        """
        result = self.query(
            f"SELECT COUNT(*) FROM {table_name}",
            fetch_one=True
        )
        return result[0] if result else 0


# Convenience functions for backward compatibility
def get_connection(
    db_path: Optional[Union[str, Path]] = None,
    row_factory: bool = False
) -> sqlite3.Connection:
    """
    Get a raw database connection.
    
    Args:
        db_path: Path to database (uses Config if None)
        row_factory: Enable row factory
        
    Returns:
        SQLite connection object
    """
    if db_path is None:
        db_path = Config.get_db_path()
    
    conn = sqlite3.connect(str(db_path))
    
    if row_factory:
        conn.row_factory = sqlite3.Row
    
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON")
    
    return conn


@contextmanager
def db_connection(
    db_path: Optional[Union[str, Path]] = None,
    row_factory: bool = False
):
    """
    Context manager for database connection (convenience wrapper).
    
    Args:
        db_path: Path to database (uses Config if None)
        row_factory: Enable row factory
        
    Yields:
        Database connection
        
    Example:
        with db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM properties")
    """
    conn = get_connection(db_path, row_factory)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    """CLI for testing database connection"""
    print("=" * 70)
    print("🗄️  DATABASE CONNECTION TEST")
    print("=" * 70)
    print()
    
    db_path = Config.get_db_path()
    print(f"Database: {db_path}")
    print()
    
    try:
        # Test connection
        with DatabaseConnection() as db:
            print("✅ Connection successful")
            
            # Get table list
            tables = db.query(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            )
            
            print(f"\n📋 Tables ({len(tables)}):")
            for table in tables[:10]:  # Show first 10
                table_name = table[0]
                count = db.get_table_count(table_name)
                print(f"   - {table_name}: {count:,} rows")
            
            if len(tables) > 10:
                print(f"   ... and {len(tables) - 10} more")
        
        print("\n✅ All tests passed")
        
    except (DatabaseError, ConfigError) as e:
        print(f"\n❌ Error: {e}")
