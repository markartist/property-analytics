import test from "node:test";
import assert from "node:assert/strict";

import { matchResiSourceToSection } from "../../src/platform/site-content/resi-section-mapping";

const amenitiesSection = {
  label: "Community Amenities",
  heading: "Community Amenities",
  eyebrow: null,
  title: "Community Amenities",
  subtitle: null,
  copy: "Explore the pool, fitness center, and courtyard lounges designed for daily connection.",
  bullets: ["Pool", "Fitness Center", "Courtyard Lounges"],
};

test("matches a property-scoped amenity source to an amenities section", () => {
  const result = matchResiSourceToSection({
    page_type: "amenities",
    specs_section_key: "community-amenities",
    section: amenitiesSection,
    sources: [{
      object_type: "amenity",
      object_id: "amenity_pool",
      public_title: "Community Amenities",
      public_subtitle: null,
      text_summary: "Pool, fitness center, and courtyard lounges for residents.",
      is_global: false,
      affected_property_count: 1,
      safe_fields: [{ field_path: "name", field_role: "amenity_content", safety_notes: null }],
    }],
  });

  assert.equal(result.status, "property_matched");
  assert.equal(result.scope, "property");
  assert.equal(result.source_object_id, "amenity_pool");
});

test("locks a matching global Resi source even when it resembles the section", () => {
  const result = matchResiSourceToSection({
    page_type: "amenities",
    specs_section_key: "community-amenities",
    section: amenitiesSection,
    sources: [{
      object_type: "content_block",
      object_id: "corporate_amenities",
      public_title: "Community Amenities",
      public_subtitle: null,
      text_summary: "Pool, fitness center, and courtyard lounges designed for daily connection.",
      is_global: true,
      affected_property_count: 18,
      safe_fields: [{ field_path: "description", field_role: "public_copy", safety_notes: null }],
    }],
  });

  assert.equal(result.status, "global_locked");
  assert.equal(result.scope, "global");
  assert.equal(result.affected_property_count, 18);
});

test("does not fabricate a Resi backing relationship from unrelated content", () => {
  const result = matchResiSourceToSection({
    page_type: "amenities",
    specs_section_key: "community-amenities",
    section: amenitiesSection,
    sources: [{
      object_type: "neighborhood_place",
      object_id: "museum_district",
      public_title: "Museum District",
      public_subtitle: null,
      text_summary: "Walk to nearby galleries and restaurants in Houston.",
      is_global: false,
      affected_property_count: 1,
      safe_fields: [{ field_path: "name", field_role: "location_content", safety_notes: null }],
    }],
  });

  assert.equal(result.status, "not_resi_backed");
});
