# Resi Source Attribution Lookup Runbook

Status: Active foundation
Owner: WebOps / MarketingOps
Last updated: 08/06/2026

## Rule

The visible default phone is the VWS attribution number from the Resi/ThirtyLines `trackingCodes` feed.

Incoming source URLs use the matching `trackingId` row from that same feed. The actual office phone must not be used as a generated display fallback. Missing or blank VWS attribution is a warning and a fix condition.

## Build

```bash
python3 scripts/build_resi_source_lookup_table.py
```

Outputs:

- Local SQLite tables: `resi_source_lookup_runs`, `resi_source_phone_lookup`
- Latest KV-ready payload: `/Users/mark/Property_Analytics/reports/resi_source_lookup/latest-resi-source-lookup.kv.json`
- Run packet: `/Users/mark/Property_Analytics/reports/resi_source_lookup/<run_id>/`

## Validate

```bash
node scripts/test_resi_source_attribution.mjs
```

Required checks:

- default URL resolves to VWS
- source-coded `?id=<trackingId>` resolves to that source row
- invalid id falls back to VWS
- office phone does not appear as a display fallback

## Publish To D1

Dry-run first:

```bash
python3 apps/api/scripts/resi_source_lookup_to_d1.py
```

Apply after reviewing the generated SQL manifest:

```bash
python3 apps/api/scripts/resi_source_lookup_to_d1.py --apply
```

This uses the existing Keeper-backed Wrangler helper and remote D1 database `pop-brief-db`.

## Publish To KV

No KV namespace is currently declared in the repo. Do not create one ad hoc from a property task.

Once the governed namespace exists, publish with:

```bash
python3 apps/api/scripts/resi_source_lookup_to_d1.py --apply --apply-kv --kv-namespace-id <namespace_id>
```

Default latest key:

```text
resi-source-lookup/latest
```

The script also writes an immutable run key:

```text
resi-source-lookup/runs/<run_id>
```

## Worker Contract

Use `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-source-attribution.js`.

Resolution order:

1. resolve property by hostname
2. resolve property by longest URL prefix
3. if still unresolved, resolve by valid tracking id
4. if source id belongs to the resolved property, use that row
5. otherwise use the property's VWS default row
6. warn if VWS is missing; do not substitute the office phone

## Promotion Gate

No property is production-approved until live proof shows:

- default URL displays VWS phone
- representative source URL displays source-specific phone
- invalid source id falls back to VWS
- phone links and visible text agree
- source attribution evidence is attached to the property packet
