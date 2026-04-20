import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryAll, queryFirst, run } from "../lib/db";
import { newId } from "../lib/id";
import { nowISO, errJson } from "../lib/validate";
import { writeAuditLog } from "../lib/audit";
import { requireOfferingAction } from "../lib/permissions";
import {
  getSpecsPageBinding,
  getSpecsSectionTemplates,
  type SpecsSectionTemplate,
} from "../platform/shared/specs-property-marketing-v1";
import { getBriefCompletenessMap } from "../platform/intelligence/brief-completeness";

const adminSiteContent = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
adminSiteContent.use("*", requireAuth);

const CrawlBody = z.object({
  page_limit: z.number().int().min(1).max(25).optional(),
});

const SaveRewriteBody = z.object({
  page_id: z.string().min(1),
  mapping_id: z.string().min(1),
  section_id: z.string().min(1).nullable().optional(),
  draft_status: z.enum(["not_started", "drafted", "in_review", "approved"]),
  rewrite_brief: z.string().max(4000).optional().default(""),
  proposed_copy: z.string().max(12000).optional().default(""),
  refinement_notes: z.string().max(8000).optional().default(""),
});

type PropertyBriefRow = {
  property_id: string;
  property_name: string;
  revised_url: string | null;
  live_url: string | null;
  staging_url: string | null;
  editorial_focus: string;
  approved_points: string;
  open_questions: string;
  advocate_prompt: string;
};

type PageRow = {
  id: string;
  property_id: string;
  page_url: string;
  page_path: string | null;
  page_type: string | null;
  page_title: string | null;
  meta_description: string | null;
  crawl_status: string;
  crawled_at: string | null;
  updated_at: string;
};

type PageWithSections = PageRow & {
  spec_archetype_id: string | null;
  spec_archetype_name: string | null;
  spec_page_id: string | null;
  spec_page_name: string | null;
  spec_layout_path: string | null;
  spec_screenshot: string | null;
  spec_order: number | null;
  section_mappings: SectionMappingRow[];
  section_mapping_summary: SectionMappingSummary;
  section_assessments: SectionAssessmentRow[];
  section_assessment_summary: SectionAssessmentSummary;
  section_rewrites: SectionRewriteRow[];
  section_rewrite_summary: SectionRewriteSummary;
  sections: Array<
    SectionRow & {
      bullet_points: string[];
    }
  >;
};

type SectionRow = {
  id: string;
  page_id: string;
  section_key: string | null;
  section_order: number;
  section_label: string | null;
  heading: string | null;
  eyebrow: string | null;
  title: string | null;
  subtitle: string | null;
  section_type: string | null;
  media_side: string | null;
  original_copy: string | null;
  bullet_points_json: string | null;
  image_count: number;
  link_count: number;
  updated_at: string;
};

type ExtractedSection = {
  section_key: string;
  section_order: number;
  section_label: string;
  heading: string | null;
  eyebrow: string | null;
  title: string | null;
  subtitle: string | null;
  section_type: string;
  media_side: "left" | "right" | "none";
  original_copy: string;
  bullet_points: string[];
  image_count: number;
  link_count: number;
};

type SectionMappingStatus = "matched" | "partial" | "extra-on-live" | "missing-from-live";

type SectionMappingRow = {
  id: string;
  page_id: string;
  section_id: string | null;
  expected_section_key: string | null;
  expected_section_label: string | null;
  expected_section_role: string | null;
  expected_order: number | null;
  match_status: SectionMappingStatus;
  match_confidence: number;
  rationale: string;
  created_at: string;
  updated_at: string;
};

type SectionMappingSummary = {
  matched: number;
  partial: number;
  extra_on_live: number;
  missing_from_live: number;
};

type SectionAssessmentStatus = "healthy" | "watch" | "needs-attention";

type SectionAssessmentRow = {
  id: string;
  page_id: string;
  mapping_id: string;
  section_id: string | null;
  overall_status: SectionAssessmentStatus;
  structural_score: number;
  messaging_score: number;
  specificity_score: number;
  search_value_score: number;
  cta_score: number;
  harmonization_score: number;
  flags_json: string;
  summary: string;
  created_at: string;
  updated_at: string;
};

type SectionAssessmentSummary = {
  healthy: number;
  watch: number;
  needs_attention: number;
};

type SectionRewriteStatus = "not_started" | "drafted" | "in_review" | "approved";

type SectionRewriteRow = {
  id: string;
  page_id: string;
  mapping_id: string;
  section_id: string | null;
  draft_status: SectionRewriteStatus;
  rewrite_brief: string;
  proposed_copy: string;
  refinement_notes: string;
  governed_inputs_json: string;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
};

type SectionRewriteSummary = {
  not_started: number;
  drafted: number;
  in_review: number;
  approved: number;
};

adminSiteContent.get("/", requireOfferingAction("siteContent", "view"), async (c) => {
  await ensureSiteContentTables(c.env.POP_BRIEF_DB);

  const properties = await queryAll<PropertyBriefRow & {
    page_count: number;
    section_count: number;
    last_crawled_at: string | null;
  }>(c.env.POP_BRIEF_DB, `
    SELECT
      p.property_id,
      p.property_name,
      p.revised_url,
      p.live_url,
      p.staging_url,
      p.editorial_focus,
      p.approved_points,
      p.open_questions,
      p.advocate_prompt,
      COUNT(DISTINCT scp.id) AS page_count,
      COUNT(DISTINCT scs.id) AS section_count,
      MAX(scp.crawled_at) AS last_crawled_at
    FROM intelligence_pilot_properties p
    LEFT JOIN site_content_pages scp ON scp.property_id = p.property_id
    LEFT JOIN site_content_sections scs ON scs.page_id = scp.id
    GROUP BY
      p.property_id, p.property_name, p.revised_url, p.live_url, p.staging_url,
      p.editorial_focus, p.approved_points, p.open_questions, p.advocate_prompt
    ORDER BY p.property_name ASC
  `);

  const briefReadiness = await getBriefCompletenessMap(
    c.env.POP_BRIEF_DB,
    properties.map((property) => ({
      property_id: property.property_id,
      approved_points: property.approved_points,
    }))
  );

  const propertiesWithReadiness = properties.map((property) => ({
    ...property,
    brief_readiness: briefReadiness[property.property_id] ?? null,
  }));

  return c.json({ properties: propertiesWithReadiness });
});

