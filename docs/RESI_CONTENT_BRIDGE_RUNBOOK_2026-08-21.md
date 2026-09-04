# Resi Content Bridge Runbook

Date: 08/21/2026
Status: Active guarded bridge
Owner: Data Pond / AI Content Suite

Agent primer:

- `docs/RESI_CONTENT_BRIDGE_AGENT_PRIMER_2026-08-22.md`

## Purpose

08/27/2026 product-direction supersession: the operator-facing content workspace is AI Content Suite inside the Pond. VACS is embedded drafting capability inside that workspace, and old Content Office is legacy for this lane. The bridge remains the guarded apply/readback mechanism only.

The Resi Content Bridge is the governed path between Data Pond content systems and live Resi content.

It exists so VACS, Site Content, Content Office, Captain/Navigator, and future Data Pond UI surfaces can see, draft, approve, apply, and verify Resi content changes without treating Resi as an unmanaged side system.

The bridge is not a bulk editor. It is an explicit apply and proof lane.

## AI Content Suite Source Provenance

As of 08/28/2026, AI Content Suite can read the existing Resi inventory as source provenance for a captured Site Content section. This is a read-only composed view, not a second content store and not an automatic binding workflow.

- Specs supplies the expected page and section contract.
- Site Content Creator supplies the captured live page section.
- The provenance resolver may inspect direct or nested Resi property website URLs and only reads safe fields tied to the resolved property source objects.
- Resi inventory supplies source object scope, property impact, and safe-field classification.
- A global or multi-property Resi object is inspect-only and is locked from property-level rewrite saves.
- A property-scoped match may be displayed as matched or suggested; it is not persisted as a durable `pond_content_system_bindings` row until a future explicit curator-confirmation workflow exists.

The Site Content rewrite API recomputes global-source locks before save. This is a drafting guardrail only; it neither creates a `pond_content_change_requests` row nor calls Resi. Any approved live mutation must still travel through this bridge's explicit change-request, approval, apply, readback, cache-clear, and public-delivery proof path.

## System Shape

Source system:

- Resi V2 management API: `https://v2.getresi.com/api/v2`
- Legacy Resi V1 API: `https://v2.getresi.com/api/v1`; this is for older/original V1 sites such as Delta, Camber, and Cendana, not V2-site cache control.
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

Legacy V1 cache clear requests require the exact confirmation phrase:

```bash
--confirm CLEAR_RESI_CONTENT_CACHE
```

Do not use the V1 cache clear path for Resi V2 sites such as The Vine. Resi does not have V2 cache control yet; Mark clears the applicable system cache manually in the Resi control panel when needed.

Every live content apply must:

- resolve the property through the governed property identity matrix
- confirm the Resi property id from the latest V2 property snapshot
- confirm the FAQ/object is linked to that property in the latest content inventory
- write a local `pond_content_change_requests` ledger row
- apply the smallest Resi `PATCH` payload
- read back V2 immediately
- record proof in `audit_json`
- wait for Mark/manual Resi control-panel system-cache clear when the V2 site needs it
- verify the rendered public website/browser layer

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

Verify the rendered public FAQ page after Mark clears the V2-site system cache:

```bash
python3 - <<'PY'
import requests
html = requests.get("https://thevinekyle.com/faqs/", timeout=30).text
assert "The Vine is now offering tours" in html
PY
```

Website-page checks are separate from V2 management proof because the public website may block scripted HTTP clients while normal browser traffic is fresh.

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

## Legacy V1 Cache Command

This command is retained only for older/original V1 sites where Resi confirms it applies. Do not use it for V2 sites such as The Vine.

```bash
python3 /Users/mark/Property_Analytics/scripts/resi_content_bridge.py \
  clear-property-cache \
  --property-code LEGACY_V1_PROPERTY_CODE \
  --change-request-id resi_faq_hard_hat_tx4ek_3d1e27857b7e \
  --confirm CLEAR_RESI_CONTENT_CACHE
```

The Resi V1 cache clear endpoint can return `202 Accepted`, but that does not make it the correct cache path for Resi V2 sites. For The Vine and other V2 sites, rely on V2 readback, refreshed Pond inventory, Mark/manual CP cache clear, and rendered website/browser proof.

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
6. A V1 `POST /cache/clear` was tested at the time, but was later clarified as not the correct cache path for Resi V2 sites.
7. Mark manually cleared the applicable system cache in the Resi control panel.
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
- Public site HTML checks are useful but not authoritative for Resi management state because website firewalls and downstream caches can differ from V2 readback.
- V1 is a different/original site set, not the current V2-site cache-control layer.
- Media deletion/detach remains outside the bridge because the Resi docs do not expose a safe delete/detach API path.
- Operational, legal, rights-sensitive, and publication-state fields require a higher approval posture than ordinary marketing copy.
