# Resi Content Bridge Runbook

Date: 08/21/2026
Status: Active guarded bridge
Owner: Data Pond / Content Office

Agent primer:

- `docs/RESI_CONTENT_BRIDGE_AGENT_PRIMER_2026-08-22.md`

## Purpose

The Resi Content Bridge is the governed path between Data Pond content systems and live Resi content.

It exists so VACS, Site Content, Content Office, Captain/Navigator, and future Data Pond UI surfaces can see, draft, approve, apply, and verify Resi content changes without treating Resi as an unmanaged side system.

The bridge is not a bulk editor. It is an explicit apply and proof lane.

## System Shape

Source system:

- Resi V2 management API: `https://v2.getresi.com/api/v2`
- Resi V1 public delivery API: `https://v2.getresi.com/api/v1`
- Credentials: Keeper/KSM through `/Users/mark/Property_Analytics/utils/resi_auth.py`

Local Data Pond tables:

- `resi_v2_api_snapshots`
- `resi_content_inventory_runs`
- `resi_content_objects`
- `resi_content_property_links`
- `resi_content_fields`
- `resi_content_changeability_rules`
- `pond_content_system_bindings`
- `pond_content_change_requests`

Bridge command:

```bash
python3 /Users/mark/Property_Analytics/scripts/resi_content_bridge.py --help
```

## Guardrails

Read commands are safe by default.

Live Resi content writes require the exact confirmation phrase:

```bash
--confirm APPLY_RESI_CONTENT_CHANGE
```

Resi cache clear requests require the exact confirmation phrase:

```bash
--confirm CLEAR_RESI_CONTENT_CACHE
```

Every live content apply must:

- resolve the property through the governed property identity matrix
- confirm the Resi property id from the latest V2 property snapshot
- confirm the FAQ/object is linked to that property in the latest content inventory
- write a local `pond_content_change_requests` ledger row
- apply the smallest Resi `PATCH` payload
- read back V2 immediately
- record proof in `audit_json`
- optionally clear Resi property cache
- verify the V1 public delivery endpoint

The bridge does not mutate Resi host configuration, WordPress/Kinsta, Cloudflare, DNS, Resi Edge Workers, D1/KV, PIB, or property site infrastructure.

## Read Commands

Read from the latest Data Pond inventory snapshot:

```bash
python3 /Users/mark/Property_Analytics/scripts/resi_content_bridge.py \
  show-faq \
  --property-code TX4EK \
  --question "Can I tour The Vine?"
```

Read directly from live Resi V2:

```bash
python3 /Users/mark/Property_Analytics/scripts/resi_content_bridge.py \
  read-v2-faq \
  --property-code TX4EK \
  --faq-id 019ebdff-c18d-7195-80cc-e1e61b42e2df \
  --question "Can I tour The Vine?" \
  --expected-text "The Vine is now offering Hard Hat Tours"
```

Verify the public Resi delivery API:

```bash
python3 /Users/mark/Property_Analytics/scripts/resi_content_bridge.py \
  verify-public-faq \
  --property-code TX4EK \
  --question "Can I tour The Vine?" \
  --expected-text "The Vine is now offering Hard Hat Tours"
```

Optional website-page checks can be added with `--page-url`, but they are separate from Resi delivery proof because the public website may block scripted HTTP clients while normal browser traffic is fresh.

## Apply Command

Example shape for an approved FAQ answer change:

```bash
python3 /Users/mark/Property_Analytics/scripts/resi_content_bridge.py \
  apply-faq-answer \
  --property-code TX4EK \
  --faq-id 019ebdff-c18d-7195-80cc-e1e61b42e2df \
  --question "Can I tour The Vine?" \
  --answer-html '<p>Approved answer HTML goes here.</p>' \
  --confirm APPLY_RESI_CONTENT_CHANGE
```

For longer copy, use `--answer-html-file /path/to/approved-answer.html`.

The command writes or updates a `pond_content_change_requests` row, patches `/api/v2/faqs/{id}`, performs V2 readback, and sets `apply_status` to `applied_readback_verified` only when the live answer exactly matches the proposed answer.

## Cache Command

Clear Resi's property delivery cache:

```bash
python3 /Users/mark/Property_Analytics/scripts/resi_content_bridge.py \
  clear-property-cache \
  --property-code TX4EK \
  --change-request-id resi_faq_hard_hat_tx4ek_3d1e27857b7e \
  --confirm CLEAR_RESI_CONTENT_CACHE
```

The Resi cache clear endpoint returns `202 Accepted`. It clears Resi's delivery layer for the target property id. It does not guarantee CDN or public website cache refresh by itself.

## First Live Proof

Proof property:

- Property: The Vine Kyle Parkway
- Property code: `TX4EK`
- Website: `https://thevinekyle.com/`
- Resi property id: `019e6750-98ae-732d-9ef2-f4839506787c`
- FAQ id: `019ebdff-c18d-7195-80cc-e1e61b42e2df`
- Question: `Can I tour The Vine?`
- Change request id: `resi_faq_hard_hat_tx4ek_3d1e27857b7e`

Validated chain on 08/20/2026:

1. Resi V2 FAQ read identified the stale Hard Hat Tours copy.
2. Mark explicitly approved publishing the replacement FAQ answer.
3. V2 `PATCH /faqs/{id}` returned `200`.
4. V2 readback matched the approved answer exactly.
5. The local change request ledger recorded `applied_readback_verified`.
6. V1 `POST /cache/clear` returned `202 Accepted` for the property id.
7. V1 public FAQ delivery readback returned the updated answer.
8. Mark confirmed the public site rendered the updated FAQ in-browser.

Current approved answer:

```html
<p>Yes! The Vine is now offering Hard Hat Tours. Contact our team today to schedule yours and get an early look at our new apartment homes in Kyle.</p><p>Move in by 10/31 and get up to 8 weeks FREE + $750 OFF. <a href="https://online.venterraliving.com/eOnlineLease/portal/scheduleTour/TX4EK/"><strong>Schedule a Tour</strong></a> today.</p><p><em>*Restrictions apply. Contact us for details.</em></p>
```

## Relationship To Content Systems

Content Office:

- review current Resi copy and field editability
- approve change requests
- use the bridge for guarded application and proof

Site Content:

- map pages, FAQ sections, amenities, neighborhood copy, and content blocks to Resi source objects
- draft proposed copy into `pond_content_change_requests`
- verify public delivery after approved changes

VACS:

- consume current Resi field facts from Data Pond
- generate proposed rewrites as drafts
- never patch Resi directly

Captain/Navigator:

- use Resi content as property-scoped evidence
- flag stale or thin content
- link recommendations to affected Resi object ids and property impact

## Known Operating Notes

- Local inventory snapshots are point-in-time. After a live apply, use `read-v2-faq` or `verify-public-faq` for present-tense truth until the next inventory collection runs.
- Public site HTML checks are useful but not authoritative for Resi state because website firewalls and downstream caches can differ from Resi API delivery.
- Media deletion/detach remains outside the bridge because the Resi docs do not expose a safe delete/detach API path.
- Operational, legal, rights-sensitive, and publication-state fields require a higher approval posture than ordinary marketing copy.