adminSiteContent.get("/:propertyId", requireOfferingAction("siteContent", "view"), async (c) => {
  await ensureSiteContentTables(c.env.POP_BRIEF_DB);
  const propertyId = normalizePropertyKey(c.req.param("propertyId"));

  const property = await resolvePropertyByKey(c.env.POP_BRIEF_DB, propertyId);
  if (!property) return c.json(errJson("NOT_FOUND", `Property not found (${propertyId})`), 404);
  const canonicalPropertyId = property.property_id;

  const pages = await queryAll<PageRow>(
    c.env.POP_BRIEF_DB,
    `SELECT id, property_id, page_url, page_path, page_type, page_title, meta_description, crawl_status, crawled_at, updated_at
     FROM site_content_pages
     WHERE property_id = ?
     ORDER BY
       CASE page_type
         WHEN 'homepage' THEN 0
         WHEN 'amenities' THEN 1
         WHEN 'floor-plans' THEN 2
         WHEN 'neighborhood' THEN 3
         ELSE 9
       END,
       page_path ASC`,
    [canonicalPropertyId]
  );

  const sections = pages.length
    ? await queryAll<SectionRow>(
        c.env.POP_BRIEF_DB,
        `SELECT id, page_id, section_key, section_order, section_label, heading, eyebrow, title, subtitle, section_type, media_side, original_copy, bullet_points_json, image_count, link_count, updated_at
         FROM site_content_sections
         WHERE page_id IN (${pages.map(() => "?").join(",")})
         ORDER BY page_id ASC, section_order ASC`,
        pages.map((page) => page.id)
      )
    : [];

  await syncSectionMappings(c.env.POP_BRIEF_DB, pages, sections);

  const sectionMappings = pages.length
    ? await queryAll<SectionMappingRow>(
        c.env.POP_BRIEF_DB,
        `SELECT id, page_id, section_id, expected_section_key, expected_section_label, expected_section_role, expected_order, match_status, match_confidence, rationale, created_at, updated_at
         FROM site_content_section_mappings
         WHERE page_id IN (${pages.map(() => "?").join(",")})
         ORDER BY page_id ASC, expected_order ASC, updated_at ASC`,
        pages.map((page) => page.id)
      )
    : [];

  await syncSectionAssessments(c.env.POP_BRIEF_DB, property, pages, sections, sectionMappings);

  const sectionAssessments = pages.length
    ? await queryAll<SectionAssessmentRow>(
        c.env.POP_BRIEF_DB,
        `SELECT id, page_id, mapping_id, section_id, overall_status, structural_score, messaging_score, specificity_score, search_value_score, cta_score, harmonization_score, flags_json, summary, created_at, updated_at
         FROM site_content_section_assessments
         WHERE page_id IN (${pages.map(() => "?").join(",")})
         ORDER BY page_id ASC, updated_at ASC`,
        pages.map((page) => page.id)
      )
    : [];

  await syncSectionRewrites(c.env.POP_BRIEF_DB, property, pages, sections, sectionMappings, sectionAssessments);

  const sectionRewrites = pages.length
    ? await queryAll<SectionRewriteRow>(
        c.env.POP_BRIEF_DB,
        `SELECT id, page_id, mapping_id, section_id, draft_status, rewrite_brief, proposed_copy, refinement_notes, governed_inputs_json, approved_at, approved_by, created_at, updated_at
         FROM site_content_section_rewrites
         WHERE page_id IN (${pages.map(() => "?").join(",")})
         ORDER BY page_id ASC, updated_at ASC`,
        pages.map((page) => page.id)
      )
    : [];

  const pagesWithSections = pages.map((page) => ({
    ...page,
    ...toSpecsBinding(page.page_type),
    section_mappings: sectionMappings.filter((mapping) => mapping.page_id === page.id),
    section_mapping_summary: summarizeSectionMappings(sectionMappings.filter((mapping) => mapping.page_id === page.id)),
    section_assessments: sectionAssessments.filter((assessment) => assessment.page_id === page.id),
    section_assessment_summary: summarizeSectionAssessments(
      sectionAssessments.filter((assessment) => assessment.page_id === page.id)
    ),
    section_rewrites: sectionRewrites.filter((rewrite) => rewrite.page_id === page.id),
    section_rewrite_summary: summarizeSectionRewrites(sectionRewrites.filter((rewrite) => rewrite.page_id === page.id)),
    sections: sections
      .filter((section) => section.page_id === page.id)
      .map((section) => ({
        ...section,
        bullet_points: safeParseJsonArray(section.bullet_points_json),
      })),
  })) satisfies PageWithSections[];

  return c.json({ property, pages: pagesWithSections });
});

