# Data Pond WaterGlass Morning Brief

Date: 08/27/2026
Owner: MarketingOps / Property Analytics
Surface: Hosted Data Pond web UI

## Current State

- Corrective live deployment: `https://67a467ce.property-analytics.pages.dev`
- Corrective deploy commit: `a47e4e2` (`fix: restore Data Pond styling while keeping nav cleanup`)
- The rejected broad Venterra WaterGlass CSS layer has been removed from the live deployment.
- The active navigation cleanup remains in place: PIB Builder is active at `/analysis/pib`; POP Brief and Captain Brief are not active sidebar entries; old POP/T7/T30/Marketing destinations are removed from Pond/Dock active wayfinding.

## What Failed

The first WaterGlass pass changed too much of the shell at once and used visible white outlines across major layout surfaces. On the Venterra navy foundation this read as a hard wireframe, not a refined glass interface.

Do not repeat:

- Global shell/sidebar restyling before the card language is proven.
- High-contrast white borders as the main glass effect.
- Broad CSS changes across login, restricted states, sidebar, Pond, and Dock in one pass.
- Deploying a visual pass without screenshot proof against the intended effect.

## Desired Direction

The reference effect should be translated as a fine, multi-colored card edge, not a white outline system.

Use:

- Dark translucent card fills.
- Venterra-colored hairline or masked gradient strokes.
- Subtle inner highlight on the top/left edge.
- Category-colored glow that is quiet at rest and clearer on hover/focus.
- Official palette colors only: `#15284B`, `#294782`, `#3D66B9`, `#5A81CF`, `#7DCAC2`, `#3B9189`, `#E02472`, `#BD4830`, `#D6D6D2`, `#F6F6F5`, `#9B9B96`, black, and white.

## Morning Plan

1. Refresh framework context before editing: `ATLAS_WORKING_MEMORY.md`, `docs/CAPABILITY_REGISTER_2026-04-10.md`, and `docs/FULL_SYSTEM_AUDIT_2026-04-10.md`.
2. Keep the existing Clearwater/Data Pond shell, sidebar, login, and restricted-state styling intact.
3. Prototype the WaterGlass effect on a small card set only, preferably Dock cards or one Pond panel group.
4. Avoid adding a new global design layer until the card-level treatment is visually proven.
5. Verify with build plus screenshot/browser proof before any deploy.

## Required Checks

- `bash scripts/check_pib_guardrails.sh`
- `bash scripts/check_context_discipline.sh`
- `npm --prefix apps/web run build`

Boundary: this is a hosted web UI presentation lane only. Do not touch locked PIB generation/rendering/sending files.
