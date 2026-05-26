# AptIQ Watchlist Summary Source Contract

Date: 2026-05-05
Owner: Data Collection / Captain's Log
Status: Active advisory source route

## Purpose

The AptIQ watchlist summary route stores property-level AptIQ / ApartmentIQ-style PDF summaries as advisory Captain evidence. These packets explain market posture, exposure pressure, concession context, leasing velocity, days-on-market, and recommended recovery focus for watchlist and Spotlight properties.

This source does not override Data Pond source-of-record operating facts, unit availability, guest-card metrics, Marketing BI funnel exports, or official operating metrics. It is used to add market interpretation, comp-set framing, and recovery hypotheses.

## Source Location

Current manual drop:

- `/Users/mark/Downloads/watchlist`

Supported file shape:

- One PDF per property
- Filename pattern: `{Property Label} Summary.pdf`
- Text-native PDFs and scanned/image PDFs

## Identity Governance

Every source file is resolved through:

- `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`

The filename label is the identity anchor because some OCR'd PDF title lines are truncated. The extracted PDF title is retained in evidence metadata for audit.

## Storage

Local and remote-ready schema:

- `aptiq_watchlist_summaries`
- `aptiq_watchlist_summary_pages`

Primary fields:

- `report_date`
- `data_through_date`
- `property_label`
- `property_id`
- `community_id`
- `source_file`
- `source_sha256`
- `page_count`
- `report_title`
- `executive_summary`
- `key_insights`
- `recommendations`
- `metrics_json`
- `ocr_used`
- `extraction_status`
- `evidence_json`

## Ingestion

Canonical ingester:

- `/Users/mark/Property_Analytics/Data_Collection/utils/aptiq_watchlist_summary_ingest.py`

Behavior:

- Extracts embedded PDF text when present
- Uses OCR through local `pdftoppm` and `tesseract` when PDF pages have no embedded text
- Stores page-level text for audit
- Stores structured summary, key insight, recommendation, and metric evidence when reliably extractable
- Deduplicates source files by SHA-256

## Captain Use

Captain Briefs may use this source to:

- Explain why a property is underperforming relative to its market
- Identify whether exposure is driven by inventory mix, pricing/concessions, leasing execution, days-on-market, or application cancellation
- Compare internal recovery read against AptIQ's market interpretation
- Produce better watchlist peer learning across properties

Captain Briefs must label this source as advisory and reconcile it against current source-of-record facts before making operating claims.