adminSiteContent.patch("/:propertyId/rewrite", requireOfferingAction("siteContent", "draft"), async (c) => {
  await ensureSiteContentTables(c.env.POP_BRIEF_DB);
  const propertyId = normalizePropertyKey(c.req.param("propertyId"));
  const parse = SaveRewriteBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parse.success) {
    return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid rewrite payload"), 400);
  }

  const property = await resolvePropertyByKey(c.env.POP_BRIEF_DB, propertyId);
  if (!property) return c.json(errJson("NOT_FOUND", `Property not found (${propertyId})`), 404);
  const canonicalPropertyId = property.property_id;

  const page = await queryFirst<PageRow>(
    c.env.POP_BRIEF_DB,
    `SELECT id, property_id, page_url, page_path, page_type, page_title, meta_description, crawl_status, crawled_at, updated_at
     FROM site_content_pages
     WHERE id = ? AND property_id = ?`,
    [parse.data.page_id, canonicalPropertyId]
  );
  if (!page) return c.json(errJson("NOT_FOUND", "Site content page not found for property"), 404);

  const mapping = await queryFirst<SectionMappingRow>(
    c.env.POP_BRIEF_DB,
    `SELECT id, page_id, section_id, expected_section_key, expected_section_label, expected_section_role, expected_order, match_status, match_confidence, rationale, created_at, updated_at
     FROM site_content_section_mappings
     WHERE id = ? AND page_id = ?`,
    [parse.data.mapping_id, parse.data.page_id]
  );
  if (!mapping) return c.json(errJson("NOT_FOUND", "Section mapping not found for page"), 404);

  const assessment = await queryFirst<SectionAssessmentRow>(
    c.env.POP_BRIEF_DB,
    `SELECT id, page_id, mapping_id, section_id, overall_status, structural_score, messaging_score, specificity_score, search_value_score, cta_score, harmonization_score, flags_json, summary, created_at, updated_at
     FROM site_content_section_assessments
     WHERE page_id = ? AND mapping_id = ?`,
    [parse.data.page_id, parse.data.mapping_id]
  );

  const section = mapping.section_id
    ? await queryFirst<SectionRow>(
        c.env.POP_BRIEF_DB,
        `SELECT id, page_id, section_key, section_order, section_label, heading, eyebrow, title, subtitle, section_type, media_side, original_copy, bullet_points_json, image_count, link_count, updated_at
         FROM site_content_sections
         WHERE id = ? AND page_id = ?`,
        [mapping.section_id, parse.data.page_id]
      )
    : null;

  const now = nowISO();
  const actor = c.get("user");
  const approvedAt = parse.data.draft_status === "approved" ? now : null;
  const approvedBy = parse.data.draft_status === "approved" ? actor.id : null;
  const governedInputs = JSON.stringify(buildGovernedInputsSnapshot(property, page, mapping, assessment, section));

  const existingRewrite = await queryFirst<{ id: string }>(
    c.env.POP_BRIEF_DB,
    `SELECT id FROM site_content_section_rewrites WHERE mapping_id = ?`,
    [parse.data.mapping_id]
  );

  if (existingRewrite) {
    await run(
      c.env.POP_BRIEF_DB,
      `UPDATE site_content_section_rewrites
       SET page_id = ?, section_id = ?, draft_status = ?, rewrite_brief = ?, proposed_copy = ?, refinement_notes = ?, governed_inputs_json = ?, approved_at = ?, approved_by = ?, updated_at = ?
       WHERE id = ?`,
      [
        parse.data.page_id,
        parse.data.section_id ?? mapping.section_id ?? null,
        parse.data.draft_status,
        parse.data.rewrite_brief.trim(),
        parse.data.proposed_copy.trim(),
        parse.data.refinement_notes.trim(),
        governedInputs,
        approvedAt,
        approvedBy,
        now,
        existingRewrite.id,
      ]
    );
  } else {
    await run(
      c.env.POP_BRIEF_DB,
      `INSERT INTO site_content_section_rewrites
       (id, page_id, mapping_id, section_id, draft_status, rewrite_brief, proposed_copy, refinement_notes, governed_inputs_json, approved_at, approved_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        parse.data.page_id,
        parse.data.mapping_id,
        parse.data.section_id ?? mapping.section_id ?? null,
        parse.data.draft_status,
        parse.data.rewrite_brief.trim(),
        parse.data.proposed_copy.trim(),
        parse.data.refinement_notes.trim(),
        governedInputs,
        approvedAt,
        approvedBy,
        now,
        now,
      ]
    );
  }

  const rewrite = await queryFirst<SectionRewriteRow>(
    c.env.POP_BRIEF_DB,
    `SELECT id, page_id, mapping_id, section_id, draft_status, rewrite_brief, proposed_copy, refinement_notes, governed_inputs_json, approved_at, approved_by, created_at, updated_at
     FROM site_content_section_rewrites
     WHERE mapping_id = ?`,
    [parse.data.mapping_id]
  );

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "site_content.rewrite.save",
    entityType: "site_content_section_rewrite",
    entityId: rewrite?.id ?? parse.data.mapping_id,
    after: {
      property_id: canonicalPropertyId,
      page_id: parse.data.page_id,
      mapping_id: parse.data.mapping_id,
      draft_status: parse.data.draft_status,
    },
  });

  return c.json({ rewrite });
});

adminSiteContent.post("/:propertyId/crawl", requireOfferingAction("siteContent", "administer"), async (c) => {
  await ensureSiteContentTables(c.env.POP_BRIEF_DB);
  const propertyId = normalizePropertyKey(c.req.param("propertyId"));
  const parse = CrawlBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid crawl request"), 400);

  const property = await resolvePropertyByKey(c.env.POP_BRIEF_DB, propertyId);
  if (!property) return c.json(errJson("NOT_FOUND", `Property not found (${propertyId})`), 404);
  const canonicalPropertyId = property.property_id;

  const baseUrl = property.revised_url || property.live_url || property.staging_url;
  if (!baseUrl) return c.json(errJson("VALIDATION_ERROR", "Property has no crawlable URL"), 400);

  const actor = c.get("user");
  const pageLimit = parse.data.page_limit ?? 8;
  const targetPages = await discoverTargetPages(baseUrl, pageLimit);
  const now = nowISO();

  await run(
    c.env.POP_BRIEF_DB,
    `DELETE FROM site_content_sections
     WHERE page_id IN (SELECT id FROM site_content_pages WHERE property_id = ?)`,
    [canonicalPropertyId]
  );
  await run(c.env.POP_BRIEF_DB, `DELETE FROM site_content_pages WHERE property_id = ?`, [canonicalPropertyId]);

  const crawledPages: Array<Record<string, unknown>> = [];

  for (const pageUrl of targetPages) {
    const pageResult = await crawlPage(pageUrl);
    const pageType = inferPageType(pageUrl, baseUrl);
    const pagePath = normalizePagePath(pageUrl, baseUrl);

    const pageId = newId();
    await run(
      c.env.POP_BRIEF_DB,
      `INSERT INTO site_content_pages
       (id, property_id, page_url, page_path, page_type, page_title, meta_description, crawl_status, crawled_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pageId,
        canonicalPropertyId,
        pageUrl,
        pagePath,
        pageType,
        pageResult.page_title,
        pageResult.meta_description,
        pageResult.crawl_status,
        now,
        now,
      ]
    );

    for (const section of pageResult.sections) {
      await run(
        c.env.POP_BRIEF_DB,
        `INSERT INTO site_content_sections
         (id, page_id, section_key, section_order, section_label, heading, eyebrow, title, subtitle, section_type, media_side, original_copy, bullet_points_json, image_count, link_count, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          pageId,
          section.section_key,
          section.section_order,
          section.section_label,
          section.heading,
          section.eyebrow,
          section.title,
          section.subtitle,
          section.section_type,
          section.media_side,
          section.original_copy,
          JSON.stringify(section.bullet_points),
          section.image_count,
          section.link_count,
          now,
        ]
      );
    }

    const savedPage = await queryFirst<PageRow>(
      c.env.POP_BRIEF_DB,
      `SELECT id, property_id, page_url, page_path, page_type, page_title, meta_description, crawl_status, crawled_at, updated_at
       FROM site_content_pages WHERE id = ?`,
      [pageId]
    );

    crawledPages.push({
      ...savedPage,
      ...toSpecsBinding(pageType),
      sections: pageResult.sections,
    });
  }

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "site_content.crawl",
    entityType: "site_content_property",
    entityId: canonicalPropertyId,
    after: {
      property_id: canonicalPropertyId,
      page_count: crawledPages.length,
      crawled_urls: targetPages,
    },
  });

  return c.json({
    property,
    crawled_count: crawledPages.length,
    pages: crawledPages,
  });
});

async function ensureSiteContentTables(db: D1Database) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS site_content_pages (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      page_url TEXT NOT NULL,
      page_path TEXT,
      page_type TEXT,
      page_title TEXT,
      meta_description TEXT,
      crawl_status TEXT NOT NULL DEFAULT 'ready',
      crawled_at TEXT,
      updated_at TEXT NOT NULL
    )`
  );

  await run(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_site_content_pages_property_url ON site_content_pages(property_id, page_url)`);

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS site_content_sections (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      section_key TEXT,
      section_order INTEGER NOT NULL,
      section_label TEXT,
      heading TEXT,
      eyebrow TEXT,
      title TEXT,
      subtitle TEXT,
      section_type TEXT,
      media_side TEXT,
      original_copy TEXT,
      bullet_points_json TEXT,
      image_count INTEGER NOT NULL DEFAULT 0,
      link_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )`
  );

  await run(db, `CREATE INDEX IF NOT EXISTS idx_site_content_sections_page_order ON site_content_sections(page_id, section_order)`);
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS site_content_section_mappings (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      section_id TEXT,
      expected_section_key TEXT,
      expected_section_label TEXT,
      expected_section_role TEXT,
      expected_order INTEGER,
      match_status TEXT NOT NULL,
      match_confidence REAL NOT NULL DEFAULT 0,
      rationale TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );
  await run(db, `CREATE INDEX IF NOT EXISTS idx_site_content_section_mappings_page ON site_content_section_mappings(page_id, expected_order, updated_at)`);
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS site_content_section_assessments (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      mapping_id TEXT NOT NULL,
      section_id TEXT,
      overall_status TEXT NOT NULL,
      structural_score INTEGER NOT NULL DEFAULT 0,
      messaging_score INTEGER NOT NULL DEFAULT 0,
      specificity_score INTEGER NOT NULL DEFAULT 0,
      search_value_score INTEGER NOT NULL DEFAULT 0,
      cta_score INTEGER NOT NULL DEFAULT 0,
      harmonization_score INTEGER NOT NULL DEFAULT 0,
      flags_json TEXT NOT NULL DEFAULT '[]',
      summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );
  await run(db, `CREATE INDEX IF NOT EXISTS idx_site_content_section_assessments_page ON site_content_section_assessments(page_id, mapping_id, updated_at)`);
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS site_content_section_rewrites (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      mapping_id TEXT NOT NULL,
      section_id TEXT,
      draft_status TEXT NOT NULL DEFAULT 'not_started',
      rewrite_brief TEXT NOT NULL DEFAULT '',
      proposed_copy TEXT NOT NULL DEFAULT '',
      refinement_notes TEXT NOT NULL DEFAULT '',
      governed_inputs_json TEXT NOT NULL DEFAULT '{}',
      approved_at TEXT,
      approved_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );
  await run(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_site_content_section_rewrites_mapping ON site_content_section_rewrites(mapping_id)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_site_content_section_rewrites_page ON site_content_section_rewrites(page_id, draft_status, updated_at)`);
  await ensureOptionalColumn(db, "site_content_sections", "eyebrow", "TEXT");
  await ensureOptionalColumn(db, "site_content_sections", "title", "TEXT");
  await ensureOptionalColumn(db, "site_content_sections", "subtitle", "TEXT");
  await ensureOptionalColumn(db, "site_content_sections", "media_side", "TEXT");
}

async function syncSectionMappings(db: D1Database, pages: PageRow[], sections: SectionRow[]) {
  if (pages.length === 0) return;

  const now = nowISO();
  for (const page of pages) {
    const pageSections = sections.filter((section) => section.page_id === page.id);
    const mappings = buildSectionMappings(page, pageSections);
    const existingMappings = await queryAll<SectionMappingRow>(
      db,
      `SELECT id, page_id, section_id, expected_section_key, expected_section_label, expected_section_role, expected_order, match_status, match_confidence, rationale, created_at, updated_at
       FROM site_content_section_mappings
       WHERE page_id = ?`,
      [page.id]
    );
    const existingIdBySignature = new Map(
      existingMappings.map((mapping) => [
        `${mapping.section_id ?? ""}|${mapping.expected_section_key ?? ""}|${mapping.match_status}`,
        mapping.id,
      ])
    );
    await run(db, `DELETE FROM site_content_section_mappings WHERE page_id = ?`, [page.id]);
    for (const mapping of mappings) {
      const signature = `${mapping.section_id ?? ""}|${mapping.expected_section_key ?? ""}|${mapping.match_status}`;
      await run(
        db,
        `INSERT INTO site_content_section_mappings
         (id, page_id, section_id, expected_section_key, expected_section_label, expected_section_role, expected_order, match_status, match_confidence, rationale, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          existingIdBySignature.get(signature) ?? newId(),
          page.id,
          mapping.section_id,
          mapping.expected_section_key,
          mapping.expected_section_label,
          mapping.expected_section_role,
          mapping.expected_order,
          mapping.match_status,
          mapping.match_confidence,
          mapping.rationale,
          now,
          now,
        ]
      );
    }
  }
}

