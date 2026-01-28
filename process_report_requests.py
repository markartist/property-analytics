#!/usr/bin/env python3
"""
Report Request Processor
========================

Processes JSON request files in REPORT_REQUESTS/ directory.
Called by Agent when starting new session without context.

Usage:
    python3 process_report_requests.py [--dry-run]

Agent should run this when user says:
- "Check for report requests"
- "Process REPORT_REQUESTS"
- "Any pending report requests?"
- "Execute report queue"
"""

import json
import os
import sys
import subprocess
from datetime import datetime
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent
REQUESTS_DIR = BASE_DIR / "REPORT_REQUESTS"
COMPLETED_DIR = REQUESTS_DIR / "completed"
FAILED_DIR = REQUESTS_DIR / "failed"

# Ensure subdirectories exist
COMPLETED_DIR.mkdir(exist_ok=True)
FAILED_DIR.mkdir(exist_ok=True)


def get_pending_requests():
    """Get all pending request JSON files"""
    if not REQUESTS_DIR.exists():
        return []
    
    return sorted([
        f for f in REQUESTS_DIR.glob("*.json")
        if f.name.startswith("request_")
    ])


def archive_request(request_file: Path, status: str, error_msg: str = None):
    """Archive completed or failed request"""
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    prefix = "COMPLETED" if status == "completed" else "FAILED"
    
    target_dir = COMPLETED_DIR if status == "completed" else FAILED_DIR
    new_name = f"{prefix}_{timestamp}_{request_file.name}"
    target_path = target_dir / new_name
    
    if error_msg and status == "failed":
        # Add error log to failed requests
        with open(request_file, 'r') as f:
            original = json.load(f)
        
        original['_processing_error'] = error_msg
        original['_failed_at'] = datetime.now().isoformat()
        
        with open(target_path, 'w') as f:
            json.dump(original, f, indent=2)
        
        request_file.unlink()
    else:
        request_file.rename(target_path)
    
    return target_path


def process_property_assessment(request_data: dict, dry_run: bool = False):
    """Process property_assessment request"""
    params = request_data.get('parameters', {})
    action = request_data.get('action', 'generate_only')
    
    print(f"  Action: {action}")
    print(f"  Report Type: {params.get('report_type', 'executive')}")
    print(f"  Recipients: {', '.join(params.get('recipients', []))}")
    
    if dry_run:
        print("  [DRY RUN] Would execute: python3 generate_executive_assessment.py")
        if action == "generate_and_email":
            print("  [DRY RUN] Would execute: python3 send_property_assessment.py")
        return True
    
    # Execute generator
    result = subprocess.run(
        ["python3", "generate_executive_assessment.py"],
        cwd=BASE_DIR,
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        raise Exception(f"Generator failed: {result.stderr}")
    
    print(f"  ✓ Report generated")
    
    # Send email if requested
    if action == "generate_and_email":
        result = subprocess.run(
            ["python3", "send_property_assessment.py"],
            cwd=BASE_DIR,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            raise Exception(f"Email failed: {result.stderr}")
        
        print(f"  ✓ Report emailed to {', '.join(params.get('recipients', []))}")
    
    return True


def process_custom_adhoc(request_data: dict, dry_run: bool = False):
    """Process custom_adhoc request"""
    params = request_data.get('parameters', {})
    
    print(f"  Title: {params.get('title', 'Untitled')}")
    print(f"  Template: {params.get('template', 'custom')}")
    
    if dry_run:
        print("  [DRY RUN] Would execute custom ad-hoc report generator")
        return True
    
    # This would need a custom implementation based on template
    print("  ⚠️  Custom ad-hoc reports require manual implementation")
    print("  See utils/generate_adhoc_report.py for examples")
    
    return False


def process_pib(request_data: dict, dry_run: bool = False):
    """Process PIB request"""
    params = request_data.get('parameters', {})
    property_code = params.get('property_code')
    
    print(f"  Property: {property_code}")
    print(f"  Date Range: {params.get('date_range_days', 30)} days")
    
    if dry_run:
        print(f"  [DRY RUN] Would execute PIB generator for {property_code}")
        return True
    
    # Execute PIB generator
    # This would integrate with existing PIB system
    print("  ⚠️  PIB generation requires integration with existing system")
    print("  See Property_Intelligence_Brief/ for details")
    
    return False


def process_request(request_file: Path, dry_run: bool = False):
    """Process a single request file"""
    print(f"\n{'='*70}")
    print(f"Processing: {request_file.name}")
    print(f"{'='*70}")
    
    try:
        with open(request_file, 'r') as f:
            request_data = json.load(f)
        
        request_type = request_data.get('request_type')
        print(f"Request Type: {request_type}")
        print(f"Created: {request_data.get('created', 'unknown')}")
        print(f"Created By: {request_data.get('created_by', 'unknown')}")
        
        if 'notes' in request_data.get('parameters', {}):
            print(f"Notes: {request_data['parameters']['notes']}")
        
        print()
        
        # Route to appropriate processor
        success = False
        if request_type == "property_assessment":
            success = process_property_assessment(request_data, dry_run)
        elif request_type == "custom_adhoc":
            success = process_custom_adhoc(request_data, dry_run)
        elif request_type == "pib":
            success = process_pib(request_data, dry_run)
        else:
            raise Exception(f"Unknown request type: {request_type}")
        
        if success and not dry_run:
            archived = archive_request(request_file, "completed")
            print(f"\n✅ Request completed and archived to: {archived.name}")
        elif not success:
            print(f"\n⚠️  Request not fully processed (manual intervention needed)")
        
        return success
        
    except Exception as e:
        print(f"\n❌ Error processing request: {e}")
        if not dry_run:
            archived = archive_request(request_file, "failed", str(e))
            print(f"   Request archived to: {archived.name}")
        return False


def main():
    dry_run = "--dry-run" in sys.argv
    
    print("=" * 70)
    print("REPORT REQUEST PROCESSOR")
    print("=" * 70)
    
    if dry_run:
        print("\n🔍 DRY RUN MODE - No actions will be taken\n")
    
    # Get pending requests
    pending = get_pending_requests()
    
    if not pending:
        print("\n✓ No pending requests found")
        print(f"  Location checked: {REQUESTS_DIR}")
        return 0
    
    print(f"\nFound {len(pending)} pending request(s):\n")
    for req in pending:
        print(f"  • {req.name}")
    
    # Process each request
    results = []
    for request_file in pending:
        success = process_request(request_file, dry_run)
        results.append((request_file.name, success))
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    successful = sum(1 for _, success in results if success)
    failed = len(results) - successful
    
    print(f"\nTotal Requests: {len(results)}")
    print(f"✅ Successful: {successful}")
    print(f"❌ Failed/Incomplete: {failed}")
    
    if dry_run:
        print("\n[DRY RUN] No files were modified")
    
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
