export type SpecsPageBinding = {
  archetypeId: string;
  archetypeName: string;
  pageId: string;
  pageName: string;
  layoutPath: string;
  screenshot?: string;
  order: number;
};

export type SpecsSectionTemplate = {
  id: string;
  label: string;
  role: string;
  order: number;
  keywords: string[];
  preferredSectionTypes?: string[];
  optional?: boolean;
};

const ARCHETYPE_ID = "property_marketing_v1";
const ARCHETYPE_NAME = "Property Marketing Site";

export const PROPERTY_MARKETING_V1_PAGES: Record<string, SpecsPageBinding> = {
  homepage: {
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    pageId: "homepage",
    pageName: "Homepage",
    layoutPath: "/layouts/pages/homepage.json",
    screenshot: "figma:asset/3162c497989806348cdf6b41cf5f8651182108ce.png",
    order: 1,
  },
  apartments: {
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    pageId: "apartments",
    pageName: "Apartments & Pricing",
    layoutPath: "/layouts/pages/apartments-pricing.json",
    screenshot: "figma:asset/e21a19574a6ae0e46548c0bdd854e1e275c9af04.png",
    order: 2,
  },
  features: {
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    pageId: "features",
    pageName: "Features",
    layoutPath: "/layouts/pages/features.json",
    screenshot: "figma:asset/cbca34d34d37be7f0799c2cdc43ae6c9cab04176.png",
    order: 3,
  },
  amenities: {
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    pageId: "amenities",
    pageName: "Amenities",
    layoutPath: "/layouts/pages/amenities.json",
    screenshot: "figma:asset/3e051bd62d862f33c30a1c4abfc09f57a94f9f1f.png",
    order: 4,
  },
  gallery: {
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    pageId: "gallery",
    pageName: "Gallery",
    layoutPath: "/layouts/pages/gallery.json",
    screenshot: "figma:asset/38ba2d93925edf90de5fe320566432ad33254869.png",
    order: 5,
  },
  neighborhood: {
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    pageId: "neighborhood",
    pageName: "Location",
    layoutPath: "/layouts/pages/neighborhood.json",
    screenshot: "figma:asset/bb3ccb30acc4be8602f2ae84bdf0e8dd537045d2.png",
    order: 6,
  },
  contact: {
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    pageId: "contact",
    pageName: "Contact",
    layoutPath: "/layouts/pages/contact.json",
    screenshot: "figma:asset/bd0f4741a76feed0ae27474374ca7d9cb27e1c92.png",
    order: 7,
  },
  specials: {
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    pageId: "specials",
    pageName: "Specials",
    layoutPath: "/layouts/pages/specials.json",
    screenshot: "figma:asset/21b0f1599b16e15ba48abbb3b3a2e5f079ddf4fc.png",
    order: 8,
  },
  reviews: {
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    pageId: "reviews",
    pageName: "Reviews",
    layoutPath: "/layouts/pages/reviews.json",
    screenshot: "figma:asset/e2a638f2ecdcac1059c875838f8749cbf3a65ae4.png",
    order: 9,
  },
  faqs: {
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    pageId: "faqs",
    pageName: "FAQs",
    layoutPath: "/layouts/pages/faq.json",
    screenshot: "figma:asset/fcd54870f9fb1d26db3ea9cfc3001f38b5e708d7.png",
    order: 10,
  },
  "about-venterra": {
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    pageId: "about-venterra",
    pageName: "About Venterra",
    layoutPath: "/layouts/pages/about-venterra.json",
    screenshot: "figma:asset/346d5a569e5f1128339c91b893caa1cafe60875a.png",
    order: 11,
  },
};

