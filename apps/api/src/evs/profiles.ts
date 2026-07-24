import type { EvsProfileDefinition } from "../../../../packages/shared/src/evs-types";
import type { EvsValidationProfile } from "../../../../packages/shared/src/evs-schemas";

export const EVS_PROFILE_REGISTRY: Record<EvsValidationProfile, EvsProfileDefinition> = {
  broad_experiential_homepage: {
    id: "broad_experiential_homepage",
    name: "Broad Experiential Homepage",
    description: "Discovers and exercises major homepage interactions on staging URLs.",
    goals: [
      "Page loads without fatal runtime failures",
      "Core interactive surfaces respond to user input",
      "Primary conversion surfaces are reachable",
      "Media and motion affordances do not dead-end",
    ],
    supported_device_profiles: ["iphone_safari", "desktop_chrome"],
    provider: "browserstack",
  },
  critical_cta_smoke: {
    id: "critical_cta_smoke",
    name: "Critical CTA Smoke",
    description: "Checks that top-level CTA surfaces are visible, clickable, and lead to a reachable destination.",
    goals: [
      "Primary CTA visible",
      "CTA clickable",
      "Destination reachable",
      "No fatal JavaScript blocks conversion intent",
    ],
    supported_device_profiles: ["iphone_safari", "desktop_chrome"],
    provider: "browserstack",
  },
  header_navigation_integrity: {
    id: "header_navigation_integrity",
    name: "Header Navigation Integrity",
    description: "Checks header navigation presence, clickability, and destination resolution.",
    goals: [
      "Primary navigation renders",
      "Navigation links are clickable",
      "Destinations resolve correctly",
    ],
    supported_device_profiles: ["iphone_safari", "desktop_chrome"],
    provider: "browserstack",
  },
  portfolio_functionality_regression: {
    id: "portfolio_functionality_regression",
    name: "Portfolio Functionality Regression",
    description: "Runs EVS-owned functionality checks from the governed portfolio QA contract.",
    goals: [
      "Execute workbook-backed Functionality checks with row-level lineage",
      "Validate routing, CTAs, toggles, carousels, filters, and no-submit handoffs",
      "Separate site regressions from source-truth or owner-lane blockers",
    ],
    supported_device_profiles: ["iphone_safari", "desktop_chrome"],
    provider: "browserstack",
  },
  apartments_pricing_deep_journey: {
    id: "apartments_pricing_deep_journey",
    name: "Apartments & Pricing Deep Journey",
    description: "Validates unit availability, sorting, unit-detail continuity, map behavior, and pricing/app/tour handoffs.",
    goals: [
      "Compare rendered availability with Pond availability",
      "Validate unit list, grid, map, and unit-detail continuity",
      "Confirm unit-specific no-submit quote, application, and tour handoffs",
    ],
    supported_device_profiles: ["iphone_safari", "desktop_chrome"],
    provider: "browserstack",
  },
  apartments_pricing_mobile_journey: {
    id: "apartments_pricing_mobile_journey",
    name: "Apartments & Pricing Mobile Journey",
    description: "Runs the governed Apartments & Pricing functionality contract through bounded iPhone-first checks.",
    goals: [
      "Validate mobile filter controls without destructive form submission",
      "Compare rendered mobile availability with Pond availability",
      "Confirm mobile unit-detail continuity and unit-specific quote, application, and tour handoffs",
      "Checkpoint each contract row so partial iOS evidence survives slow or fragile pages",
    ],
    supported_device_profiles: ["iphone_safari"],
    provider: "browserstack",
  },
  contact_form_checks: {
    id: "contact_form_checks",
    name: "Contact Form Checks",
    description: "Runs guarded contact-form validation and optional governed synthetic submission checks.",
    goals: [
      "Validate required-field behavior without submitting a lead",
      "Capture row-level evidence for contact form audit items",
      "Submit synthetic leads only when explicit governance toggles are present",
    ],
    supported_device_profiles: ["iphone_safari", "desktop_chrome"],
    provider: "browserstack",
  },
  lead_attribution_e2e: {
    id: "lead_attribution_e2e",
    name: "Lead Attribution E2E",
    description: "Reserved profile for governed synthetic-lead and AH/EAI guest-card proof.",
    goals: [
      "Use synthetic lead identity and submission policy",
      "Verify guest-card appearance in downstream AH/EAI systems",
      "Avoid unattended form submissions until governance is configured",
    ],
    supported_device_profiles: ["iphone_safari", "desktop_chrome"],
    provider: "browserstack",
  },
  employee_photo_integrity: {
    id: "employee_photo_integrity",
    name: "Employee Photo Integrity",
    description: "Checks the legacy team section for visible employee headshots and likely silhouette placeholders.",
    goals: [
      "Find the rendered legacy team/experience-leader section",
      "Inspect visible staff image URLs and rendered image characteristics",
      "Flag default silhouettes, unresolved lazy placeholders, or missing staff images",
    ],
    supported_device_profiles: ["desktop_chrome"],
    provider: "browserstack",
  },
};

export function getProfileDefinition(profileId: EvsValidationProfile): EvsProfileDefinition {
  return EVS_PROFILE_REGISTRY[profileId];
}
