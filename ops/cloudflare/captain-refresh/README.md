# Captain Refresh Worker

Cloudflare-owned refresh lane for Captain Office Wall and Captain persona state.

Production deployment:

- Custom domain: `captain-refresh.venterrawebops.com`
- Worker version: `6c0c4fa8-6ed9-47b6-a1c5-dd9072462742`
- Git commit: `d19b96d`
- Deployed: `08/24/2026`
- Initial health proof: `GET /health` returned `ok: true`
- Initial status proof: `GET /v1/captains/refresh/status` returned `ok: true` with no latest run before the first Cron Trigger fired.

Production intent:

- refresh active Captain state on a Cloudflare Cron Trigger;
- keep Captain persona/family-composition ownership in D1;
- write compact Office Wall snapshots to D1 for app/API reads;
- store JSON snapshot evidence in R2 under `captains/`;
- avoid direct intranet reach-in from Cloudflare.

Current schedule:

```text
*/30 * * * *
```

Endpoints:

- `GET https://captain-refresh.venterrawebops.com/health`
- `GET https://captain-refresh.venterrawebops.com/v1/captains/refresh/status`
- `GET https://captain-refresh.venterrawebops.com/v1/captains/<property>/wall`
- `POST https://captain-refresh.venterrawebops.com/v1/captains/refresh/run`

Manual refresh requires Worker secret `CAPTAIN_REFRESH_ADMIN_SECRET`. Do not create local secret files or direct-env workarounds. If manual triggering is needed, add the secret to Keeper/KSM and set the Worker secret through the Keeper-backed deployment path.

Tables:

- `captain_persona_profiles`
- `captain_refresh_runs`
- `captain_office_wall_snapshots`

R2 prefixes:

- `captains/office-wall/<property>/<run_id>.json`
- `captains/refresh-runs/<run_id>.json`

Boundary:

- This Worker mutates only the Captain refresh/persona/snapshot tables and R2 evidence files.
- It does not edit Jira, Confluence, Microsoft 365, source tickets, locked PIB files, or source-system data.
- External systems should feed Cloudflare through the existing mirror/push model unless a separate Keeper-backed API credential lane is explicitly approved.
