# Edge Experimentation Worker Dry-Run Contract

Date: 2026-05-02
Owner: Cloudflare Ops + Data Pond API + EVS
Status: Draft execution contract

## Purpose

The Worker dry-run mode proves that an approved experiment config can safely
target a page and component before any public page mutation occurs.

Dry-run must answer:

- Would the request be eligible?
- Would the experiment assign a variant?
- Would the target selector match?
- Would the configured rewrite be valid?
- What metadata and telemetry would be emitted?
- Would the Worker fail open to control if anything went wrong?

Dry-run is required before launch.

## Execution Principle

Dry-run evaluates everything except public mutation.

It may:

- fetch active/dry-run config
- evaluate host/path/property targeting
- compute or simulate assignment
- run selector matching
- validate the action payload
- emit dry-run telemetry
- return a proof payload to Data Pond/EVS

It must not:

- rewrite public HTML for normal visitors
- persist live assignment cookies for public visitors
- emit GA4 conversion events
- mutate experiment lifecycle state by itself
- promote or rollback experiments by itself

## Config Input

The Worker receives a versioned config payload from Data Pond or replicated
KV/R2.

Minimum payload:

```json
{
  "config_version": 1,
  "generated_at": "2026-05-02T00:00:00Z",
  "mode": "dry_run",
  "experiments": [
    {
      "experiment_id": "hero_secondary_cta_v1",
      "status": "approved",
      "property_code": "AR4PB",
      "community_id": "5d2b4e24-d6cb-42ba-8aa2-adfd7c81d440",
      "host": "www.venterraliving.com",
      "page_path": "/apartments/the-pointe-bentonville/",
      "page_type": "property_homepage",
      "component_id": "property_homepage.hero_primary_cta",
      "assignment_unit": "anonymous_visitor",
      "traffic_split_pct": 50,
      "variants": [
        {
          "variant_key": "control",
          "allocation_pct": 50,
          "action": "none"
        },
        {
          "variant_key": "B",
          "allocation_pct": 50,
          "action": "insert_adjacent",
          "target_selector": "[data-component='hero-primary-cta']",
          "payload": {
            "tag": "a",
            "text": "View Floor Plans",
            "href": "/apartments/the-pointe-bentonville/floorplans/",
            "class": "uk-button uk-button-secondary",
            "position": "after"
          }
        }
      ]
    }
  ]
}
```

## Dry-Run Trigger Modes

Supported trigger modes:

- Data Pond API requests a dry-run against a URL.
- EVS requests a dry-run as part of preflight validation.
- Operator uses an authenticated preview URL with an explicit dry-run header.

Required protection:

- dry-run endpoints require service or admin authentication.
- public visitors cannot trigger arbitrary dry-run payloads.
- dry-run config must come from Data Pond or signed replicated config, not query
  string JSON.

## Request Eligibility Evaluation

The Worker evaluates:

- host matches configured host.
- path matches configured page path.
- experiment status is eligible for dry-run.
- current time is within allowed preflight window if present.
- component contract exists in config.
- variant payload validates.

Output fields:

- `eligible`: boolean
- `ineligible_reason`: string or null
- `matched_experiment_ids`: array

## Assignment Simulation

Dry-run may simulate assignment without setting a public persistent cookie.

Modes:

- `force_control`
- `force_variant`
- `hash_simulation`

Recommended EVS mode:

- run once with `force_control`
- run once with `force_variant` for each non-control variant

Output fields:

- `assignment_mode`
- `assigned_variant`
- `assignment_unit`
- `would_set_cookie`: boolean
- `cookie_name`

## Selector Evaluation

The Worker evaluates target selectors during HTML streaming.

For each variant action:

- selector match count
- first match location when safely reportable
- action validity
- rewrite simulation status

Dry-run pass requirements:

- expected selector matches at least once.
- selector does not exceed allowed max matches unless component contract allows
  repeated components.
- action payload validates.
- generated element has safe tag, href, text, and class token.

## Allowed Dry-Run Actions

MVP actions:

- `none`
- `text_swap`
- `class_swap`
- `href_swap`
- `insert_adjacent`

Blocked:

- raw HTML injection
- script insertion
- inline event handlers
- form action mutation
- pricing/availability mutation
- application or checkout path mutation

## Output Proof Payload

The Worker returns or posts a dry-run proof payload.

```json
{
  "dry_run_id": "dryrun_20260502_001",
  "experiment_id": "hero_secondary_cta_v1",
  "config_version": 1,
  "url": "https://www.venterraliving.com/apartments/the-pointe-bentonville/",
  "property_code": "AR4PB",
  "community_id": "5d2b4e24-d6cb-42ba-8aa2-adfd7c81d440",
  "eligible": true,
  "assigned_variant": "B",
  "selector_results": [
    {
      "component_id": "property_homepage.hero_primary_cta",
      "target_selector": "[data-component='hero-primary-cta']",
      "match_count": 1,
      "status": "pass"
    }
  ],
  "rewrite_results": [
    {
      "variant_key": "B",
      "action": "insert_adjacent",
      "status": "would_apply",
      "safety_status": "pass"
    }
  ],
  "telemetry_preview": {
    "would_emit": ["experiment_exposure"],
    "zaraz_events": ["experiment_exposure", "experiment_click"]
  },
  "status": "pass",
  "errors": [],
  "created_at": "2026-05-02T00:00:00Z"
}
```

## Telemetry

Dry-run telemetry event:

- `experiment_dry_run`

Required properties:

- `dry_run_id`
- `experiment_id`
- `config_version`
- `property_code`
- `community_id`
- `page_path`
- `component_id`
- `assigned_variant`
- `selector_match_count`
- `dry_run_status`
- `error_code`

Dry-run telemetry should go to Data Pond. It should not be counted as a GA4
business exposure.

## Fail-Open Rules

Worker execution must fail open to control when:

- config is missing.
- config signature/hash is invalid.
- host/path does not match.
- experiment status is not executable.
- selector is missing.
- selector match count is unsafe.
- payload validation fails.
- rewrite throws.
- telemetry transport fails in a blocking way.

Fail-open output:

- original response body
- no experiment mutation
- no public assignment cookie for failed assignment
- Data Pond telemetry if possible

## EVS Integration

EVS preflight should request:

- control screenshot
- forced variant screenshot
- CTA click proof
- link destination proof
- console error summary
- network request summary
- visual diff note if available

EVS should attach its result to the experiment record:

- `evs_request_id`
- `dry_run_id`
- `desktop_status`
- `mobile_status`
- `cta_click_status`
- `console_status`
- `evidence_url`

## Launch Gate

Worker dry-run passes only when:

- request eligible.
- component selector matches within allowed count.
- variant payload validates.
- rewrite simulation succeeds.
- no blocked action is present.
- telemetry preview is valid.
- EVS proof passes after dry-run.

The Worker does not flip an experiment into `running`. Data Pond lifecycle
controls do that after approval and launch scheduling.

## Security Requirements

- Dry-run APIs require authenticated Data Pond/EVS/service access.
- Config payload must be versioned.
- Config should be signed or hash-verified.
- Do not accept raw experiment definitions from query strings.
- Do not expose internal errors to public visitors.
- Do not log raw visitor identifiers.
- Do not store PII in dry-run proof payloads.

## MVP Acceptance Criteria

- A dry-run can evaluate a configured property homepage without mutation.
- EVS can force control and variant render paths.
- Missing selector produces a failing proof payload.
- Invalid payload produces a failing proof payload.
- Valid payload produces a pass proof payload.
- Data Pond can display the dry-run proof in Experiment Lab.
- Public users cannot trigger dry-run with arbitrary config.
