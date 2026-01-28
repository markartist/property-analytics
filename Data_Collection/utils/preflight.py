#!/usr/bin/env python3
"""
Preflight Validation Utility
=============================
Runtime assertions for all scheduled jobs to enforce single source of truth.

Usage:
    from utils.preflight import validate_preflight
    validate_preflight(script_name=__file__)
"""

import os
import sys
from pathlib import Path
from datetime import datetime


# Canonical paths - single source of truth
CANONICAL_DB = Path('/Users/mark/Property_Analytics/data/portfolio_analytics.db')
CANONICAL_REGISTRY = Path('/Users/mark/Property_Analytics/config/venterra_properties_official.json')


def validate_preflight(script_name: str, require_db: bool = True, require_registry: bool = True) -> None:
    """
    Validate that the system is configured correctly before running any scheduled job.
    
    Checks:
    - Database path resolves to canonical DB
    - Registry path exists and is the official one
    - Environment variables (if present) point to canonical locations
    
    Args:
        script_name: Name of the calling script (usually __file__)
        require_db: Whether to require database validation (default True)
        require_registry: Whether to require registry validation (default True)
    
    Exits with code 1 if validation fails.
    """
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    script_basename = Path(script_name).name
    
    print(f'🔍 PREFLIGHT CHECK: {script_basename}')
    print(f'   Timestamp: {timestamp}')
    print()
    
    failed = False
    
    # Database validation
    if require_db:
        # Check environment variable if present
        env_db_path = os.getenv('PORTFOLIO_ANALYTICS_DB_PATH')
        if env_db_path:
            resolved_db = Path(env_db_path).resolve()
            print(f'   Database (env): {resolved_db}')
            
            if resolved_db != CANONICAL_DB.resolve():
                print(f'   ❌ ERROR: DB path mismatch!')
                print(f'      Expected: {CANONICAL_DB.resolve()}')
                print(f'      Got:      {resolved_db}')
                failed = True
            else:
                print(f'   ✅ Database path correct')
        else:
            # No env var - will use default, verify it exists
            print(f'   Database (default): {CANONICAL_DB}')
            if not CANONICAL_DB.exists():
                print(f'   ⚠️  WARNING: Canonical database does not exist')
            else:
                print(f'   ✅ Database path correct')
    
    # Registry validation
    if require_registry:
        print(f'   Registry: {CANONICAL_REGISTRY}')
        
        if not CANONICAL_REGISTRY.exists():
            print(f'   ❌ ERROR: Registry file does not exist!')
            failed = True
        else:
            print(f'   ✅ Registry exists')
    
    print()
    
    if failed:
        print('❌ PREFLIGHT FAILED - Aborting')
        print(f'   Script: {script_basename}')
        print(f'   Time: {timestamp}')
        sys.exit(1)
    else:
        print('✅ PREFLIGHT PASSED')
        print()


def validate_credential_file(env_var_name: str, description: str = 'credential file') -> Path:
    """
    Validate that a credential file exists and has proper permissions.
    
    Args:
        env_var_name: Environment variable containing path to credential file
        description: Human-readable description for error messages
    
    Returns:
        Path object to credential file
    
    Exits with code 1 if validation fails.
    """
    credential_path = os.getenv(env_var_name)
    
    if not credential_path:
        print(f'❌ ERROR: Environment variable {env_var_name} not set', file=sys.stderr)
        print(f'   Required for: {description}', file=sys.stderr)
        sys.exit(1)
    
    credential_file = Path(credential_path)
    
    if not credential_file.exists():
        print(f'❌ ERROR: Credential file does not exist', file=sys.stderr)
        print(f'   Environment variable: {env_var_name}', file=sys.stderr)
        print(f'   Expected path: {credential_file}', file=sys.stderr)
        sys.exit(1)
    
    # Check if file is empty
    if credential_file.stat().st_size == 0:
        print(f'❌ ERROR: Credential file is empty', file=sys.stderr)
        print(f'   File: {credential_file}', file=sys.stderr)
        sys.exit(1)
    
    # Check permissions (warn if too permissive)
    file_mode = credential_file.stat().st_mode & 0o777
    if file_mode & 0o077:  # Check if group/other have any permissions
        print(f'⚠️  WARNING: Credential file has overly permissive permissions: {oct(file_mode)}', file=sys.stderr)
        print(f'   File: {credential_file}', file=sys.stderr)
        print(f'   Recommended: chmod 600 {credential_file}', file=sys.stderr)
    
    return credential_file


def record_job_run(job_name: str, start_time: datetime, end_time: datetime, 
                   exit_code: int, db_path: str = None, rows_written: int = None) -> None:
    """
    Record job execution details to a stamp file for troubleshooting.
    
    Args:
        job_name: Name of the job
        start_time: Job start timestamp
        end_time: Job end timestamp  
        exit_code: Exit code (0 for success)
        db_path: Database path used (optional)
        rows_written: Number of rows written (optional)
    """
    log_dir = Path('/Users/mark/Property_Analytics/logs')
    log_dir.mkdir(parents=True, exist_ok=True)
    
    stamp_file = log_dir / 'job_runs.log'
    
    duration = (end_time - start_time).total_seconds()
    
    with open(stamp_file, 'a') as f:
        f.write(f'{end_time.strftime("%Y-%m-%d %H:%M:%S")}')
        f.write(f' | {job_name:30s}')
        f.write(f' | exit={exit_code}')
        f.write(f' | duration={duration:.1f}s')
        if db_path:
            f.write(f' | db={db_path}')
        if rows_written is not None:
            f.write(f' | rows={rows_written}')
        f.write('\n')
