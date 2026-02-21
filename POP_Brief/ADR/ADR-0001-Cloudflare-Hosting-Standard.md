# ADR-0001: Cloudflare Hosting Standard

**Status**: Accepted
**Date**: 2026-02-20
**Author**: Mark Laufhutte

## Context

POP Brief requires a hosting platform that supports frontend delivery, serverless API execution, structured data storage, and file storage — with minimal operational overhead and reproducible deployments.

## Decision

POP Brief will be hosted on Cloudflare's integrated platform:

- **Cloudflare Pages** — Frontend hosting and static asset delivery.
- **Cloudflare Workers** — Serverless API execution layer.
- **Cloudflare D1** — SQLite-compatible relational database.
- **Cloudflare R2** — Object/file storage.

## Rationale

- **Minimal manual operations**: No server provisioning or patching.
- **Reproducible CLI-based deployment**: All deployments via Wrangler CLI.
- **Integrated DNS**: Managed under `venterradev.com` within the same platform.
- **Low operational overhead**: Single vendor for compute, storage, and delivery.
- **External hosting with login-required boundary**: Application is internet-accessible but authentication-gated.

## Consequences

- **SMTP cannot run directly in Workers.** Email delivery must use an HTTPS-based API provider (e.g., Resend, SendGrid, Postmark).
- **Wrangler is required** for all backend deployments. CI/CD pipelines must include Wrangler.
- **D1 has SQLite semantics**, which constrains query capabilities (no stored procedures, limited concurrent writes).
- **Vendor lock-in** to Cloudflare's edge platform for compute and storage primitives.
