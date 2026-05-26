# Watchlist Shared Repository Standard

Date: 2026-05-07
Owner: Captain's Log / Data Pond / Watchlist Reporting
Status: Active

## Purpose

The shared Watchlist repository is the human-accessible publication and exchange directory for Watchlist, Spotlight, Critical, and related portfolio reporting artifacts.

Canonical shared path:

`/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Watchlist_Data`

## Boundary

This directory is a repository only.

It is not the system of record after ingestion. Data Pond remains the governed system of record. The shared directory is used for:

- exported BI/source files before ingestion
- current report publication files
- companion workbooks
- machine-readable JSON artifacts
- source logs/readiness receipts
- archived weekly/monthly artifacts

## Active Folder Structure

- `00_README`
- `01_Inbox_BI_Exports`
- `02_Inbox_Field_Notes`
- `03_Inbox_Competitor_Research`
- `04_Inbox_Web_Reputation`
- `05_Current_Reports`
- `06_Current_Companion_Files`
- `07_JSON_Data_Layer`
- `08_Source_Logs`
- `Archive`

Repository guidance files:

- `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Watchlist_Data/00_README/README_Watchlist_Data_Repository.md`
- `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Watchlist_Data/00_README/Daily_BI_Export_Checklist.md`

## Report Email Rule

Internal Watchlist/Captain/Spotlight emails should link to published files in this shared repository when practical instead of attaching large artifacts.

Email links must be actual SharePoint/OneDrive web sharing URLs. Local synced paths and `file://` URLs are not valid for outbound report emails because they will not resolve for recipients.

Recommended links:

- View Report
- Open Companion Workbook
- Open Source Coverage / Readiness
- Open JSON, when relevant

## Naming Standard

Use:

`PropertyName_ArtifactType_Version_YYYY-MM-DD.ext`

Portfolio exports should use:

`Report_Name_Portfolio_YYYY-MM-DD.xlsx`

## Governance

Do not overwrite linked reports. Publish a new dated/versioned file instead.

Do not store resident/person-level private data here unless explicitly approved.

Source files placed here still require Data Pond ingestion/validation before they are used as governed report facts.
