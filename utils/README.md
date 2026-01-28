# Utils Directory

Shared utilities for Property Analytics projects.

## Available Utilities

### config_manager.py
**Configuration Manager** - Centralized configuration and path management

**Features:**
- Single source of truth for all paths
- Environment variable support
- Configuration loading helpers
- File validation utilities
- Environment-aware (dev/prod)

**Quick Start:**
```python
from utils.config_manager import Config

db_path = Config.get_db_path()
registry = Config.get_registry_path()
registry_data = Config.load_registry()
```

**Documentation:** See `/docs/PHASE1_EFFICIENCY_IMPROVEMENTS.md`

**Command-line testing:**
```bash
python3 utils/config_manager.py
```

---

### db_connection.py
**Database Connection** - Unified database connection management

**Features:**
- Context managers (automatic cleanup)
- Transaction management  
- Row factory support
- Query helpers (insert, update, delete)
- Consistent error handling

**Quick Start:**
```python
from utils.db_connection import DatabaseConnection

with DatabaseConnection() as db:
    results = db.query("SELECT * FROM properties")
```

**Documentation:** See `/docs/PHASE1_EFFICIENCY_IMPROVEMENTS.md`

**Command-line testing:**
```bash
python3 utils/db_connection.py
```

---

### email_sender.py
**Unified Email Sender** - Centralized email solution for all reporting systems

**Features:**
- Multi-provider support (Gmail, Office 365)
- Easy provider switching via config
- HTML & plain text emails
- Attachments support
- CC/BCC support
- CLI testing utility

**Quick Start:**
```python
from utils.email_sender import EmailSender

sender = EmailSender()
sender.send_email(
    subject="My Report",
    html_body="<h1>Report Content</h1>",
    recipients=["user@example.com"]
)
```

**Documentation:** See `/docs/EMAIL_SENDER_GUIDE.md` for complete documentation

**Command-line testing:**
```bash
python3 utils/email_sender.py \
    --subject "Test" \
    --body "Test message" \
    --recipients "your@email.com"
```

## Adding New Utilities

When adding new utilities to this directory:

1. Create well-documented Python modules
2. Follow existing patterns for imports and structure
3. Add usage examples in docstrings
4. Update this README
5. Add comprehensive documentation in `/docs/` if complex
6. Include CLI interface for standalone utilities

## Configuration

Most utilities use configuration from:
- `/Users/mark/Property_Analytics/credentials/` - Sensitive credentials
- `/Users/mark/Property_Analytics/config/` - Non-sensitive configuration

## Testing

Test utilities individually before integrating:
```bash
cd /Users/mark/Property_Analytics
python3 -m pytest utils/  # If tests exist
python3 utils/module_name.py --help  # For CLI utilities
```
