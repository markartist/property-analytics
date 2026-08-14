import puppeteer from "@cloudflare/puppeteer";

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 " +
  "Mobile/15E148 Safari/604.1";

const DEFAULT_TARGETS = [
  { domain: "townestoneat359.com", url: "https://townestoneat359.com/", propertyCode: "TX4FC", label: "TowneStone at 359" },
  { domain: "thevinekyle.com", url: "https://thevinekyle.com/", propertyCode: "TX4EK", label: "The Vine Kyle Parkway" },
  { domain: "ventanaapts.com", url: "https://ventanaapts.com/", propertyCode: "TX4VE", label: "Ventana" }
];

function json(value, init = {}) {
  return new Response(JSON.stringify(value, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });
}

function text(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function safeUrl(base, href) {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function offerTitleFromText(value) {
  const normalized = text(value);
  const match = normalized.match(/((?:Get\s+)?(?:Up to\s+)?(?:\$[\d,]+\s+off|\d+\s+(?:weeks?|months?)\s+free)[^.!×]{0,90}[.!]?)/i);
  return text(match?.[1] || "");
}

function factKey(target) {
  return `resi:topper:${target.propertyCode || target.domain}`;
}

function historyKey(target, stamp) {
  return `resi:topper-history:${target.propertyCode || target.domain}:${stamp}`;
}

async function hashText(value) {
  const input = new TextEncoder().encode(value || "");
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function extractFacts(page, target) {
  return await page.evaluate((targetPayload) => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const offerTitleFromText = (value) => {
      const normalized = normalize(value);
      const match = normalized.match(/((?:Get\s+)?(?:Up to\s+)?(?:\$[\d,]+\s+off|\d+\s+(?:weeks?|months?)\s+free)[^.!×]{0,90}[.!]?)/i);
      return normalize(match?.[1] || "");
    };
    const absolute = (href) => {
      if (!href) return null;
      try {
        return new URL(href, targetPayload.url).toString();
      } catch {
        return null;
      }
    };
    const allText = normalize(document.body?.innerText || "");
    const linksFor = (root) => Array.from(root?.querySelectorAll?.("a[href]") || []).map((a) => ({
      label: normalize(a.innerText || a.textContent || ""),
      url: absolute(a.getAttribute("href"))
    })).filter((row) => row.label || row.url);

    function scorePromo(text) {
      const low = text.toLowerCase();
      let score = 0;
      ["free", "special", "limited time", "select homes", "availability", "contact us", "vip"].forEach((term) => {
        if (low.includes(term)) score += 1;
      });
      if (/\bup to\b|\$\s*\d+|\d+\s*(?:weeks?|months?)\s+free/.test(low)) score += 2;
      return score;
    }

    function promo() {
      const selectors = [
        "[data-edge-promo-toggle]",
        "[data-edge-promo-drop]",
        "[data-page-section='promo_bar']",
        "[data-component-name*='promo' i]",
        ".promo-wrap",
        ".popup-element",
        ".tm-popdown",
        "[class*='promo' i]"
      ];
      const candidates = [];
      for (const selector of selectors) {
        document.querySelectorAll(selector).forEach((element) => {
          const value = normalize(element.innerText || element.textContent || "");
          const score = scorePromo(value);
          if (value && score >= 2) candidates.push({ selector, element, value, score });
        });
      }
      candidates.sort((a, b) => b.score - a.score || b.value.length - a.value.length);
      const picked = candidates[0];
      if (!picked) return { present: false, source: "cloudflare_browser_worker", confidence: 0 };

      const headings = Array.from(picked.element.querySelectorAll("h1,h2,h3,summary,button"))
        .map((el) => normalize(el.innerText || el.textContent || ""))
        .filter((line) => line && line !== "×" && line.length > 2 && !/^close\b/i.test(line));
      const paragraphs = Array.from(picked.element.querySelectorAll("p"))
        .map((el) => normalize(el.innerText || el.textContent || ""))
        .filter(Boolean);
      const ems = Array.from(picked.element.querySelectorAll("em,i"))
        .map((el) => normalize(el.innerText || el.textContent || ""))
        .filter(Boolean);
      const title = offerTitleFromText(picked.value) || headings.find((line) => scorePromo(line) >= 2) || headings[0] || "";
      const body = paragraphs.find((line) => line !== title && !/limited time offer/i.test(line)) || "";
      const disclaimer = [...ems, ...paragraphs].find((line) => /limited time|select homes/i.test(line)) || "";
      return {
        present: true,
        source: "cloudflare_browser_worker",
        selector: picked.selector,
        title,
        body,
        disclaimer,
        links: linksFor(picked.element),
        raw_text: picked.value.slice(0, 500),
        confidence: body || disclaimer ? 0.85 : 0.65
      };
    }

    function reviews() {
      const match = allText.match(/\((\d(?:\.\d)?)\)\s+([\d,]+)\s+Reviews/i);
      if (!match) return { present: false, source: "cloudflare_browser_worker", confidence: 0 };
      const reviewLink = Array.from(document.querySelectorAll("a[href]")).find((a) => {
        const label = normalize(a.innerText || a.textContent || "");
        const href = a.getAttribute("href") || "";
        return /review/i.test(label) || /review/i.test(href);
      });
      return {
        present: true,
        source: "cloudflare_browser_worker",
        rating: Number(match[1]),
        count: Number(match[2].replace(/,/g, "")),
        url: absolute(reviewLink?.getAttribute("href")) || absolute("/reviews/"),
        fractional_stars_required: true,
        full_star_rounding_allowed: false,
        confidence: 0.85
      };
    }

    function awards() {
      const assets = [];
      document.querySelectorAll("img[src]").forEach((img) => {
        const haystack = `${img.getAttribute("alt") || ""} ${img.getAttribute("src") || ""}`.toLowerCase();
        if (haystack.includes("kingsley") || haystack.includes("award")) {
          assets.push({
            label: normalize(img.getAttribute("alt") || "Award"),
            url: absolute(img.getAttribute("src")),
            alt: normalize(img.getAttribute("alt") || "Award badge")
          });
        }
      });
      return {
        present: assets.length > 0,
        source: "cloudflare_browser_worker",
        assets,
        confidence: assets.length ? 0.8 : 0
      };
    }

    function phone() {
      const telLinks = Array.from(document.querySelectorAll("a[href^='tel:']")).map((a) => ({
        label: normalize(a.innerText || a.textContent || ""),
        href: a.getAttribute("href")
      }));
      return {
        visible_phone: telLinks.find((row) => row.label)?.label || "",
        tel_links: telLinks,
        source: "cloudflare_browser_worker",
        confidence: telLinks.length ? 0.8 : 0
      };
    }

    function contentBlocks() {
      const skip = ["apartments & pricing", "live better", "find your home", "schedule a tour", "apply now", "smarthub", "this website uses cookies"];
      const blocks = [];
      document.querySelectorAll("[data-page-section], section").forEach((section) => {
        if (blocks.length >= 2) return;
        const value = normalize(section.innerText || section.textContent || "");
        const low = value.toLowerCase();
        if (value.length < 120 || skip.some((term) => low.includes(term))) return;
        const heading = normalize(section.querySelector("h1,h2,h3,h4")?.innerText || section.querySelector("h1,h2,h3,h4")?.textContent || value.split(". ")[0] || "");
        const bullets = Array.from(section.querySelectorAll("li")).map((li) => normalize(li.innerText || li.textContent || "")).filter(Boolean).slice(0, 8);
        const image = section.querySelector("img[src]");
        blocks.push({
          heading,
          body: value.slice(0, 900),
          bullets,
          image_url: absolute(image?.getAttribute("src")),
          source_selector: section.getAttribute("data-page-section") || section.tagName.toLowerCase(),
          confidence: 0.7
        });
      });
      return blocks;
    }

    return {
      promo: promo(),
      reviews: reviews(),
      awards: awards(),
      phone: phone(),
      content_blocks: contentBlocks()
    };
  }, target);
}

async function harvestOne(env, target) {
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
    await page.setUserAgent(MOBILE_UA);
    await page.goto(target.url, { waitUntil: "networkidle0", timeout: 30000 });
    await page.evaluate(() => {
      const button = document.querySelector("[data-edge-promo-toggle], .vtr-shell-promo-toggle, summary, [data-component-name*='promo' i] button");
      if (button && typeof button.click === "function") button.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const html = await page.content();
    const facts = await extractFacts(page, target);
    const capturedAt = new Date().toISOString();
    const payload = {
      schema_version: "resi_topper_facts.v1",
      harvest_version: env.HARVEST_VERSION || "unknown",
      property_code: target.propertyCode,
      domain: target.domain,
      label: target.label,
      url: target.url,
      captured_at: capturedAt,
      capture: {
        provider: "cloudflare_browser_worker",
        viewport: { width: 390, height: 844 },
        html_sha256: await hashText(html),
        html_bytes: new TextEncoder().encode(html).byteLength
      },
      topper_facts: facts
    };
    const stamp = capturedAt.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    await env.RESI_TOPPER_FACTS.put(factKey(target), JSON.stringify(payload), {
      metadata: {
        propertyCode: target.propertyCode || "",
        domain: target.domain,
        capturedAt,
        harvestVersion: env.HARVEST_VERSION || ""
      }
    });
    await env.RESI_TOPPER_FACTS.put(historyKey(target, stamp), JSON.stringify(payload), {
      expirationTtl: 60 * 60 * 24 * 45
    });
    return { ok: true, key: factKey(target), payload };
  } finally {
    await browser.close();
  }
}

function targetFromUrl(requestUrl) {
  const domain = requestUrl.searchParams.get("domain");
  if (!domain) return null;
  return DEFAULT_TARGETS.find((target) => target.domain === domain) || null;
}

async function handleHarvest(request, env) {
  const requestUrl = new URL(request.url);
  const target = targetFromUrl(requestUrl);
  if (!target) {
    return json({ ok: false, reason: "Unknown or missing domain.", allowed_domains: DEFAULT_TARGETS.map((row) => row.domain) }, { status: 400 });
  }
  const result = await harvestOne(env, target);
  return json(result);
}

async function handleRead(request, env) {
  const requestUrl = new URL(request.url);
  const target = targetFromUrl(requestUrl);
  if (!target) {
    return json({ ok: false, reason: "Unknown or missing domain.", allowed_domains: DEFAULT_TARGETS.map((row) => row.domain) }, { status: 400 });
  }
  const value = await env.RESI_TOPPER_FACTS.get(factKey(target), { type: "json" });
  return json({ ok: Boolean(value), key: factKey(target), payload: value });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "resi-topper-freshness",
        harvest_version: env.HARVEST_VERSION || "unknown",
        targets: DEFAULT_TARGETS.map((row) => row.domain)
      });
    }
    if (url.pathname === "/read") return handleRead(request, env);
    if (url.pathname === "/harvest") return handleHarvest(request, env);
    return json({ ok: false, reason: "Not found." }, { status: 404 });
  },
  async scheduled(_event, env, ctx) {
    for (const target of DEFAULT_TARGETS) {
      ctx.waitUntil(harvestOne(env, target));
    }
  }
};