async function syncSectionAssessments(
  db: D1Database,
  property: PropertyBriefRow,
  pages: PageRow[],
  sections: SectionRow[],
  mappings: SectionMappingRow[]
) {
  if (pages.length === 0) return;

  const now = nowISO();
  for (const page of pages) {
    const pageSections = sections.filter((section) => section.page_id === page.id);
    const pageMappings = mappings.filter((mapping) => mapping.page_id === page.id);
    const assessments = buildSectionAssessments(property, page, pageSections, pageMappings);
    await run(db, `DELETE FROM site_content_section_assessments WHERE page_id = ?`, [page.id]);
    for (const assessment of assessments) {
      await run(
        db,
        `INSERT INTO site_content_section_assessments
         (id, page_id, mapping_id, section_id, overall_status, structural_score, messaging_score, specificity_score, search_value_score, cta_score, harmonization_score, flags_json, summary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          page.id,
          assessment.mapping_id,
          assessment.section_id,
          assessment.overall_status,
          assessment.structural_score,
          assessment.messaging_score,
          assessment.specificity_score,
          assessment.search_value_score,
          assessment.cta_score,
          assessment.harmonization_score,
          JSON.stringify(assessment.flags),
          assessment.summary,
          now,
          now,
        ]
      );
    }
  }
}

function buildSectionMappings(page: PageRow, sections: SectionRow[]) {
  const templates = getSpecsSectionTemplates(page.page_type);
  if (templates.length === 0) {
    return sections.map((section) => ({
      section_id: section.id,
      expected_section_key: null,
      expected_section_label: null,
      expected_section_role: null,
      expected_order: null,
      match_status: "extra-on-live" as SectionMappingStatus,
      match_confidence: 0,
      rationale: "No Specs section expectations are defined yet for this page type.",
    }));
  }

  const scoredPairs = templates
    .flatMap((template) =>
      sections.map((section) => ({
        template,
        section,
        score: scoreSectionTemplateMatch(template, section),
      }))
    )
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const matchedTemplateIds = new Set<string>();
  const matchedSectionIds = new Set<string>();
  const mappings: Array<Omit<SectionMappingRow, "id" | "page_id" | "created_at" | "updated_at">> = [];

  for (const pair of scoredPairs) {
    if (matchedTemplateIds.has(pair.template.id) || matchedSectionIds.has(pair.section.id)) continue;
    if (pair.score < 35) continue;

    matchedTemplateIds.add(pair.template.id);
    matchedSectionIds.add(pair.section.id);

    mappings.push({
      section_id: pair.section.id,
      expected_section_key: pair.template.id,
      expected_section_label: pair.template.label,
      expected_section_role: pair.template.role,
      expected_order: pair.template.order,
      match_status: pair.score >= 70 ? "matched" : "partial",
      match_confidence: pair.score,
      rationale: buildMappingRationale(pair.template, pair.section, pair.score),
    });
  }

  for (const template of templates) {
    if (matchedTemplateIds.has(template.id)) continue;
    mappings.push({
      section_id: null,
      expected_section_key: template.id,
      expected_section_label: template.label,
      expected_section_role: template.role,
      expected_order: template.order,
      match_status: "missing-from-live",
      match_confidence: 0,
      rationale: template.optional
        ? "Optional Specs section not found in the current live capture."
        : "Expected Specs section was not identified in the current live capture.",
    });
  }

  for (const section of sections) {
    if (matchedSectionIds.has(section.id)) continue;
    mappings.push({
      section_id: section.id,
      expected_section_key: null,
      expected_section_label: null,
      expected_section_role: null,
      expected_order: null,
      match_status: "extra-on-live",
      match_confidence: 0,
      rationale: "Live section was captured, but it did not confidently match an expected Specs section.",
    });
  }

  return mappings.sort((a, b) => {
    const orderA = a.expected_order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.expected_order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return (a.section_id ?? "").localeCompare(b.section_id ?? "");
  });
}

function scoreSectionTemplateMatch(template: SpecsSectionTemplate, section: SectionRow): number {
  const source = [
    section.section_label,
    section.heading,
    section.eyebrow,
    section.title,
    section.subtitle,
    section.original_copy,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const keyword of template.keywords) {
    if (source.includes(keyword.toLowerCase())) score += 18;
  }

  if (template.preferredSectionTypes?.includes(section.section_type ?? "")) {
    score += 25;
  }

  const orderDistance = Math.abs(template.order - (section.section_order + 1));
  if (orderDistance === 0) score += 18;
  else if (orderDistance === 1) score += 10;
  else if (orderDistance === 2) score += 4;

  if (template.id === "hero" && section.section_order === 0) score += 20;
  if (template.id.includes("cta") && (section.section_type ?? "") === "cta") score += 20;

  return Math.min(score, 100);
}

function buildMappingRationale(template: SpecsSectionTemplate, section: SectionRow, score: number): string {
  const reasons: string[] = [];
  if (template.preferredSectionTypes?.includes(section.section_type ?? "")) {
    reasons.push(`section type matches ${section.section_type}`);
  }
  if (Math.abs(template.order - (section.section_order + 1)) <= 1) {
    reasons.push(`section order is close to expected slot ${template.order}`);
  }
  const matchedKeywords = template.keywords.filter((keyword) =>
    [section.section_label, section.heading, section.title, section.subtitle, section.original_copy]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(keyword.toLowerCase())
  );
  if (matchedKeywords.length > 0) {
    reasons.push(`matched keywords: ${matchedKeywords.slice(0, 3).join(", ")}`);
  }
  if (reasons.length === 0) {
    reasons.push("low-confidence structural approximation from current extracted copy");
  }
  const prefix = score >= 70 ? "Strong match" : "Partial match";
  return `${prefix}: ${reasons.join("; ")}.`;
}

function summarizeSectionMappings(mappings: SectionMappingRow[]): SectionMappingSummary {
  return mappings.reduce<SectionMappingSummary>(
    (summary, mapping) => {
      if (mapping.match_status === "matched") summary.matched += 1;
      else if (mapping.match_status === "partial") summary.partial += 1;
      else if (mapping.match_status === "extra-on-live") summary.extra_on_live += 1;
      else if (mapping.match_status === "missing-from-live") summary.missing_from_live += 1;
      return summary;
    },
    { matched: 0, partial: 0, extra_on_live: 0, missing_from_live: 0 }
  );
}

function buildSectionAssessments(
  property: PropertyBriefRow,
  page: PageRow,
  sections: SectionRow[],
  mappings: SectionMappingRow[]
) {
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  return mappings.map((mapping) => {
    const section = mapping.section_id ? sectionById.get(mapping.section_id) ?? null : null;
    const flags: string[] = [];

    const structuralScore =
      mapping.match_status === "matched"
        ? Math.max(70, Math.round(mapping.match_confidence))
        : mapping.match_status === "partial"
          ? Math.max(40, Math.round(mapping.match_confidence))
          : mapping.match_status === "missing-from-live"
            ? 0
            : 22;

    const copy = section?.original_copy?.trim() ?? "";
    const copyLength = copy.length;
    let messagingScore = 55;
    if (!section) messagingScore = 0;
    else if (copyLength >= 320) messagingScore = 76;
    else if (copyLength >= 180) messagingScore = 66;
    else if (copyLength >= 100) messagingScore = 54;
    else messagingScore = 36;

    const title = `${section?.title ?? ""} ${section?.heading ?? ""} ${section?.section_label ?? ""}`.trim();
    const propertyTokens = property.property_name.toLowerCase().split(/\s+/).filter((token) => token.length > 3);
    const combined = `${title} ${copy}`.toLowerCase();
    const specificityHits = propertyTokens.filter((token) => combined.includes(token)).length;
    let specificityScore = section ? 34 + specificityHits * 18 : 0;
    if (/\bmidtown\b|\bhouston\b|\blocation\b|\bneighborhood\b|\bwalkable\b|\bcommute\b/.test(combined)) {
      specificityScore += 18;
    }
    specificityScore = Math.min(specificityScore, 100);

    let searchValueScore = section ? 42 : 0;
    if (copyLength >= 180) searchValueScore += 16;
    if (/\bmidtown\b|\bhouston\b|\blocal\b|\brestaurants\b|\bshopping\b|\bparks\b|\btransit\b/.test(combined)) {
      searchValueScore += 24;
    }
    if ((section?.bullet_points_json?.length ?? 0) > 0) {
      searchValueScore += 6;
    }
    searchValueScore = Math.min(searchValueScore, 100);

    let ctaScore = section ? 38 : 0;
    if (mapping.expected_section_key?.includes("cta") || section?.section_type === "cta") ctaScore += 32;
    if (/\btour\b|\bapply\b|\bcontact\b|\bschedule\b|\bvisit\b/.test(combined)) ctaScore += 22;
    ctaScore = Math.min(ctaScore, 100);

    let harmonizationScore = section ? 58 : 0;
    if (mapping.expected_order && section) {
      const orderDistance = Math.abs(mapping.expected_order - (section.section_order + 1));
      if (orderDistance === 0) harmonizationScore += 20;
      else if (orderDistance === 1) harmonizationScore += 12;
      else if (orderDistance > 2) harmonizationScore -= 10;
    }
    if (mapping.match_status === "extra-on-live") harmonizationScore -= 16;
    if (mapping.match_status === "missing-from-live") harmonizationScore = 0;
    harmonizationScore = Math.max(0, Math.min(harmonizationScore, 100));

    if (mapping.match_status === "missing-from-live") flags.push("missing_live_section");
    if (mapping.match_status === "extra-on-live") flags.push("extra_live_section");
    if (mapping.match_status === "partial") flags.push("structural_mismatch");
    if (copyLength > 0 && copyLength < 140) flags.push("thin_copy");
    if (copyLength > 420) flags.push("long_copy");
    if (specificityScore < 55) flags.push("weak_property_specificity");
    if (searchValueScore < 55) flags.push("weak_local_search_signal");
    if ((mapping.expected_section_key?.includes("cta") || section?.section_type === "cta") && ctaScore < 60) {
      flags.push("weak_cta");
    }

    const averageScore =
      (structuralScore + messagingScore + specificityScore + searchValueScore + ctaScore + harmonizationScore) / 6;
    const overallStatus: SectionAssessmentStatus =
      averageScore >= 70 && !flags.includes("missing_live_section")
        ? "healthy"
        : averageScore >= 45
          ? "watch"
          : "needs-attention";

    const summaryParts: string[] = [];
    if (mapping.match_status === "matched") summaryParts.push("structure aligns well with Specs");
    if (mapping.match_status === "partial") summaryParts.push("section only partially matches the expected Specs slot");
    if (mapping.match_status === "missing-from-live") summaryParts.push("expected Specs section is missing from the live page");
    if (mapping.match_status === "extra-on-live") summaryParts.push("live section has no confident Specs match yet");
    if (flags.includes("weak_property_specificity")) summaryParts.push("copy needs stronger property-specific proof");
    if (flags.includes("weak_local_search_signal")) summaryParts.push("copy needs more local/search information gain");
    if (flags.includes("weak_cta")) summaryParts.push("CTA language is weak or unclear");
    if (flags.includes("thin_copy")) summaryParts.push("captured copy is thin");
    if (summaryParts.length === 0) summaryParts.push("section is structurally sound and ready for deeper editorial review");

    return {
      mapping_id: mapping.id,
      section_id: mapping.section_id,
      overall_status: overallStatus,
      structural_score: Math.round(structuralScore),
      messaging_score: Math.round(messagingScore),
      specificity_score: Math.round(specificityScore),
      search_value_score: Math.round(searchValueScore),
      cta_score: Math.round(ctaScore),
      harmonization_score: Math.round(harmonizationScore),
      flags,
      summary: summaryParts.join("; ") + ".",
    };
  });
}

function summarizeSectionAssessments(assessments: SectionAssessmentRow[]): SectionAssessmentSummary {
  return assessments.reduce<SectionAssessmentSummary>(
    (summary, assessment) => {
      if (assessment.overall_status === "healthy") summary.healthy += 1;
      else if (assessment.overall_status === "watch") summary.watch += 1;
      else if (assessment.overall_status === "needs-attention") summary.needs_attention += 1;
      return summary;
    },
    { healthy: 0, watch: 0, needs_attention: 0 }
  );
}

async function syncSectionRewrites(
  db: D1Database,
  property: PropertyBriefRow,
  pages: PageRow[],
  sections: SectionRow[],
  mappings: SectionMappingRow[],
  assessments: SectionAssessmentRow[]
) {
  if (pages.length === 0) return;

  const pageIds = pages.map((page) => page.id);
  const existingRewrites = await queryAll<SectionRewriteRow>(
    db,
    `SELECT id, page_id, mapping_id, section_id, draft_status, rewrite_brief, proposed_copy, refinement_notes, governed_inputs_json, approved_at, approved_by, created_at, updated_at
     FROM site_content_section_rewrites
     WHERE page_id IN (${pageIds.map(() => "?").join(",")})`,
    pageIds
  );
  const existingByMappingId = new Map(existingRewrites.map((rewrite) => [rewrite.mapping_id, rewrite]));
  const mappingIds = new Set(mappings.map((mapping) => mapping.id));

  for (const rewrite of existingRewrites) {
    if (!mappingIds.has(rewrite.mapping_id)) {
      await run(db, `DELETE FROM site_content_section_rewrites WHERE id = ?`, [rewrite.id]);
    }
  }

  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const assessmentByMappingId = new Map(assessments.map((assessment) => [assessment.mapping_id, assessment]));
  const now = nowISO();

  for (const mapping of mappings) {
    if (existingByMappingId.has(mapping.id)) continue;
    const page = pages.find((candidate) => candidate.id === mapping.page_id);
    if (!page) continue;
    const section = mapping.section_id ? sectionById.get(mapping.section_id) ?? null : null;
    const assessment = assessmentByMappingId.get(mapping.id) ?? null;
    await run(
      db,
      `INSERT INTO site_content_section_rewrites
       (id, page_id, mapping_id, section_id, draft_status, rewrite_brief, proposed_copy, refinement_notes, governed_inputs_json, approved_at, approved_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        page.id,
        mapping.id,
        mapping.section_id,
        "not_started",
        buildDefaultRewriteBrief(property, page, mapping, assessment, section),
        "",
        "",
        JSON.stringify(buildGovernedInputsSnapshot(property, page, mapping, assessment, section)),
        null,
        null,
        now,
        now,
      ]
    );
  }
}

function buildDefaultRewriteBrief(
  property: PropertyBriefRow,
  page: PageRow,
  mapping: SectionMappingRow,
  assessment: SectionAssessmentRow | null | undefined,
  section: SectionRow | null
) {
  const parts = [
    `Rewrite the ${mapping.expected_section_label || "captured"} section for ${property.property_name}.`,
    mapping.expected_section_role ? `Role: ${mapping.expected_section_role}.` : null,
    `Page type: ${page.page_type || "page"}.`,
    assessment?.summary ? `Assessment: ${assessment.summary}` : null,
    mapping.match_status === "missing-from-live"
      ? "The live site is missing this expected Specs section, so draft net-new copy."
      : "Preserve what is useful from the live section, but improve specificity, clarity, and harmonization.",
    section?.title ? `Current live title: ${section.title}.` : null,
  ];
  return parts.filter(Boolean).join(" ");
}

function buildGovernedInputsSnapshot(
  property: PropertyBriefRow,
  page: PageRow,
  mapping: SectionMappingRow,
  assessment: SectionAssessmentRow | null | undefined,
  section: SectionRow | null
) {
  return {
    property_name: property.property_name,
    editorial_focus: property.editorial_focus,
    approved_points: property.approved_points,
    page_type: page.page_type,
    page_url: page.page_url,
    expected_section_key: mapping.expected_section_key,
    expected_section_label: mapping.expected_section_label,
    expected_section_role: mapping.expected_section_role,
    match_status: mapping.match_status,
    assessment_summary: assessment?.summary ?? null,
    assessment_flags: assessment ? safeParseJsonArray(assessment.flags_json) : [],
    live_section_title: section?.title ?? section?.heading ?? section?.section_label ?? null,
    live_section_copy: section?.original_copy ?? null,
  };
}

function summarizeSectionRewrites(rewrites: SectionRewriteRow[]): SectionRewriteSummary {
  return rewrites.reduce<SectionRewriteSummary>(
    (summary, rewrite) => {
      if (rewrite.draft_status === "not_started") summary.not_started += 1;
      else if (rewrite.draft_status === "drafted") summary.drafted += 1;
      else if (rewrite.draft_status === "in_review") summary.in_review += 1;
      else if (rewrite.draft_status === "approved") summary.approved += 1;
      return summary;
    },
    { not_started: 0, drafted: 0, in_review: 0, approved: 0 }
  );
}

async function discoverTargetPages(baseUrl: string, pageLimit: number): Promise<string[]> {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const pages = new Set<string>([normalizedBase]);
  const sitemapUrl = `${normalizedBase.replace(/\/$/, "")}/sitemap.xml`;

  try {
    const discovered = await collectSitemapPageUrls(sitemapUrl, normalizedBase);
    if (discovered.length > 0) {
      const prioritized = prioritizeUrls(discovered, normalizedBase).slice(0, pageLimit);
      for (const url of prioritized) pages.add(url);
    }
  } catch {
    // graceful fallback to homepage only
  }

  return Array.from(pages).slice(0, pageLimit);
}

async function collectSitemapPageUrls(sitemapUrl: string, baseUrl: string, depth = 0): Promise<string[]> {
  if (depth > 2) return [];

  const response = await fetch(sitemapUrl, { redirect: "follow" });
  if (!response.ok) return [];

  const xml = await response.text();
  const locMatches = [...xml.matchAll(/<loc>(.*?)<\/loc>/gi)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value) => isSameOrigin(baseUrl, value));

  const nestedSitemaps = locMatches.filter((value) => isSitemapUrl(value));
  const pageUrls = locMatches.filter((value) => !isSitemapUrl(value));

  const nestedResults = await Promise.all(
    nestedSitemaps.map((value) => collectSitemapPageUrls(value, baseUrl, depth + 1))
  );

  return [...pageUrls, ...nestedResults.flat()];
}

