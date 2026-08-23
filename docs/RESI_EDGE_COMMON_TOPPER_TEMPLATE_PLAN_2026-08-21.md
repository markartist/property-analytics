# Resi Edge Common Topper Template Plan

Human date: 08/21/2026

## Objective

Convert the current Resi Edge mobile topper into a governed common template fed entirely by property-specific tokens, then bring the current seven active pilot/lease-up domains onto that template without property-specific Worker rebuilds.

Current seven:

- `calaismidtownapartments.com`
- `championsgreen.com`
- `theharrisonsandysprings.com`
- `ventanaapts.com`
- `thedistrictuniversal.com`
- `thevinekyle.com`
- `townestoneat359.com`

## Non-Negotiables

- One canonical runtime/template.
- Property-specific differences live in manifests/tokens only.
- No desktop topper.
- No WordPress admin/control path optimization or caching.
- No direct analytics loaders in WordPress; analytics remains Zaraz-owned unless explicitly approved.
- Preserve Heap environment variables and differentiated Heap/Zaraz `data-vtr-*` attributes on every tracked link/control.
- Full manifest drawer nav must render; no link limiters or priority slicing.
- Stop on any failed gate and preserve evidence.

## First Fix Before Any Apply

The 08/20/2026 District apply stopped after rollback because the new browser proof used `get_path(manifest, "mobile_shell.navigation.links", [])`, but the helper accepts only two arguments. Fix this runner bug first, then re-run District stage before any live apply.

Required runner correction:

- Replace the three-argument `get_path` call with a safe two-argument read plus fallback.
- Keep the browser proof that compares rendered drawer links against `mobile_shell.navigation.links`.
- Keep the proof that each drawer link has `action`, `surface`, `element`, and `destination`.

## Template Boundary

Common shell owns:

- Mobile header layout
- Promo bar and promo drawer behavior
- Drawer open/close behavior
- Drawer markup pattern
- Full manifest nav rendering
- Hero section layout
- Review/rating rendering
- First content block rendering
- Awards rendering
- Native continuation iframe/loading
- Consent widget injection
- Heap environment bootstrap
- Zaraz event bridge
- Contentsquare verification suppression
- Source-coded phone resolution
- Admin/control path bypass policy
- Desktop native pass-through
- Asset repair/R2 asset serving
- Cache-control policy

Property manifest owns:

- Property identity
- Domain and canonical URL
- Cloudflare route pattern
- Brand colors/tokens
- Font assets/tokens
- Promo/special copy and CTAs
- Header/nav/tour/apply URLs
- Hero media/title/headline/CTA
- Reviews rating/count/link/source
- Awards presence/assets/source
- Content block copy/assets/CTAs
- Phone attribution source lookup
- GA4/Heap/Zaraz identifiers
- SEO/meta/schema URLs
- GSC/Captain/Data Pond evidence paths
- Rollback language

## Tokenization Candidates

Identity tokens:

- `target.property_code`
- `target.source_property_code`
- `target.domain`
- `target.property_name`
- `target.city`
- `target.state`
- `target.community_id`
- `target.canonical_url`
- `target.governed_reference_url`

Routing tokens:

- `routing.cloudflare_zone_name`
- `routing.route_pattern`
- `routing.existing_worker_script`
- `routing.mutation_policy`

Layout tokens:

- `mobile_shell.layout_contract.mobile_only`
- `mobile_shell.layout_contract.desktop_topper_allowed`
- `mobile_shell.layout_contract.property_specific_variants_allowed`
- `mobile_shell.layout_contract.promo_bar_height_px`
- `mobile_shell.layout_contract.header_height_px`
- `mobile_shell.layout_contract.full_height_mobile_hero_required`

Theme tokens:

- `mobile_shell.brand_theme.promo_background`
- `mobile_shell.brand_theme.promo_text`
- `mobile_shell.brand_theme.promo_surface`
- `mobile_shell.brand_theme.promo_panel_text`
- `mobile_shell.brand_theme.primary_text`
- `mobile_shell.brand_theme.button_background`
- `mobile_shell.brand_theme.button_text`
- `mobile_shell.brand_theme.drawer_background`
- `mobile_shell.brand_theme.drawer_text`
- `mobile_shell.brand_theme.hero_background`
- `mobile_shell.brand_theme.hero_overlay`
- `mobile_shell.brand_theme.body_text`
- `mobile_shell.brand_theme.panel_background`

Font tokens:

- `mobile_shell.fonts[]`
- `mobile_shell.body_font`
- `mobile_shell.heading_font`
- `mobile_shell.title_font`

Promo tokens:

- `mobile_shell.promo.present`
- `mobile_shell.promo.source`
- `mobile_shell.promo.title`
- `mobile_shell.promo.body`
- `mobile_shell.promo.disclaimer`
- `mobile_shell.promo.primary_cta_label`
- `mobile_shell.promo.primary_cta_url`
- `mobile_shell.promo.secondary_cta_label`
- `mobile_shell.promo.secondary_cta_url`

Hero tokens:

- `mobile_shell.hero.image_mobile`
- `mobile_shell.hero.source_image`
- `mobile_shell.hero.title_text`
- `mobile_shell.hero.title_mode`
- `mobile_shell.hero.title_svg`
- `mobile_shell.hero.headline`
- `mobile_shell.hero.headline_lines`
- `mobile_shell.hero.primary_cta_label`
- `mobile_shell.hero.primary_cta_url`

