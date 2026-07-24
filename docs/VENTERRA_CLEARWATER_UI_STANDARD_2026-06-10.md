# Venterra Clearwater UI Standard

Date: 2026-06-10
Owner: MarketingOps / Platform UI
Status: Draft implementation standard

## Purpose

Venterra Clearwater is the platform UI language for premium, glass-informed product surfaces in The Data Pond. It borrows the physical discipline of Apple-style Liquid Glass without copying generic glassmorphism tropes.

The goal is clarity first: translucent command layers, lensed depth, crisp edges, and brand-controlled color fields that keep executive and operator workflows readable.

## Principles

1. Glass is a functional layer, not a decoration.
2. The official Venterra palette is the only source for new visual color.
3. Text remains readable before glass becomes beautiful.
4. Depth comes from bevels, tint, blur, and soft separation, not heavy shadows.
5. Motion and transparency must degrade gracefully for accessibility.

## Palette

Use only the active Venterra brand palette defined in `docs/VENTERRA_BRAND_COLOR_STANDARD_2026-05-23.md`.

Clearwater default field colors:

- Deep field: Venterra Navy `#15284B`
- Secondary field: Bay `#294782`
- Active field: San Marino `#3D66B9`
- Lift field: Indigo `#5A81CF`
- Fresh field: Monte Carlo `#7DCAC2`
- Signal field: Blue Chill `#3B9189`
- Alert field: Terra Cotta `#BD4830`
- Emphasis field: Pink `#E02472`
- Neutral canvas: White Smoke `#F6F6F5`

Do not introduce generic purple, cyan, emerald, amber, or slate-led palettes for new Clearwater work. Discontinued Galliano `#EAAB00` remains banned.

## Glass Tokens

Light glass:

```css
background: rgba(255, 255, 255, 0.08);
backdrop-filter: blur(20px) saturate(145%) contrast(112%);
-webkit-backdrop-filter: blur(20px) saturate(145%) contrast(112%);
border: 1px solid rgba(255, 255, 255, 0.16);
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, 0.24),
  0 12px 40px rgba(0, 0, 0, 0.08);
```

Tinted glass:

```css
background: rgba(21, 40, 75, 0.42);
border: 1px solid rgba(255, 255, 255, 0.14);
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, 0.18),
  0 16px 48px rgba(21, 40, 75, 0.16);
```

Clear glass:

```css
background: rgba(255, 255, 255, 0.05);
```

## Usage Rules

Use Clearwater glass for:

- navigation and sidebars
- command bars and filter bars
- modals, popovers, and focused overlays
- hero stat clusters and proof panels
- selected cards that sit over a meaningful environment

Do not use Clearwater glass for:

- dense tables
- long-form body copy containers
- every repeated card in a dashboard
- components over plain white or flat gray backgrounds where blur has nothing to refract

## Accessibility

Normal text must retain WCAG AA contrast of at least 4.5:1. Large text must retain at least 3:1.

Clearwater surfaces must support:

- `prefers-reduced-motion: reduce`
- `prefers-reduced-transparency: reduce`
- fallback rendering when `backdrop-filter` is unavailable

When readability is in doubt, raise tint opacity before reducing font quality or adding dark heavy shadows.

## Implementation Path

1. Use global Clearwater CSS tokens and utilities in `apps/web/src/app/globals.css`.
2. Use shared primitives from `apps/web/src/components/shared/clearwater-glass.tsx`.
3. Apply the system route by route, starting with `/pond`.
4. Keep canonical PIB generation/rendering untouched unless explicitly approved.
5. Verify desktop and mobile screenshots, contrast, reduced motion/transparency, and guardrails before broad adoption.
