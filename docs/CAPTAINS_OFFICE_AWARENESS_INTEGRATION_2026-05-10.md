# Captain's Office / Captain's Quarters Awareness Integration

Date: 05/10/2026

## Surface

Captain's Office remains the human-facing operational workspace.

Captain's Quarters is the Captain's working memory and stewardship space inside Captain's Office. It displays:

- Captain identity
- self-note count
- open commitments
- verification-needed count
- uncertainty
- do-not-recommend-without-more-evidence reminders
- active self notes
- open commitments
- summary-level regional awareness
- care warnings

It allows limited creation of:

- self note
- commitment

The UI does not promote memory, publish artifacts, browse raw regional memory, mutate Data Pond, or bypass governance.

## Labels

The surface explicitly states:

- Self notes are not canonical truth.
- Human-submitted memory requires verification.
- Regional awareness is summary-level.
- Memory can expire or be archived.
- Fleet Scribe remains publication authority.
- Quartermaster remains blocking.

Captain's Log is the chronological continuity/archive layer for runtime history, reflection events, archived lessons, memory correction trail, superseded context, and commitment status changes.

## API Boundary

Captain's Quarters consumes `/v1/awareness/*` endpoints through Captain's Office. It does not recreate memory logic in the frontend. PropertyAccessControl remains the security boundary; frontend checks are not trusted as authorization.
