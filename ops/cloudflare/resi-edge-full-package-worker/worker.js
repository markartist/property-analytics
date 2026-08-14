const PACKAGE_VERSION = "2026-08-08.champions-full-package-v1";

const PROPERTY = {
  code: "GA4CG",
  name: "Champions Green",
  host: "championsgreen-ga.com",
  origin: "https://championsgreen-ga.com",
  cityState: "Alpharetta, GA",
  title: "Champions Green Apartments in Alpharetta, GA",
  description: "Welcome home to Champions Green Apartments in Alpharetta, GA. Discover 1, 2, and 3 bedroom apartments in Alpharetta with spacious layouts, thoughtful amenities, and easy access to daily essentials.",
  canonical: "https://championsgreen-ga.com/",
  address: {
    street: "1001 Champions Green Parkway",
    city: "Alpharetta",
    region: "GA",
    postalCode: "30022",
    country: "US"
  },
  communityId: "18ec38d1-b4ec-4cf4-aba8-23ee58c99d8c",
  ga4PropertyId: "378404769",
  rating: 4.3,
  reviewCount: 284,
  reviewHref: "/reviews/",
  promo: {
    title: "Up to $1,000 off for a limited time!",
    body: "Stop in today and get up to $1,000 off for a limited time!",
    detail: "*Select Homes - Limited Time Offer",
    primaryLabel: "See Availability",
    primaryHref: "/apartments/?has_specials=true",
    secondaryLabel: "Contact Us",
    secondaryHref: "/contact/"
  },
  links: {
    apartments: "/apartments/",
    features: "/features/",
    amenities: "/amenities/",
    gallery: "/gallery/",
    neighborhood: "/neighborhood/",
    faqs: "/faqs/",
    reviews: "/reviews/",
    contact: "/contact/",
    specials: "/apartments/?has_specials=true",
    about: "/about/",
    smartHub: "https://online.venterraliving.com/smarthub/login",
    tour: "https://online.venterraliving.com/eOnlineLease/portal/scheduleTour/GA4CG",
    apply: "https://online.venterraliving.com/eOnlineLease/portal/createPipelineApplication/GA4CG"
  },
  sourceAttribution: {
    field: "id",
    defaultTrackingId: "GA4CG30L",
    sources: {
      GA4CG30L: { marketingSourceCd: "VWS", phone: "(470) 999-7208" },
      GA4CGGOA: { marketingSourceCd: "GOA", phone: "(770) 574-4050" },
      GA4CGAPT: { marketingSourceCd: "ADC-VL", phone: "(470) 999-7251" },
      GA4CGBNG: { marketingSourceCd: "BNG", phone: "(470) 536-8564" },
      GA4CGGOO: { marketingSourceCd: "GOO-VL", phone: "(470) 536-8564" },
      GA4CGSOC: { marketingSourceCd: "SOC", phone: "(470) 664-5950" },
      GA4CGYAH: { marketingSourceCd: "YHO", phone: "(470) 536-8564" },
      GA4CGALIST: { marketingSourceCd: "APL", phone: "(877) 237-1364" }
    }
  },
  hero: {
    image: "/assets/resi-edge-assets/GA4CG/home/hero-mobile-750x1000.avif",
    imageWebp: "/assets/resi-edge-assets/GA4CG/home/hero-mobile-750x1000.webp",
    desktopImage: "/assets/resi-edge-assets/GA4CG/home/hero-desktop-1600.avif",
    lbleSvg: "/assets/resi-edge-assets/shared/lble.svg",
    fallbackText: "Live Better. Live Easy.",
    headline: "1, 2, and 3 Bedroom Apartments in Alpharetta, GA",
    ctaLabel: "Find Your Home",
    ctaHref: "/apartments/"
  },
  content: {
    welcome: {
      title: "Welcome to Champions Green",
      kicker: "Choose the perfect layout for your lifestyle.",
      body: "In Alpharetta, Champions Green offers a welcoming sense of space, light, and comfort in a city known for its energy and innovation. Thoughtfully designed homes create room to spread out and settle in, while the surrounding Alpharetta lifestyle keeps you close to what matters, making every day feel easy and connected.",
      ctaLabel: "See Available Homes",
      ctaHref: "/apartments/",
      award: "/assets/resi-edge-assets/shared/kingsley-award.svg"
    },
    features: {
      image: "/assets/resi-edge-assets/GA4CG/home/features-900.avif",
      eyebrow: "Apartment Features",
      title: "Stylish Living Spaces",
      body: "Spread out in spacious interiors with full appliance packages, full-size washers and dryers, abundant natural light, bonus storage, and massive walk-in closets, plus select features like fireplaces, digital thermostats, sunrooms, and extra outdoor storage for added flexibility.",
      bullets: ["Full-Size Washer/Dryer", "Massive Walk-In Closets", "Sunrooms", "Digital Thermostats"],
      ctaLabel: "See Features",
      ctaHref: "/features/"
    }
  }
};

