# SSL/TLS Technical Documentation

Status: Draft baseline
Date: 05/26/2026
Scope: Public SSL/TLS posture for `venterraliving.com` and the current platform example at `pilot.venterradev.com`

## 1. Purpose

Document the current public SSL/TLS posture for Venterra's web and platform surfaces, beginning with the live production marketing domain and the pilot platform example.

This document is intentionally limited to SSL/TLS, HTTPS routing, certificate metadata, and immediately adjacent edge-security headers. It does not define application authorization, user roles, PIB behavior, data contracts, or business workflow logic.

## 2. Systems Reviewed

| Host | Current role in this review | Observed edge/origin posture |
| --- | --- | --- |
| `https://venterraliving.com/` | Production public site SSL baseline only | Flywheel/Fastly edge, WordPress origin behavior |
| `https://pilot.venterradev.com/` | Example of the newer platform/pilot surface | Cloudflare edge, Kinsta/WordPress origin behavior |

The broader platform architecture already names `pilot.venterradev.com` as the pilot monitoring and reporting product surface, with Cloudflare Zero Trust intended as the access-control and trust boundary layer.

## 3. Current Executive Summary

Both reviewed hosts currently present valid publicly trusted Let's Encrypt certificates and negotiate HTTP/2 over HTTPS.

Key differences:

- `venterraliving.com` is currently strong from an HTTPS-enforcement perspective: valid certificate, HTTP-to-HTTPS redirect, canonical `www` redirect to apex, TLS 1.2/TLS 1.3 support, and HSTS with `includeSubDomains; preload`.
- `pilot.venterradev.com` is valid and Cloudflare-fronted, but the tested HTTPS response does not include an HSTS header. That should be corrected before treating the pilot hostname family as production-grade.
- `pilot.venterradev.com` appears to reject TLS 1.2 from the tested clients and negotiate TLS 1.3 successfully. That is secure, but it should be a deliberate compatibility decision for any users, tools, monitors, or legacy integrations.
- Neither endpoint stapled OCSP in the local `openssl s_client -status` test. This is not automatically a blocker, but it should be tracked as part of edge-provider TLS policy.

## 4. Certificate Inventory

### 4.1 `venterraliving.com`

| Field | Value |
| --- | --- |
| Subject | `CN=venterraliving.com` |
| Issuer | `C=US, O=Let's Encrypt, CN=R13` |
| Valid from | 04/03/2026 14:02:22 UTC |
| Valid until | 07/02/2026 14:02:21 UTC |
| Serial | `0610DE6583F41FED2B6F2EBF012191AD5AC6` |
| SHA-256 fingerprint | `B6:3B:0A:8C:CF:F0:32:A4:0B:24:7D:A8:34:B0:4B:6F:18:47:A9:C0:5B:27:EA:81:04:53:9B:62:1E:7A:2C:E7` |
| Public key | RSA 2048-bit |
| Certificate signature | SHA-256 with RSA |
| Extended key usage | TLS Web Server Authentication |
| SANs | `venterraliving.com`, `venterrraliving.com`, `www.venterraliving.com`, `www.venterrraliving.com` |
| Chain | Leaf -> Let's Encrypt R13 -> ISRG Root X1 |

Notes:

- The certificate includes both the correct spelling and a likely typo domain, `venterrraliving.com`, with three `r` characters after `vente`.
- The apex host resolves to Fastly/Flywheel edge IP `151.101.2.159`.
- `www.venterraliving.com` redirects to `https://venterraliving.com/`.

### 4.2 `pilot.venterradev.com`

| Field | Value |
| --- | --- |
| Subject | `CN=pilot.venterradev.com` |
| Issuer | `C=US, O=Let's Encrypt, CN=E7` |
| Valid from | 04/30/2026 13:33:40 UTC |
| Valid until | 07/29/2026 13:33:39 UTC |
| Serial | `06F7BA8FFF283C96799FE20F2E55D1FE57C7` |
| SHA-256 fingerprint | `38:51:BD:AD:9E:E5:09:89:81:B3:D7:77:83:7E:AE:95:E5:EB:D0:21:66:CF:4C:A1:5E:B9:5A:A5:F7:7A:63:AA` |
| Public key | ECDSA P-256 |
| Certificate signature | ECDSA with SHA-384 |
| Extended key usage | TLS Web Server Authentication |
| SANs | `pilot.venterradev.com` |
| Chain | Leaf -> Let's Encrypt E7 -> ISRG Root X1 |

Notes:

- The host resolves through Cloudflare IPv4 and IPv6 addresses.
- The observed origin/header posture includes Kinsta markers such as `ki-origin`, `ki-edge`, and `x-kinsta-cache`.
- The certificate is single-host. If additional platform subdomains are promoted, each hostname needs either its own certificate coverage or an approved wildcard/custom hostname model.

## 5. Protocol and Cipher Posture

| Host | HTTP version | ALPN | TLS observed | Cipher observed |
| --- | --- | --- | --- | --- |
| `venterraliving.com` | HTTP/2 | `h2` | TLS 1.3 default, TLS 1.2 accepted | TLS 1.3: `TLS_AES_128_GCM_SHA256`; TLS 1.2: `ECDHE-RSA-CHACHA20-POLY1305` |
| `pilot.venterradev.com` | HTTP/2 | `h2` | TLS 1.3 accepted; TLS 1.2 rejected in local tests | TLS 1.3: `TLS_AES_256_GCM_SHA384` |

Operational interpretation:

- TLS 1.3 should remain enabled for all platform surfaces.
- TLS 1.2 support is acceptable when required for compatibility, but only with modern AEAD cipher suites.
- TLS 1.0 and TLS 1.1 should remain disabled.
- If `pilot.venterradev.com` is intentionally TLS 1.3-only, document that as a platform compatibility standard and make sure monitoring tools use TLS 1.3-capable clients.