function prioritizeUrls(urls: string[], baseUrl: string): string[] {
  const deduped = Array.from(
    new Set(
      urls
        .filter((url) => !isSitemapUrl(url))
        .map((url) => url.replace(/\/$/, "") || url)
    )
  );
  return deduped
    .sort((a, b) => scoreUrl(b, baseUrl) - scoreUrl(a, baseUrl))
    .map((url) => (url.endsWith("/") ? url : `${url}/`).replace(/\/\/$/, "/"));
}

function scoreUrl(url: string, baseUrl: string): number {
  const path = normalizePagePath(url, baseUrl);
  let score = 0;
  if (path === "/") score += 100;
  if (/amenit/i.test(path)) score += 80;
  if (/floor|plan|layout/i.test(path)) score += 70;
  if (/neigh|location|area/i.test(path)) score += 60;
  if (/gallery/i.test(path)) score += 35;
  if (/contact|tour|apply/i.test(path)) score += 20;
  return score - path.length / 10;
}

async function crawlPage(pageUrl: string): Promise<{
  page_title: string | null;
  meta_description: string | null;
  crawl_status: string;
  sections: ExtractedSection[];
}> {
  try {
    const response = await fetch(pageUrl, { redirect: "follow" });
    if (!response.ok) {
      return { page_title: null, meta_description: null, crawl_status: `error:${response.status}`, sections: [] };
    }

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i);
    const sections = extractSections(html);

    return {
      page_title: titleMatch ? decodeHtml(stripTags(titleMatch[1])).trim() : null,
      meta_description: metaMatch ? decodeHtml(metaMatch[1]).trim() : null,
      crawl_status: "ready",
      sections,
    };
  } catch {
    return { page_title: null, meta_description: null, crawl_status: "error:fetch", sections: [] };
  }
}