export const PROPERTY_MARKETING_V1_SECTIONS: Record<string, SpecsSectionTemplate[]> = {
  homepage: [
    {
      id: "hero",
      label: "Hero",
      role: "Lead property positioning and orient the visitor immediately.",
      order: 1,
      keywords: ["welcome", "home", "apartments", "midtown", "houston", "luxury", "living"],
      preferredSectionTypes: ["standard"],
    },
    {
      id: "value-proposition",
      label: "Property Value Proposition",
      role: "Explain the property story and why this community is distinct.",
      order: 2,
      keywords: ["designed", "crafted", "experience", "lifestyle", "community", "modern", "residences"],
      preferredSectionTypes: ["standard", "features"],
    },
    {
      id: "amenities-proof",
      label: "Amenities Proof",
      role: "Show the strongest community amenities and day-to-day benefits.",
      order: 3,
      keywords: ["amenities", "pool", "fitness", "clubhouse", "lounge", "pet", "features"],
      preferredSectionTypes: ["amenities", "features"],
    },
    {
      id: "apartment-features",
      label: "Apartment Features",
      role: "Translate interior features into lived value for the renter.",
      order: 4,
      keywords: ["interior", "kitchen", "washer", "dryer", "floor plan", "bedroom", "apartment"],
      preferredSectionTypes: ["features", "floor-plans"],
      optional: true,
    },
    {
      id: "location-proof",
      label: "Location Proof",
      role: "Show why the surrounding area matters and what local context supports the property.",
      order: 5,
      keywords: ["neighborhood", "location", "midtown", "restaurants", "shopping", "commute", "walkable"],
      preferredSectionTypes: ["neighborhood"],
    },
    {
      id: "social-proof",
      label: "Social Proof",
      role: "Reinforce trust with reviews, testimonials, or proof of resident experience.",
      order: 6,
      keywords: ["reviews", "residents", "testimonial", "loved", "rated"],
      preferredSectionTypes: ["standard"],
      optional: true,
    },
    {
      id: "cta",
      label: "Next-Step CTA",
      role: "Move the visitor toward scheduling, contacting, or applying.",
      order: 7,
      keywords: ["tour", "contact", "apply", "schedule", "visit", "next steps"],
      preferredSectionTypes: ["cta"],
    },
  ],
  amenities: [
    {
      id: "amenities-hero",
      label: "Amenities Hero",
      role: "Frame the amenities page and the lifestyle promise.",
      order: 1,
      keywords: ["amenities", "features", "community", "lifestyle"],
      preferredSectionTypes: ["amenities", "standard"],
    },
    {
      id: "community-amenities",
      label: "Community Amenities",
      role: "List and explain common-area amenities.",
      order: 2,
      keywords: ["pool", "fitness", "clubhouse", "dog", "parking", "coworking", "lounge"],
      preferredSectionTypes: ["amenities"],
    },
    {
      id: "apartment-features",
      label: "Apartment Features",
      role: "Show how in-home features support the resident experience.",
      order: 3,
      keywords: ["washer", "dryer", "kitchen", "apartment", "interior", "finishes"],
      preferredSectionTypes: ["features"],
      optional: true,
    },
    {
      id: "amenities-cta",
      label: "Amenities CTA",
      role: "Connect amenities proof to a next visitor action.",
      order: 4,
      keywords: ["tour", "contact", "apply", "visit"],
      preferredSectionTypes: ["cta"],
      optional: true,
    },
  ],
  neighborhood: [
    {
      id: "location-hero",
      label: "Location Hero",
      role: "Frame the location story and market context.",
      order: 1,
      keywords: ["location", "neighborhood", "midtown", "houston"],
      preferredSectionTypes: ["neighborhood", "standard"],
    },
    {
      id: "local-destinations",
      label: "Local Destinations",
      role: "Highlight nearby places, attractions, and everyday convenience.",
      order: 2,
      keywords: ["restaurants", "shopping", "parks", "nightlife", "entertainment", "nearby"],
      preferredSectionTypes: ["neighborhood"],
    },
    {
      id: "commute-context",
      label: "Commute Context",
      role: "Explain mobility, access, and practical movement through the area.",
      order: 3,
      keywords: ["commute", "access", "transit", "minutes", "highway", "downtown", "employer"],
      preferredSectionTypes: ["neighborhood", "standard"],
      optional: true,
    },
    {
      id: "location-cta",
      label: "Location CTA",
      role: "Bridge location proof back to visiting or leasing.",
      order: 4,
      keywords: ["tour", "contact", "apply", "schedule"],
      preferredSectionTypes: ["cta"],
      optional: true,
    },
  ],
  "about-venterra": [
    {
      id: "brand-intro",
      label: "Brand Intro",
      role: "Introduce the management/company story.",
      order: 1,
      keywords: ["venterra", "about", "company", "team", "mission"],
      preferredSectionTypes: ["standard"],
    },
    {
      id: "resident-commitment",
      label: "Resident Commitment",
      role: "Explain the brand promise and resident experience posture.",
      order: 2,
      keywords: ["service", "resident", "care", "support", "community"],
      preferredSectionTypes: ["standard"],
    },
    {
      id: "brand-cta",
      label: "Brand CTA",
      role: "Return the visitor to a property-level next step.",
      order: 3,
      keywords: ["contact", "tour", "learn more", "apply"],
      preferredSectionTypes: ["cta"],
      optional: true,
    },
  ],
  contact: [
    {
      id: "contact-details",
      label: "Contact Details",
      role: "Provide the concrete contact and visitation information.",
      order: 1,
      keywords: ["contact", "call", "email", "office", "hours", "address"],
      preferredSectionTypes: ["cta", "standard"],
    },
    {
      id: "contact-cta",
      label: "Contact CTA",
      role: "Help the visitor take the next action immediately.",
      order: 2,
      keywords: ["tour", "apply", "schedule", "visit"],
      preferredSectionTypes: ["cta"],
      optional: true,
    },
  ],
  faqs: [
    {
      id: "faq-list",
      label: "FAQ List",
      role: "Answer common renter questions clearly and directly.",
      order: 1,
      keywords: ["faq", "question", "answer", "pet", "parking", "lease", "policy"],
      preferredSectionTypes: ["standard"],
    },
  ],
  reviews: [
    {
      id: "reviews-proof",
      label: "Reviews Proof",
      role: "Present review-driven credibility and resident trust signals.",
      order: 1,
      keywords: ["reviews", "residents", "stars", "rating", "testimonial"],
      preferredSectionTypes: ["standard"],
    },
    {
      id: "reviews-cta",
      label: "Reviews CTA",
      role: "Translate trust into a next action.",
      order: 2,
      keywords: ["tour", "contact", "visit", "apply"],
      preferredSectionTypes: ["cta"],
      optional: true,
    },
  ],
};

export function getSpecsPageBinding(pageType: string | null | undefined): SpecsPageBinding | null {
  if (!pageType) return null;
  return PROPERTY_MARKETING_V1_PAGES[pageType] ?? null;
}

export function getSpecsSectionTemplates(pageType: string | null | undefined): SpecsSectionTemplate[] {
  if (!pageType) return [];
  return PROPERTY_MARKETING_V1_SECTIONS[pageType] ?? [];
}
