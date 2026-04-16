import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { queryAll, queryFirst, run } from "../lib/db";
import { newId } from "../lib/id";
import { nowISO, errJson } from "../lib/validate";
import { writeAuditLog } from "../lib/audit";
import { getSpecsPageBinding } from "../platform/shared/specs-property-marketing-v1";
import { getBriefCompletenessMap } from "../platform/intelligence/brief-completeness";

const adminSiteContent = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
adminSiteContent.use("*", requireAuth, requireAdmin);

const CrawlBody = z.object({
  page_limit: z.number().int().min(1).max(25).optional(),
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

adminSiteContent.get("/", async (c) => {
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

adminSiteContent.get("/:propertyId", async (c) => {
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

  const pagesWithSections = pages.map((page) => ({
    ...page,
    ...toSpecsBinding(page.page_type),
    sections: sections
      .filter((section) => section.page_id === page.id)
      .map((section) => ({
        ...section,
        bullet_points: safeParseJsonArray(section.bullet_points_json),
      })),
  })) satisfies PageWithSections[];

  return c.json({ property, pages: pagesWithSections });
});

adminSiteContent.post("/:propertyId/crawl", async (c) => {
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
  await ensureOptionalColumn(db, "site_content_sections", "eyebrow", "TEXT");
  await ensureOptionalColumn(db, "site_content_sections", "title", "TEXT");
  await ensureOptionalColumn(db, "site_content_sections", "subtitle", "TEXT");
  await ensureOptionalColumn(db, "site_content_sections", "media_side", "TEXT");
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