const ANALYTICS_BLOCKERS = [
  /googletagmanager\.com\/gtag\/js/i,
  /googletagmanager\.com\/gtm\.js/i,
  /googletagmanager\.com\/ns\.html/i,
  /js\.getresi\.co\/pixel/i,
  /heap/i,
  /contentsquare/i,
  /analytics\.ahrefs\.com/i
];

const INLINE_ANALYTICS_BLOCKERS = [
  /G-[A-Z0-9]+/,
  /gtag\s*\(/i,
  /googletagmanager/i,
  /dataLayer/i,
  /resi-pixel/i,
  /HEAP_/i,
  /\bheap\b/i,
  /contentsquare/i,
  /analytics\.ahrefs/i
  ,
  /tm-popup-inner-container/i,
  /popup-bar/i
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absolutize(href) {
  if (!href) return PROPERTY.origin + "/";
  return new URL(href, PROPERTY.origin + "/").toString();
}

function phoneHref(phone) {
  return `tel:+1${String(phone).replace(/\D/g, "")}`;
}

function phoneE164(phone) {
  return `+1${String(phone).replace(/\D/g, "")}`;
}

function sourceFor(url) {
  const id = (url.searchParams.get(PROPERTY.sourceAttribution.field) || "").toUpperCase();
  const selected = PROPERTY.sourceAttribution.sources[id] ? id : PROPERTY.sourceAttribution.defaultTrackingId;
  const record = PROPERTY.sourceAttribution.sources[selected];
  return {
    trackingId: selected,
    marketingSourceCd: record.marketingSourceCd,
    phone: record.phone
  };
}

function isMobile(request) {
  const ua = request.headers.get("user-agent") || "";
  return /Mobile|iPhone|Android/i.test(ua);
}

function isHtml(response) {
  return (response.headers.get("content-type") || "").includes("text/html");
}

function standardHeaders(headers = new Headers()) {
  const next = new Headers(headers);
  next.set("x-resi-edge-package", "full-package");
  next.set("x-resi-edge-template-version", PACKAGE_VERSION);
  next.set("x-resi-edge-property", PROPERTY.code);
  next.set("vary", "User-Agent, Accept-Encoding");
  return next;
}

async function serveAsset(request, env) {
  const url = new URL(request.url);
  const key = url.pathname.replace(/^\/assets\//, "");
  const object = await env.RESI_EDGE_ASSETS.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  const ext = key.split(".").pop();
  const types = {
    avif: "image/avif",
    webp: "image/webp",
    svg: "image/svg+xml; charset=utf-8",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    woff2: "font/woff2"
  };
  headers.set("content-type", types[ext] || "application/octet-stream");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}

function renderStars(rating) {
  const percent = Math.max(0, Math.min(100, Number(rating) / 5 * 100));
  return `<span class="vtr-stars" style="--rating:${percent.toFixed(2)}%" aria-label="${rating} out of 5 stars"><span>★★★★★</span></span>`;
}

function renderMobileShell(request) {
  const url = new URL(request.url);
  const source = sourceFor(url);
  const phone = source.phone;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: PROPERTY.name,
    url: PROPERTY.canonical,
    telephone: phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: PROPERTY.address.street,
      addressLocality: PROPERTY.address.city,
      addressRegion: PROPERTY.address.region,
      postalCode: PROPERTY.address.postalCode,
      addressCountry: PROPERTY.address.country
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: String(PROPERTY.rating),
      reviewCount: String(PROPERTY.reviewCount)
    }
  };

  const navItems = [
    ["Apartments & Pricing", PROPERTY.links.apartments],
    ["Features", PROPERTY.links.features],
    ["Amenities", PROPERTY.links.amenities],
    ["Gallery", PROPERTY.links.gallery],
    ["Location", PROPERTY.links.neighborhood],
    ["FAQs", PROPERTY.links.faqs],
    ["Reviews", PROPERTY.links.reviews],
    ["Contact", PROPERTY.links.contact],
    ["Specials", PROPERTY.links.specials],
    ["About Venterra", PROPERTY.links.about],
    ["SMARTHUB", PROPERTY.links.smartHub]
  ];

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(PROPERTY.title)}</title>
  <meta name="description" content="${escapeHtml(PROPERTY.description)}">
  <link rel="canonical" href="${PROPERTY.canonical}">
  <meta property="og:title" content="${escapeHtml(PROPERTY.title)}">
  <meta property="og:description" content="${escapeHtml(PROPERTY.description)}">
  <meta property="og:url" content="${PROPERTY.canonical}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${absolutize(PROPERTY.hero.desktopImage)}">
  <link rel="preload" as="image" href="${PROPERTY.hero.image}" imagesrcset="${PROPERTY.hero.image} 750w" imagesizes="100vw" fetchpriority="high" type="image/avif">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    @font-face{font-family:VtrLato;src:url('/assets/resi-edge-assets/shared/fonts/lato-71f7cc3a.woff2') format('woff2');font-weight:700;font-style:normal;font-display:swap}
    @font-face{font-family:VtrLato;src:url('/assets/resi-edge-assets/shared/fonts/lato-9b155c87.woff2') format('woff2');font-weight:400;font-style:normal;font-display:swap}
    @font-face{font-family:VtrSerif;src:url('/assets/resi-edge-assets/shared/fonts/notoserif-194b0294.woff2') format('woff2');font-weight:700;font-style:normal;font-display:swap}
    @font-face{font-family:VtrScript;src:url('/assets/resi-edge-assets/shared/fonts/BrittanySignature.woff2') format('woff2');font-weight:400;font-style:normal;font-display:swap}
    :root{--navy:#15284B;--blue:#3D66B9;--text:#15284B;--muted:#59657A;--paper:#FFFFFF;--soft:#F6F6F5;--line:#E4E8EF}
    *{box-sizing:border-box}html{font-family:VtrLato,Arial,sans-serif;color:var(--text);background:#fff}body{margin:0;overflow-x:hidden;background:#fff}a{color:inherit;text-decoration:none}
    .promo{height:56px;background:var(--navy);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;letter-spacing:.08em;text-align:center;padding:0 18px}
    .promo button{appearance:none;border:0;background:transparent;color:white;margin-left:10px;font:inherit;font-size:22px;line-height:1}
    .promo-panel{display:none;background:#fff;padding:32px 22px;text-align:center;border-bottom:1px solid var(--line);box-shadow:0 8px 24px rgba(21,40,75,.12)}
    .promo-panel[aria-hidden=false]{display:block}.promo-panel h2{font-family:VtrLato,Arial,sans-serif;font-size:31px;line-height:1.1;margin:0 0 20px;color:var(--navy)}.promo-panel p{font-size:20px;line-height:1.4;margin:0 auto 14px;max-width:680px}.promo-panel em{display:block;font-size:18px;margin:18px 0 28px;color:var(--text)}.promo-actions{display:flex;align-items:center;justify-content:center;gap:22px;flex-wrap:wrap}.btn-blue{background:var(--blue);color:white;border-radius:999px;padding:18px 30px;font-weight:800;letter-spacing:.08em}.text-action{font-weight:800;letter-spacing:.08em}
    .topbar{height:84px;background:#fff;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:12px;padding:0 22px;border-bottom:1px solid #f1f2f3}.logo{font-weight:800;letter-spacing:.12em;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.icon-phone{display:flex;align-items:center;justify-content:center;width:30px;height:30px;color:var(--navy)}.icon-phone svg{width:24px;height:24px;display:block}.tour{border:3px solid var(--navy);border-radius:999px;padding:13px 23px;font-weight:800;font-size:16px;letter-spacing:.08em}.menu{width:34px;height:26px;display:grid;gap:6px;background:transparent;border:0;padding:0}.menu span{height:3px;background:var(--navy);display:block}
    .drawer{position:fixed;inset:0 0 0 auto;width:min(84vw,330px);background:#fff;z-index:20;transform:translateX(105%);transition:transform .2s ease;box-shadow:-16px 0 40px rgba(21,40,75,.18);padding:30px}.drawer.open{transform:translateX(0)}.drawer-close{float:right;background:transparent;border:0;font-size:32px}.drawer ul{list-style:none;margin:48px 0 28px;padding:0;display:grid;gap:20px}.drawer a{font-size:18px;font-weight:800}.drawer-cta{display:grid;gap:14px}
    .hero{position:relative;min-height:calc(100svh - 140px);display:grid;align-items:center;text-align:center;color:#fff;isolation:isolate;overflow:hidden}.hero picture,.hero img.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(rgba(21,40,75,.18),rgba(21,40,75,.38));z-index:-1}.hero-inner{padding:30px 22px 36px}.reviews{display:inline-flex;align-items:center;gap:12px;color:#fff;font-weight:900;letter-spacing:.14em;font-size:13px;margin-bottom:24px}.vtr-stars{position:relative;display:inline-block;font-size:24px;letter-spacing:.05em;line-height:1;color:rgba(255,255,255,.35)}.vtr-stars:before{content:"★★★★★";position:absolute;inset:0;width:var(--rating);overflow:hidden;color:#fff}.vtr-stars span{visibility:hidden}.lble{display:block;width:88vw;max-width:620px;height:auto;margin:0 auto 24px}.hero h1{font-family:VtrLato,Arial,sans-serif;font-size:31px;line-height:1.18;margin:0 auto 34px;max-width:720px;text-shadow:0 2px 8px rgba(0,0,0,.18)}.find{display:inline-flex;align-items:center;gap:18px;background:#fff;color:#303437;border-radius:999px;padding:20px 34px;font-size:20px;font-weight:900;letter-spacing:.1em;box-shadow:0 10px 28px rgba(0,0,0,.14)}
    .panel{padding:42px 24px;background:#fff}.panel.alt{background:var(--soft)}.panel-inner{max-width:760px;margin:0 auto}.panel h2{font-family:VtrSerif,Georgia,serif;font-size:30px;line-height:1.15;margin:0 0 16px}.panel h3{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:var(--blue);margin:0 0 12px}.panel .kicker{font-weight:800;margin:0 0 14px}.panel p{font-size:15px;line-height:1.55;color:#263753;margin:0 0 22px}.panel img.block-img{width:100%;border-radius:6px;margin:0 0 24px;height:auto}.mini-btn{display:inline-flex;background:var(--blue);color:#fff;border-radius:999px;padding:13px 18px;font-size:12px;font-weight:900;letter-spacing:.06em}.award{width:72px;height:auto;margin:22px 0 0}.features-list{list-style:none;padding:0;margin:0 0 22px;display:grid;gap:8px}.features-list li{font-size:13px;color:#263753}.features-list li:before{content:"+";color:#3B9189;font-weight:900;margin-right:8px}.native-frame-wrap{height:1px;overflow:hidden}.native-frame-wrap.loaded{height:auto;overflow:visible}.native-frame{width:100%;border:0;display:block;min-height:900px;background:#fff}.consent-root{position:fixed;left:14px;right:14px;bottom:14px;z-index:30}
    @media (max-width:380px){.topbar{padding:0 18px;gap:10px}.logo{font-size:13px;letter-spacing:.1em}.tour{padding:12px 20px;font-size:15px}.hero h1{font-size:28px}.find{font-size:18px;padding:18px 28px}}
    @media (min-width:720px){.hero h1{font-size:38px}.panel{padding:64px 38px}.panel h2{font-size:38px}}
  </style>
</head>
<body data-vtr-package="${PACKAGE_VERSION}" data-property-code="${PROPERTY.code}" data-tracking-id="${source.trackingId}" data-marketing-source="${source.marketingSourceCd}">
  <a href="#main" style="position:absolute;left:-9999px;top:auto">Skip to main content</a>
  <div class="promo" id="promoBar">${escapeHtml(PROPERTY.promo.title)} <button type="button" aria-expanded="false" aria-controls="promoPanel">⌄</button></div>
  <section class="promo-panel" id="promoPanel" aria-hidden="true">
    <h2>${escapeHtml(PROPERTY.promo.title)}</h2>
    <p>${escapeHtml(PROPERTY.promo.body)}</p>
    <em>${escapeHtml(PROPERTY.promo.detail)}</em>
    <div class="promo-actions"><a class="btn-blue" href="${PROPERTY.promo.primaryHref}">${escapeHtml(PROPERTY.promo.primaryLabel)}</a><a class="text-action" href="${PROPERTY.promo.secondaryHref}">${escapeHtml(PROPERTY.promo.secondaryLabel)}</a></div>
  </section>
  <header class="topbar">
    <a class="logo" href="/">${escapeHtml(PROPERTY.name)}</a>
    <a class="icon-phone" href="${phoneHref(phone)}" aria-label="Call ${escapeHtml(PROPERTY.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8c1.7 3.3 3.3 4.9 6.6 6.6l2.2-2.2c.3-.3.8-.4 1.2-.3 1.3.4 2.6.6 4 .6.7 0 1.2.5 1.2 1.2v3.6c0 .7-.5 1.2-1.2 1.2C10.6 21.5 2.5 13.4 2.5 3.4c0-.7.5-1.2 1.2-1.2h3.6c.7 0 1.2.5 1.2 1.2 0 1.4.2 2.7.6 4 .1.4 0 .9-.3 1.2l-2.2 2.2Z"/></svg></a>
    <a class="tour" href="${PROPERTY.links.tour}">Tour</a>
    <button class="menu" type="button" aria-label="Open menu"><span></span><span></span><span></span></button>
  </header>
  <aside class="drawer" id="drawer" aria-hidden="true">
    <button class="drawer-close" type="button" aria-label="Close menu">×</button>
    <ul>${navItems.map(([label, href]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`).join("")}</ul>
    <div class="drawer-cta"><a href="${PROPERTY.links.tour}">Schedule A Tour</a><a href="${PROPERTY.links.apply}">Apply Now</a><a href="${phoneHref(phone)}">Call: ${escapeHtml(phone)}</a></div>
  </aside>
  <main id="main">
    <section class="hero">
      <picture><source srcset="${PROPERTY.hero.image}" type="image/avif"><img class="hero-img" src="${PROPERTY.hero.imageWebp}" width="750" height="1000" alt="${escapeHtml(PROPERTY.name)} apartment community pool" fetchpriority="high" decoding="async"></picture>
      <div class="hero-inner">
        <a class="reviews" href="${PROPERTY.reviewHref}">${renderStars(PROPERTY.rating)} <span>(${PROPERTY.rating}) ${PROPERTY.reviewCount} REVIEWS</span></a>
        <img class="lble" src="${PROPERTY.hero.lbleSvg}" width="841" height="202" alt="${PROPERTY.hero.fallbackText}">
        <h1>${escapeHtml(PROPERTY.hero.headline)}</h1>
        <a class="find" href="${PROPERTY.hero.ctaHref}">${escapeHtml(PROPERTY.hero.ctaLabel)} <span aria-hidden="true">→</span></a>
      </div>
    </section>
    <section class="panel">
      <div class="panel-inner">
        <h2>${escapeHtml(PROPERTY.content.welcome.title)}</h2>
        <p class="kicker">${escapeHtml(PROPERTY.content.welcome.kicker)}</p>
        <p>${escapeHtml(PROPERTY.content.welcome.body)}</p>
        <a class="mini-btn" href="${PROPERTY.content.welcome.ctaHref}">${escapeHtml(PROPERTY.content.welcome.ctaLabel)}</a>
        <img class="award" src="${PROPERTY.content.welcome.award}" alt="Kingsley Excellence Award">
      </div>
    </section>
    <section class="panel alt">
      <div class="panel-inner">
        <img class="block-img" src="${PROPERTY.content.features.image}" alt="Champions Green apartment kitchen" loading="lazy" decoding="async">
        <h3>${escapeHtml(PROPERTY.content.features.eyebrow)}</h3>
        <h2>${escapeHtml(PROPERTY.content.features.title)}</h2>
        <p>${escapeHtml(PROPERTY.content.features.body)}</p>
        <ul class="features-list">${PROPERTY.content.features.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <a class="mini-btn" href="${PROPERTY.content.features.ctaHref}">${escapeHtml(PROPERTY.content.features.ctaLabel)}</a>
      </div>
    </section>
    <section class="native-frame-wrap" id="nativeWrap" aria-label="More ${escapeHtml(PROPERTY.name)} content">
      <iframe class="native-frame" id="nativeFrame" title="${escapeHtml(PROPERTY.name)} additional page content" loading="lazy"></iframe>
    </section>
  </main>
  <div class="consent-root" id="vtrConsentRoot"></div>
  <script src="/__vtr/topper-analytics.js" defer></script>
  <script src="/__vtr/zaraz-consent-ui.js" defer></script>
  <script>
  (()=>{const p=document.getElementById('promoPanel');const b=document.querySelector('#promoBar button');b?.addEventListener('click',()=>{const open=p.getAttribute('aria-hidden')==='false';p.setAttribute('aria-hidden',open?'true':'false');b.setAttribute('aria-expanded',open?'false':'true');b.textContent=open?'⌄':'⌃';window.__vtrTrack?.('promo_toggle',{open:!open});});const d=document.getElementById('drawer');document.querySelector('.menu')?.addEventListener('click',()=>{d.classList.add('open');d.setAttribute('aria-hidden','false');window.__vtrTrack?.('menu_open')});document.querySelector('.drawer-close')?.addEventListener('click',()=>{d.classList.remove('open');d.setAttribute('aria-hidden','true')});let loaded=false;function loadNative(){if(loaded)return;loaded=true;const wrap=document.getElementById('nativeWrap');const frame=document.getElementById('nativeFrame');frame.src='/__resi-edge/native-continuation?'+location.search.replace(/^\\?/,'');wrap.classList.add('loaded')}addEventListener('scroll',loadNative,{once:true,passive:true});addEventListener('pointerdown',loadNative,{once:true,passive:true});setTimeout(loadNative,4500);})();</script>
</body>
</html>`;
  const headers = standardHeaders();
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=0, s-maxage=300");
  headers.set("x-resi-edge-device", "mobile");
  headers.set("x-resi-edge-mode", "standalone-mobile-shell");
  headers.set("x-resi-edge-tracking-id", source.trackingId);
  headers.set("x-resi-edge-source-selection", source.marketingSourceCd);
  return new Response(html, { headers });
}

function renderLlmsTxt() {
  return `# ${PROPERTY.name}

> ${PROPERTY.description}
> Last updated: 08/08/2026

Important notes:
- Pricing, availability, specials, fees, lease terms, and policies may change. Verify current details on the Apartments page or by contacting the leasing office.
- This file highlights official property resources from ${PROPERTY.name} and does not replace the full XML sitemap.

## Core Property Information

- [Homepage](${PROPERTY.origin}/): Official overview of ${PROPERTY.name}.
- [Apartments](${PROPERTY.origin}/apartments/): Floor plans, pricing, availability, bedroom and bathroom options, and current leasing details.
- [Features](${PROPERTY.origin}/features/): Apartment features, interior finishes, home conveniences, and in-home details.
- [Amenities](${PROPERTY.origin}/amenities/): Community amenities, shared spaces, resident services, and lifestyle details.
- [Gallery](${PROPERTY.origin}/gallery/): Official property photos, apartment images, amenity photos, and visual context.
- [Neighborhood](${PROPERTY.origin}/neighborhood/): Nearby shopping, dining, employers, schools, transportation, and local area context.

## Leasing And Contact

- [Specials](${PROPERTY.origin}/apartments/?has_specials=true): Current leasing specials, promotions, and offer details when available.
- [Contact](${PROPERTY.origin}/contact/): Leasing office contact information, tour requests, phone number, address, and inquiry form.
- [Reviews](${PROPERTY.origin}/reviews/): Resident and prospect reviews for ${PROPERTY.name}.

## Search

- [Search this site](${PROPERTY.origin}/?s={query}): WordPress search results for official ${PROPERTY.name} website content.

## Optional

- [XML Sitemap](${PROPERTY.origin}/sitemaps.xml): Complete list of indexable URLs for this property website.
`;
}

function stripNativeAnalytics(html) {
  let next = html;
  next = next.replace(/<noscript\b[\s\S]*?googletagmanager\.com\/ns\.html[\s\S]*?<\/noscript>/gi, "");
  next = next.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (tag, attrs, src) => (
    ANALYTICS_BLOCKERS.some((pattern) => pattern.test(src)) ? "" : tag
  ));
  next = next.replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, (tag) => (
    INLINE_ANALYTICS_BLOCKERS.some((pattern) => pattern.test(tag)) ? "" : tag
  ));
  return next;
}

function applyNativeIdentityFixes(html, url) {
  const source = sourceFor(url);
  const nextPhone = source.phone;
  const nextE164 = phoneE164(nextPhone);
  return html
    .replace(/championsgreen\.kinsta\.cloud/g, PROPERTY.host)
    .replace(/championsgreen\\\/kinsta\\\/cloud/g, PROPERTY.host)
    .replace(/Apartments in Alpharetta, TX/g, "Apartments in Alpharetta, GA")
    .replace(/\(470\)\s*999-7208/g, nextPhone)
    .replace(/\+14709997208/g, nextE164)
    .replace(/tel:\+14709997208/g, phoneHref(nextPhone))
    .replace(/tel:\(470\)\s*999-7208/g, phoneHref(nextPhone));
}

function cleanNativeHtml(html, url) {
  return applyNativeIdentityFixes(stripNativeAnalytics(html), url);
}

function injectHeadFixes(html) {
  const tags = `
<script src="/__vtr/zaraz-consent-ui.js" defer data-vtr-consent-ui="1"></script>`;
  return html.includes("</body>") ? html.replace("</body>", `${tags}</body>`) : `${html}${tags}`;
}

async function cleanNativeResponse(request, headersOnly = false) {
  const originResponse = await fetch(request, { cf: { cacheEverything: false, cacheTtl: 0 } });
  if (headersOnly || !isHtml(originResponse)) return originResponse;
  const html = injectHeadFixes(cleanNativeHtml(await originResponse.text(), new URL(request.url)));
  const headers = standardHeaders(originResponse.headers);
  headers.delete("content-length");
  headers.set("x-resi-edge-device", "desktop");
  headers.set("x-resi-edge-mode", "native-clean");
  return new Response(html, { status: originResponse.status, statusText: originResponse.statusText, headers });
}

async function nativeContinuation(request) {
  const requestUrl = new URL(request.url);
  const originUrl = new URL(PROPERTY.origin + "/");
  requestUrl.searchParams.forEach((value, key) => {
    if (key !== "__resi_edge_native") originUrl.searchParams.append(key, value);
  });
  originUrl.searchParams.set("__resi_edge_native", "1");
  const originResponse = await fetch(new Request(originUrl.toString(), request), { cf: { cacheEverything: true, cacheTtl: 300 } });
  if (!isHtml(originResponse)) return originResponse;
  let html = cleanNativeHtml(await originResponse.text(), requestUrl);
  const cleanup = `<style data-vtr-continuation-cleanup>
    header,.tm-header,.uk-navbar-container,.resi__header,.resi__promo,.uk-sticky,.tm-header-mobile{display:none!important}
  </style>
  <script>
    (()=>{function clean(){const needles=['Live Better. Live Easy','Welcome to Champions Green','Apartment Features','Stylish Living Spaces'];document.querySelectorAll('main > .uk-section, main section, [data-id]').forEach((el)=>{const t=(el.textContent||'').replace(/\\s+/g,' ').trim();if(needles.some(n=>t.includes(n)))el.remove();});document.documentElement.style.overflowX='hidden';if(document.body)document.body.style.margin='0';}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',clean,{once:true}):clean();})();
  </script>`;
  html = html.includes("</head>") ? html.replace("</head>", `${cleanup}</head>`) : `${cleanup}${html}`;
  const headers = standardHeaders(originResponse.headers);
  headers.delete("content-length");
  headers.set("x-resi-edge-mode", "native-continuation");
  return new Response(html, { status: originResponse.status, statusText: originResponse.statusText, headers });
}

function topperAnalyticsJs() {
  return `window.__vtrTrack=function(name,props){props=Object.assign({property_code:'${PROPERTY.code}',package_version:'${PACKAGE_VERSION}'},props||{});if(window.zaraz&&typeof window.zaraz.track==='function')window.zaraz.track(name,props);window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:name,...props});};document.addEventListener('click',function(e){const a=e.target.closest&&e.target.closest('a');if(!a)return;const href=a.getAttribute('href')||'';if(href.startsWith('tel:'))window.__vtrTrack('phone_click',{href});else if(/scheduleTour/i.test(href))window.__vtrTrack('schedule_tour_click',{href});else if(/createPipelineApplication/i.test(href))window.__vtrTrack('apply_now_click',{href});else if(/apartments/i.test(href))window.__vtrTrack('find_home_click',{href});},{capture:true});`;
}

function consentUiJs() {
  return `(function(w,d){if(w.__vtrZarazConsentPill)return;w.__vtrZarazConsentPill=true;var storageKey="vtr_zaraz_consent_notice_done_v2";var rootId="vtr-cookie-notice";function ready(fn){d.readyState==="loading"?d.addEventListener("DOMContentLoaded",fn,{once:true}):fn()}function z(){return w.zaraz&&w.zaraz.consent}function choices(){var c=z();return c&&typeof c.getAll==="function"?c.getAll():null}function done(){try{return localStorage.getItem(storageKey)==="1"}catch(e){return false}}function mark(){try{localStorage.setItem(storageKey,"1")}catch(e){}}function shouldShow(){if(done()||/(?:^|; )zaraz-consent=/.test(d.cookie||""))return false;var c=choices();return !c||Object.values(c).every(function(v){return v===false})}function remove(){var el=d.getElementById(rootId);if(el)el.remove()}function setAll(value){var c=z();if(!c)return false;if(typeof c.setAll==="function")c.setAll(value);else if(typeof c.set==="function"){var all=choices()||{};var payload={};Object.keys(all).forEach(function(k){payload[k]=value});c.set(payload)}if(value&&typeof c.sendQueuedEvents==="function")c.sendQueuedEvents();d.dispatchEvent(new Event("zarazConsentChoicesUpdated"));mark();remove();return true}function openPrefs(){remove();if(w.zaraz&&typeof w.zaraz.showConsentModal==="function")w.zaraz.showConsentModal()}function show(){if(!shouldShow()||d.getElementById(rootId))return;var style=d.createElement("style");style.id="vtr-cookie-notice-style";style.textContent="#vtr-cookie-notice{position:fixed;left:50%;right:auto;bottom:28px;z-index:2147482500;display:flex;align-items:center;gap:22px;box-sizing:border-box;width:max-content;max-width:calc(100vw - 32px);min-height:84px;margin:0;padding:10px 18px 10px 20px;border:1px solid #EBECEA;border-radius:999px;background:#FFFFFF;color:#15284B;box-shadow:0 18px 32px rgba(0,0,0,.18),0 3px 8px rgba(21,40,75,.08);font-family:Lato,Arial,sans-serif;transform:translateX(-50%)}#vtr-cookie-icon{display:flex;align-items:center;justify-content:center;flex:0 0 auto;width:48px;height:48px;color:#15284B}#vtr-cookie-icon svg{display:block;width:40px;height:40px}#vtr-cookie-notice p{flex:0 0 auto;margin:0;color:#1f2937;font-size:24px;font-weight:400;line-height:1.2;white-space:nowrap}#vtr-cookie-notice-actions{display:flex;align-items:center;gap:10px;flex:0 0 auto}#vtr-cookie-notice button{box-sizing:border-box;height:60px;margin:0;padding:0 32px;border-radius:999px;font-family:Lato,Arial,sans-serif;font-size:24px;font-weight:900;letter-spacing:0;line-height:58px;white-space:nowrap;cursor:pointer}#vtr-cookie-manage{min-width:198px;border:2px solid rgba(125,202,194,.24);background:#FFFFFF;color:#2B2B2B;box-shadow:none}#vtr-cookie-manage:hover{border-color:rgba(125,202,194,.44);background:#F6F6F5}#vtr-cookie-accept{min-width:144px;border:2px solid #7DCAC2;background:#7DCAC2;color:#15284B;box-shadow:none}#vtr-cookie-accept:hover{border-color:#3B9189;background:#3B9189;color:#FFFFFF}#vtr-cookie-notice button:focus{outline:3px solid #7DCAC2;outline-offset:2px}@media(max-width:740px){#vtr-cookie-notice{left:10px;right:10px;bottom:10px;width:auto;max-width:none;min-height:0;display:grid;grid-template-columns:auto 1fr;gap:10px 12px;padding:12px;border-radius:24px;transform:none}#vtr-cookie-icon{width:36px;height:36px}#vtr-cookie-icon svg{width:32px;height:32px}#vtr-cookie-notice p{align-self:center;font-size:16px;white-space:normal}#vtr-cookie-notice-actions{grid-column:1/3;display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}#vtr-cookie-notice button{width:100%;height:44px;padding:0 12px;font-size:15px;line-height:42px}#vtr-cookie-manage,#vtr-cookie-accept{min-width:0}}@media(min-width:741px){#vtr-cookie-notice{transform:translateX(-50%)}}";var wrap=d.createElement("section");wrap.id=rootId;wrap.setAttribute("role","region");wrap.setAttribute("aria-label","Cookie preferences");wrap.innerHTML='<span id="vtr-cookie-icon" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M42 25.5A17.5 17.5 0 1 1 22.5 6c.2 2.7 2.1 5 4.8 5.6-.5 3.3 2.1 6.2 5.4 6.1.7 3.4 4.1 5.5 7.4 4.6 1.1.3 1.9 1.5 1.9 3.2Z" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="17" r="2" fill="currentColor"/><circle cx="27" cy="25" r="2" fill="currentColor"/><circle cx="17" cy="31" r="2" fill="currentColor"/><circle cx="31" cy="35" r="1.8" fill="currentColor"/></svg></span><p>This website uses cookies</p><div id="vtr-cookie-notice-actions"><button id="vtr-cookie-manage" type="button">Preferences</button><button id="vtr-cookie-accept" type="button">Accept</button></div>';d.head.appendChild(style);d.body.appendChild(wrap);wrap.querySelector("#vtr-cookie-accept").addEventListener("click",function(){setAll(true)});wrap.querySelector("#vtr-cookie-manage").addEventListener("click",openPrefs)}function boot(){var tries=0;var timer=setInterval(function(){tries++;if(z()||tries>=20){clearInterval(timer);show()}},250)}d.addEventListener("zarazConsentChoicesUpdated",function(){mark();remove()});ready(boot)})(window,document);`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/assets/resi-edge-assets/")) return serveAsset(request, env);
    if (url.pathname === "/llms.txt") {
      return new Response(renderLlmsTxt(), {
        headers: standardHeaders(new Headers({ "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" }))
      });
    }
    if (url.pathname === "/__vtr/topper-analytics.js") {
      return new Response(topperAnalyticsJs(), { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=300" } });
    }
    if (url.pathname === "/__vtr/zaraz-consent-ui.js") {
      return new Response(consentUiJs(), { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=300" } });
    }
    if (url.pathname === "/__resi-edge/native-continuation") return nativeContinuation(request);
    if (url.searchParams.get("__resi_edge_native") === "1") {
      const cleanUrl = new URL(url.toString());
      cleanUrl.searchParams.delete("__resi_edge_native");
      return cleanNativeResponse(new Request(cleanUrl.toString(), request));
    }
    if (request.method !== "GET") return fetch(request);
    if (url.hostname === PROPERTY.host && url.pathname === "/" && isMobile(request)) return renderMobileShell(request);
    return cleanNativeResponse(request);
  }
};