## 6. Redirects and HTTPS Enforcement

### 6.1 `venterraliving.com`

Observed behavior:

- `http://venterraliving.com/` returns `301` to `https://venterraliving.com/`.
- `http://www.venterraliving.com/` returns `301` to `https://venterraliving.com/`.
- `https://www.venterraliving.com/` returns `301` to `https://venterraliving.com/`.
- `https://venterraliving.com/` returns `200`.

This is the desired public-site pattern: force HTTPS and collapse `www` to a single canonical HTTPS apex.

### 6.2 `pilot.venterradev.com`

Observed behavior:

- `http://pilot.venterradev.com/` returns `301` to `https://pilot.venterradev.com/`.
- `https://pilot.venterradev.com/` returns `200`.

This is correct for basic HTTPS enforcement. HSTS should be added before relying on the hostname as a hardened production entry point.

## 7. Edge Security Headers

| Header | `venterraliving.com` | `pilot.venterradev.com` | Recommendation |
| --- | --- | --- | --- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Not observed | Add HSTS to platform hostnames after confirming all covered subdomains are HTTPS-ready |
| `X-Content-Type-Options` | `nosniff` | `nosniff` | Keep |
| `Referrer-Policy` | `no-referrer-when-downgrade` | Not observed | Prefer `strict-origin-when-cross-origin` for platform surfaces |
| `Content-Security-Policy` | Not observed | Not observed | Add once asset, API, analytics, and auth domains are inventoried |
| `X-Frame-Options` or CSP `frame-ancestors` | Not observed | Not observed | Add `frame-ancestors` policy for authenticated platform surfaces |
| `Permissions-Policy` | Not observed | Not observed | Add a minimal deny-by-default policy for browser features not used |

HSTS caution:

- `venterraliving.com` already sends `includeSubDomains; preload`. That means every covered subdomain under `venterraliving.com` must remain HTTPS-capable.
- Do not apply `includeSubDomains` to `venterradev.com` until all intended subdomains, development hostnames, and third-party integrations are known to be HTTPS-safe.

## 8. Recommended SSL Standard for Platform Surfaces

For platform hostnames such as `pilot.venterradev.com`, `app.venterradev.com`, `api.venterradev.com`, `vacs.venterradev.com`, and `specs.venterradev.com`:

1. Terminate public TLS at Cloudflare unless a specific exception is approved.
2. Use publicly trusted certificates managed by Cloudflare or the approved hosting provider.
3. Keep TLS 1.3 enabled.
4. Permit TLS 1.2 only when compatibility requires it, and only with modern AEAD ciphers.
5. Disable TLS 1.0 and TLS 1.1.
6. Redirect HTTP to HTTPS at the edge.
7. Add HSTS first without preload, then move toward `preload` only after a full subdomain readiness review.
8. Keep origin TLS valid and authenticated when Cloudflare proxies to an origin.
9. Separate edge admission from application authorization:
   - Cloudflare Access / Zero Trust controls who reaches protected platform surfaces.
   - Application roles control what an admitted user or service can do.
10. Treat certificate expiration, HTTPS redirects, HSTS, and TLS version checks as monitored release-readiness gates.

## 9. Renewal and Monitoring Requirements

Minimum checks:

- Certificate expires more than 21 days in the future.
- Certificate SAN list covers the intended hostnames.
- Issuer and chain are publicly trusted.
- HTTP redirects to HTTPS.
- Canonical host redirects are stable.
- TLS 1.0 and TLS 1.1 fail.
- TLS 1.2 policy is intentional and documented.
- TLS 1.3 succeeds.
- HSTS is present on production platform surfaces.
- Cloudflare/Kinsta/Flywheel edge headers match the expected hosting model.

Suggested monitoring cadence:

- Daily: certificate expiration and HTTPS availability.
- Weekly: security headers, redirects, and TLS version posture.
- Before release/promotion: all checks above for the target hostname.
- After DNS or hosting changes: rerun the full SSL validation set.

## 10. Validation Commands

Certificate metadata:

```bash
openssl s_client -servername venterraliving.com -connect venterraliving.com:443 </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -serial -fingerprint -sha256 -text
```

HTTP redirects and headers:

```bash
curl -sSIL https://venterraliving.com/
curl -sSIL https://pilot.venterradev.com/
curl -sSI http://venterraliving.com/
curl -sSI http://pilot.venterradev.com/
```

ALPN and TLS negotiation:

```bash
openssl s_client -servername pilot.venterradev.com -connect pilot.venterradev.com:443 -alpn h2,http/1.1 -brief </dev/null
```

DNS edge routing:

```bash
dig +short venterraliving.com A
dig +short www.venterraliving.com A
dig +short pilot.venterradev.com A
dig +short pilot.venterradev.com AAAA
```

## 11. Immediate Recommendations

1. Add HSTS to `pilot.venterradev.com` once all `venterradev.com` subdomain implications are reviewed. Start with a non-preload policy such as `max-age=31536000`, then decide separately whether `includeSubDomains` and preload are appropriate.
2. Decide whether platform hostnames should support TLS 1.2 or be TLS 1.3-only. The current pilot behavior appears TLS 1.3-only from local tests.
3. Add a platform security-header baseline: CSP, `frame-ancestors`, `Referrer-Policy`, and `Permissions-Policy`.
4. Add automated SSL checks to release readiness so certificate, redirect, TLS version, and HSTS regressions are caught before promotion.
5. Review the extra `venterrraliving.com` SAN coverage and confirm whether it is intentional typo protection.
