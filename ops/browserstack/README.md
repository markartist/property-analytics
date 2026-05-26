# BrowserStack Local Automation

This folder contains local Mac automation support for the pilot BrowserStack runs.

Credential precedence:

1. Keeper Secrets Manager via:
   - `KSM_BROWSERSTACK_USERNAME_NOTATION`
   - `KSM_BROWSERSTACK_ACCESS_KEY_NOTATION`
2. Environment variables:
   - `BROWSERSTACK_USERNAME`
   - `BROWSERSTACK_ACCESS_KEY`
3. File fallback:
   - `BROWSERSTACK_CREDENTIALS_FILE`

The daily local runner is:

- `/Users/mark/Property_Analytics/run_pilot_browserstack_daily.sh`

Repo-tracked LaunchAgent template:

- `/Users/mark/Property_Analytics/ops/browserstack/com.venterra.browserstack.pilot.daily.plist`

Typical install flow:

1. Ensure Keeper notations or fallback credentials are available.
2. Copy the plist into `~/Library/LaunchAgents/`
3. Load it with `launchctl`

Example verification:

```bash
python3 /Users/mark/Property_Analytics/ops/browserstack/browserstack_auth.py
```

Example export for shell use:

```bash
BROWSERSTACK_AUTH_OUTPUT=exports \
python3 /Users/mark/Property_Analytics/ops/browserstack/browserstack_auth.py
```