function extractSections(html: string): ExtractedSection[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  const rawSections = [...cleaned.matchAll(/<section\b[\s\S]*?<\/section>/gi)].map((match) => match[0]);
  const sourceSections = rawSections.length > 0 ? rawSections : extractFallbackBlocks(cleaned);

  return sourceSections
    .map((block, index) => buildSection(block, index))
    .filter((section): section is ExtractedSection => Boolean(section && section.original_copy.length >= 80))
    .slice(0, 10);
}

function extractFallbackBlocks(html: string): string[] {
  const mainMatch = html.match(/<main\b[\s\S]*?<\/main>/i) || html.match(/<body\b[\s\S]*?<\/body>/i);
  const main = mainMatch?.[0] ?? html;
  const chunks = main.split(/<h2[^>]*>|<h3[^>]*>/i);
  return chunks.map((chunk) => chunk.trim()).filter(Boolean);
}

function buildSection(block: string, index: number): ExtractedSection | null {
  const headingTexts = [...block.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((match) => cleanInlineText(match[2]))
    .filter((text) => text.length > 1);
  const heading = headingTexts[0] ?? null;

  const paragraphMatches = [...block.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanInlineText(match[1]))
    .filter((text) => text.length > 24);
  const bulletMatches = [...block.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => cleanInlineText(match[1]))
    .filter((text) => text.length > 8)
    .slice(0, 6);

  const anatomy = deriveSectionAnatomy(headingTexts, paragraphMatches, index);
  const originalCopy = anatomy.bodyParagraphs.join("\n\n").trim();
  if (!originalCopy) return null;
  const sectionLabel = deriveSectionLabel(anatomy.title || heading, originalCopy, index);

  const imageCount = (block.match(/<img\b/gi) || []).length;
  const linkCount = (block.match(/<a\b/gi) || []).length;
  const mediaSide = inferMediaSide(block, imageCount);

  return {
    section_key: slugify(sectionLabel || `section-${index + 1}`),
    section_order: index,
    section_label: sectionLabel,
    heading: anatomy.title || heading,
    eyebrow: anatomy.eyebrow,
    title: anatomy.title || heading,
    subtitle: anatomy.subtitle,
    section_type: inferSectionType(heading || "", originalCopy),
    media_side: mediaSide,
    original_copy: originalCopy,
    bullet_points: bulletMatches,
    image_count: imageCount,
    link_count: linkCount,
  };
}

function deriveSectionAnatomy(
  headingTexts: string[],
  paragraphMatches: string[],
  index: number
): { eyebrow: string | null; title: string | null; subtitle: string | null; bodyParagraphs: string[] } {
  let eyebrow: string | null = null;
  let title: string | null = null;
  let subtitle: string | null = null;

  if (headingTexts.length >= 2) {
    eyebrow = headingTexts[0]!.length <= 42 ? headingTexts[0]! : null;
    title = eyebrow ? headingTexts[1] ?? headingTexts[0] ?? null : headingTexts[0] ?? null;
  } else if (headingTexts.length === 1) {
    title = headingTexts[0] ?? null;
  }

  if (!title && index === 0) title = "Welcome";

  const bodyParagraphs = [...paragraphMatches];
  if (bodyParagraphs.length > 1 && bodyParagraphs[0] && bodyParagraphs[0].length <= 180) {
    const first = bodyParagraphs[0];
    if (!title || normalizeLoose(first) !== normalizeLoose(title)) {
      subtitle = first;
      bodyParagraphs.shift();
    }
  }

  if (!title) {
    title = deriveSectionLabel(null, bodyParagraphs.join("\n\n"), index);
  }

  return { eyebrow, title, subtitle, bodyParagraphs };
}

function inferSectionType(heading: string, copy: string): string {
  const source = `${heading} ${copy}`.toLowerCase();
  if (source.includes("amenit")) return "amenities";
  if (source.includes("floor") || source.includes("layout")) return "floor-plans";
  if (source.includes("neighborhood") || source.includes("location") || source.includes("midtown")) return "neighborhood";
  if (source.includes("pet")) return "pet-friendly";
  if (source.includes("contact") || source.includes("tour") || source.includes("apply")) return "cta";
  return "standard";
}

function inferMediaSide(block: string, imageCount: number): "left" | "right" | "none" {
  if (imageCount === 0) return "none";
  const firstImg = block.search(/<img\b/i);
  const firstText =
    [block.search(/<h[1-6]\b/i), block.search(/<p\b/i)]
      .filter((value) => value >= 0)
      .sort((a, b) => a - b)[0] ?? -1;
  if (firstImg >= 0 && firstText >= 0 && firstImg < firstText) return "left";
  return "right";
}

function deriveSectionLabel(heading: string | null, copy: string, index: number): string {
  if (heading && heading.trim().length > 0) return heading.trim();

  const firstSentence = copy
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .find((part) => part.length > 24) ?? copy.trim();
  const lower = firstSentence.toLowerCase();

  if (index === 0) return "Welcome";
  if (/\bapartment features\b|\bsmart home\b|\bfloor plans?\b|\blayouts?\b|\binterior\b|\bfinishes\b/.test(lower)) {
    return "Apartment Features";
  }
  if (/\bcommunity amenities\b|\bamenities\b|\bpool\b|\bfitness\b|\bgym\b|\bcoworking\b|\blounge\b/.test(lower)) {
    return "Community Amenities";
  }
  if (/\bpet\b/.test(lower)) return "Pet-Friendly Living";
  if (/\bneighborhood\b|\blocation\b|\bmidtown\b|\batlantic station\b|\bwalkable\b/.test(lower)) {
    return "Neighborhood";
  }
  if (/\bcontact\b|\btour\b|\bapply\b|\bvisit\b/.test(lower)) return "Next Steps";

  const phrase = firstSentence
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 6)
    .join(" ")
    .replace(/[,:;.!?]+$/, "");

  return toTitleCase(phrase || `Section ${index + 1}`);
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function normalizeLoose(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  return `${url.protocol}//${url.host}/`;
}

function normalizePagePath(pageUrl: string, baseUrl: string): string {
  try {
    const page = new URL(pageUrl);
    const base = new URL(baseUrl);
    if (page.host !== base.host) return page.pathname || "/";
    return page.pathname || "/";
  } catch {
    return "/";
  }
}

function normalizePropertyKey(value: string): string {
  return decodeURIComponent(value)
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\s+/g, " ");
}

