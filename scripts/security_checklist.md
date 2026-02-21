# POP Brief — Security Smoke Test Checklist

Run these tests against a local `wrangler dev` instance (port 8787) or staging.

## 1. Cookie Flags
- [ ] Login response `Set-Cookie` header includes `HttpOnly`
- [ ] Login response `Set-Cookie` header includes `Secure`
- [ ] Login response `Set-Cookie` header includes `SameSite=Lax`
- [ ] Login response `Set-Cookie` header includes `Max-Age=259200` (72h)
- [ ] Login response `Set-Cookie` header includes `Path=/`
- [ ] Logout response clears cookie with `Max-Age=0`

```bash
curl -v -X POST http://localhost:8787/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"testpassword"}' 2>&1 | grep Set-Cookie
```

## 2. Unauthorized Access
- [ ] `GET /v1/communities` without cookie → 401
- [ ] `GET /v1/metrics` without cookie → 401
- [ ] `GET /v1/analysis?week_ending=2026-02-20` without cookie → 401
- [ ] `GET /v1/admin/users` without cookie → 401
- [ ] `GET /v1/exports/csv?entity=communities` without cookie → 401
- [ ] `POST /v1/auth/me` without cookie → 401

## 3. Admin-Only Enforcement (ADR-0003)
Login as a non-admin user first, then verify:
- [ ] `POST /v1/communities` → 403
- [ ] `PATCH /v1/communities/:id` → 403
- [ ] `DELETE /v1/communities/:id` → 403
- [ ] `POST /v1/metrics/import/paste` → 403
- [ ] `DELETE /v1/metrics` → 403
- [ ] `POST /v1/admin/invites` → 403
- [ ] `GET /v1/admin/users` → 403
- [ ] `GET /v1/exports/csv?entity=communities` → 403

## 4. Rate Limiting
- [ ] Login: 6th attempt within 15 minutes from same IP → 429 with `Retry-After` header
- [ ] Scan-mentions: 11th request within 1 minute from same user → 429

```bash
# Rapid login attempts (expect 429 on 6th)
for i in $(seq 1 6); do
  echo "Attempt $i:"
  curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8787/v1/auth/login \
    -H "Content-Type: application/json" -d '{"email":"bad@example.com","password":"wrong"}'
  echo ""
done
```

## 5. CSV Injection Protection
- [ ] Export CSV for entity with data containing `=SUM(A1)` in a text field
- [ ] Verify the cell is prefixed with `'` in the CSV output (e.g. `'=SUM(A1)`)
- [ ] Same for cells starting with `+`, `-`, `@`

## 6. HTML Sanitization
- [ ] `PATCH /v1/marketing/:id` with `notes_text: "<script>alert(1)</script>"` → 400
- [ ] `PATCH /v1/marketing/:id` with `notes_text: "<div onclick=alert(1)>"` → 400
- [ ] `POST /v1/metrics/import/paste` with `notes_text` containing `<script>` → 400
- [ ] Normal text (no HTML) passes validation

## 7. Error Response Safety
- [ ] 500 errors return generic message, no stack traces or secrets
- [ ] 404 errors use consistent `{ error: { code, message, details } }` format
- [ ] Invalid JSON body → 400 (not 500)

## 8. Audit Logging
After performing admin actions, verify `audit_log` table has entries:
- [ ] Community create → `community.create` row
- [ ] Community update → `community.update` row with before/after
- [ ] Community delete → `community.delete` row
- [ ] Invite create → `invite.create` row
- [ ] Metrics import → `metrics.import` row
- [ ] Metrics delete → `metrics.delete` row
- [ ] CSV export → `export.csv` row

```sql
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;
```

## 9. Safe Defaults
- [ ] `ENABLE_EMAIL_SEND` defaults to `"false"` in `wrangler.toml`
- [ ] Scan-mentions with email disabled creates `notification_events` but does not call Resend
- [ ] Global error handler never leaks secret values