Review tokens:

- `mobile_shell.reviews.present`
- `mobile_shell.reviews.source`
- `mobile_shell.reviews.rating`
- `mobile_shell.reviews.count`
- `mobile_shell.reviews.url`
- `mobile_shell.reviews.last_verified`
- `mobile_shell.reviews.fractional_stars_required`
- `mobile_shell.reviews.link_required`

Navigation tokens:

- `mobile_shell.navigation.tour_url`
- `mobile_shell.navigation.apply_url`
- `mobile_shell.navigation.links[]`
- `mobile_shell.navigation.links[].label`
- `mobile_shell.navigation.links[].url`

Content tokens:

- `mobile_shell.content_blocks[]`
- `mobile_shell.content_blocks[].sequence`
- `mobile_shell.content_blocks[].kind`
- `mobile_shell.content_blocks[].eyebrow`
- `mobile_shell.content_blocks[].heading`
- `mobile_shell.content_blocks[].subheading`
- `mobile_shell.content_blocks[].body`
- `mobile_shell.content_blocks[].bullets[]`
- `mobile_shell.content_blocks[].cta_label`
- `mobile_shell.content_blocks[].cta_url`
- `mobile_shell.content_blocks[].image_url`
- `mobile_shell.content_blocks[].source_image_url`
- `mobile_shell.content_blocks[].image_alt`

Phone/source tokens:

- `phone_attribution.default_source`
- `phone_attribution.default_display_phone`
- `phone_attribution.lookup_trigger`
- `phone_attribution.source_lookup[]`
- `phone_attribution.source_lookup[].code`
- `phone_attribution.source_lookup[].source`
- `phone_attribution.source_lookup[].phone`

Analytics tokens:

- `analytics.owner`
- `analytics.ga4.owner`
- `analytics.ga4.measurement_id`
- `analytics.ga4.expected_stream_name`
- `analytics.heap.owner`
- `analytics.heap.app_id`
- `analytics.heap.mode`
- `analytics.heap.passive_timer_allowed`
- `analytics.heap.contentsquare_verify_guard.*`
- `analytics.ahrefs.owner`
- `analytics.ahrefs.existing_project_id`

SEO/evidence tokens:

- `seo.llms_url`
- `seo.sitemap_url`
- `seo.schema_url_policy`
- `seo.meta_title`
- `seo.meta_description`
- `seo.og_image`
- `captain.id`
- `captain.evidence_path`
- `evidence.required_live_proofs[]`
- `rollback.strategy`

## Morning Execution Sequence

1. Fix the District runner proof bug.
2. Run syntax/static validation:
   - `node --check ops/cloudflare/shared/resi-edge-package/runtime.mjs`
   - `node --check ops/cloudflare/shared/resi-consent-widget/widget.mjs`
   - `node --check scripts/validate_resi_edge_package_static.mjs`
   - `python3 -m py_compile scripts/run_resi_edge_upgrade.py`
3. Re-stage District and confirm:
   - Full drawer nav renders from manifest.
   - No drawer link limiter exists.
   - Every nav/control link has differentiated Heap/Zaraz attributes.
   - Heap environment variables are present.
   - Compact consent geometry passes.
   - Byte forecast remains under 40,000.
4. Apply District only after clean stage and required live proof.
5. Capture District readout and confirm no rollback.
6. Promote the common-template proof to a seven-domain preflight.
7. Stage all seven manifests against the common shell.
8. Compare rendered token inventory for each property:
   - Domain
   - Property name
   - Full nav labels/URLs
   - Tour URL
   - Apply URL
   - Phone/source lookup
   - Promo copy/CTA
   - Hero image/title/headline
   - Reviews
   - GA4/Heap IDs
   - Consent version
9. Apply only domains that pass stage, one at a time.
10. Update runbooks/registers after successful proof.

## New Guardrails To Add

- Static guard forbidding `DEFAULT_DRAWER_LINK_LIMIT`, drawer priority slicing, or `.slice(0, DEFAULT_DRAWER_LINK_LIMIT)`.
- Browser proof that rendered drawer labels exactly match `mobile_shell.navigation.links`.
- Browser proof that rendered drawer count equals manifest drawer count.
- Browser proof that each drawer link has:
  - `data-vtr-track`
  - `data-vtr-action`
  - `data-vtr-surface`
  - `data-vtr-element`
  - `data-vtr-destination`
- Browser proof that Heap environment variables remain present:
  - `window.__vtrHeapEnvironment`
  - `window.HEAP_APP_ID`
  - `window.HEAP_ENVIRONMENT`
  - `window.HEAP_MODE`
  - `window.HEAP_JS_DEBUG`
- Byte forecast must include drawer count and fail if the full manifest nav is not represented.

## Future Architecture

Near term: keep the current per-domain deploy flow, but treat the shared runtime as the only template and manifests as the only property-specific layer.

Next evolution: one portfolio Worker shell that selects the correct validated manifest by hostname. The Worker remains common; manifest updates become versioned token promotions. This should happen only after the seven-domain common-template rollout is stable.