function normalizeLookup(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function resolvePropertyByKey(db: D1Database, propertyId: string): Promise<PropertyBriefRow | null> {
  const direct = await queryFirst<PropertyBriefRow>(
    db,
    `SELECT property_id, property_name, revised_url, live_url, staging_url, editorial_focus, approved_points, open_questions, advocate_prompt
     FROM intelligence_pilot_properties
     WHERE property_id = ?`,
    [propertyId]
  );
  if (direct) return direct;

  const byName = propertyId.replace(/[-_]+/g, " ").trim();
  const nameHit = await queryFirst<PropertyBriefRow>(
    db,
    `SELECT property_id, property_name, revised_url, live_url, staging_url, editorial_focus, approved_points, open_questions, advocate_prompt
     FROM intelligence_pilot_properties
     WHERE lower(property_name) = lower(?)`,
    [byName]
  );
  if (nameHit) return nameHit;

  const rows = await queryAll<PropertyBriefRow>(
    db,
    `SELECT property_id, property_name, revised_url, live_url, staging_url, editorial_focus, approved_points, open_questions, advocate_prompt
     FROM intelligence_pilot_properties`
  );
  const target = normalizeLookup(propertyId);
  return (
    rows.find((row) => normalizeLookup(row.property_id) === target) ??
    rows.find((row) => normalizeLookup(row.property_name) === target) ??
    null
  );
}

function inferPageType(pageUrl: string, baseUrl: string): string {
  const path = normalizePagePath(pageUrl, baseUrl).toLowerCase();
  if (path === "/") return "homepage";
  if (path.includes("special")) return "specials";
  if (path.includes("review")) return "reviews";
  if (path.includes("faq")) return "faqs";
  if (path.includes("about")) return "about-venterra";
  if (path.includes("gallery")) return "gallery";
  if (path.includes("contact")) return "contact";
  if (path.includes("apply") || path.includes("tour")) return "contact";
  if (path.includes("amenit")) return "amenities";
  if (path.includes("feature")) return "features";
  if (path.includes("floor") || path.includes("plan") || path.includes("layout") || path.includes("apartment")) return "apartments";
  if (path.includes("neigh") || path.includes("location")) return "neighborhood";
  return "page";
}

function toSpecsBinding(pageType: string | null | undefined) {
  const binding = getSpecsPageBinding(pageType);
  return {
    spec_archetype_id: binding?.archetypeId ?? null,
    spec_archetype_name: binding?.archetypeName ?? null,
    spec_page_id: binding?.pageId ?? null,
    spec_page_name: binding?.pageName ?? null,
    spec_layout_path: binding?.layoutPath ?? null,
    spec_screenshot: binding?.screenshot ?? null,
    spec_order: binding?.order ?? null,
  };
}

function isSameOrigin(baseUrl: string, candidate: string): boolean {
  try {
    return new URL(baseUrl).host === new URL(candidate).host;
  } catch {
    return false;
  }
}

function isSitemapUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return /\.xml$/i.test(url.pathname) || /sitemap/i.test(url.pathname);
  } catch {
    return /\.xml$/i.test(value) || /sitemap/i.test(value);
  }
}

function cleanInlineText(value: string): string {
  return decodeHtml(stripTags(value))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function ensureOptionalColumn(db: D1Database, table: string, column: string, definition: string) {
  try {
    await run(db, `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (error: any) {
    const message = String(error?.message ?? "");
    if (!message.includes("duplicate column name")) throw error;
  }
}

function safeParseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export { adminSiteContent };
