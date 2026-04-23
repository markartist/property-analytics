export type AppRole = "admin" | "editor" | "viewer";
export type SurfaceAction = "view" | "draft" | "approve" | "administer" | "handoff";

export type SurfaceId =
  | "pond"
  | "watchtower"
  | "dock"
  | "fish"
  | "tracker"
  | "popBrief"
  | "pibBuilder"
  | "searchIntelligence"
  | "gbpPosts"
  | "gscReport"
  | "intelligenceOffice"
  | "siteContent"
  | "vacs"
  | "evs"
  | "controlPlane"
  | "backup"
  | "adminUsers";

export type SurfaceCategory =
  | "Primary"
  | "Briefing"
  | "Search & Local"
  | "Content Ops"
  | "Validation"
  | "Toolbox"
  | "Utilities";

export type SurfaceAudience = "observer" | "curator" | "steward";

export interface SurfaceAccessDefinition {
  id: SurfaceId;
  href: string;
  label: string;
  category: SurfaceCategory;
  minRole: AppRole;
  actionRole?: AppRole;
  actions?: Partial<Record<SurfaceAction, AppRole>>;
  featuredHome?: boolean;
  audience: SurfaceAudience;
  summary: string;
}

export const ROLE_LEVEL: Record<AppRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
};

export const ROLE_PRODUCT_TITLES: Record<AppRole, string> = {
  viewer: "Observer",
  editor: "Curator",
  admin: "Steward",
};

export const OFFERING_ACCESS: Record<SurfaceId, SurfaceAccessDefinition> = {
  pond: {
    id: "pond",
    href: "/pond",
    label: "The Pond",
    category: "Primary",
    minRole: "viewer",
    actionRole: "viewer",
    actions: { view: "viewer" },
    featuredHome: true,
    audience: "observer",
    summary: "Portfolio front door for governed browsing, signals, and navigation.",
  },
  watchtower: {
    id: "watchtower",
    href: "/watchtower",
    label: "Watchtower",
    category: "Primary",
    minRole: "viewer",
    actionRole: "viewer",
    actions: { view: "viewer" },
    featuredHome: true,
    audience: "observer",
    summary: "System health, freshness, closure posture, and trust pressure.",
  },
  dock: {
    id: "dock",
    href: "/dock",
    label: "The Dock",
    category: "Primary",
    minRole: "viewer",
    actionRole: "viewer",
    actions: { view: "viewer" },
    featuredHome: true,
    audience: "observer",
    summary: "Governed report and dashboard browsing across the platform.",
  },
  fish: {
    id: "fish",
    href: "/fish",
    label: "Fishing Hole",
    category: "Primary",
    minRole: "viewer",
    actionRole: "viewer",
    actions: { view: "viewer" },
    featuredHome: true,
    audience: "observer",
    summary: "Ask for answers, exports, and AI-guided next moves.",
  },
  tracker: {
    id: "tracker",
    href: "/tracker",
    label: "Pilot Tracker",
    category: "Primary",
    minRole: "viewer",
    actionRole: "viewer",
    actions: { view: "viewer" },
    audience: "observer",
    summary: "Pilot monitoring, paired performance, and KPI comparisons.",
  },
  popBrief: {
    id: "popBrief",
    href: "/analysis",
    label: "POP Brief",
    category: "Briefing",
    minRole: "editor",
    actionRole: "editor",
    actions: { view: "editor", draft: "editor", approve: "admin", administer: "admin" },
    audience: "curator",
    summary: "Property operations and performance briefing surface.",
  },
  pibBuilder: {
    id: "pibBuilder",
    href: "/analysis/pib",
    label: "PIB Builder",
    category: "Briefing",
    minRole: "editor",
    actionRole: "editor",
    actions: { view: "editor", draft: "editor", approve: "admin", administer: "admin" },
    audience: "curator",
    summary: "PIB building and briefing workflow entry point.",
  },
  searchIntelligence: {
    id: "searchIntelligence",
    href: "/analysis/search-intelligence",
    label: "Search Intelligence",
    category: "Search & Local",
    minRole: "editor",
    actionRole: "editor",
    actions: { view: "editor", draft: "editor", approve: "editor", administer: "admin" },
    audience: "curator",
    summary: "Search, keyword, and competitive intelligence surface.",
  },
  gbpPosts: {
    id: "gbpPosts",
    href: "/gbp-posts",
    label: "GBP Posts",
    category: "Search & Local",
    minRole: "editor",
    actionRole: "editor",
    actions: { view: "editor", draft: "editor", approve: "editor", administer: "admin" },
    audience: "curator",
    summary: "Governed local posting workflow for Google Business Profiles.",
  },
  gscReport: {
    id: "gscReport",
    href: "/gsc",
    label: "GSC Report",
    category: "Search & Local",
    minRole: "editor",
    actionRole: "editor",
    actions: { view: "editor" },
    audience: "curator",
    summary: "Search Console reporting and search visibility analysis.",
  },
  intelligenceOffice: {
    id: "intelligenceOffice",
    href: "/intelligence-office",
    label: "Intelligence Office",
    category: "Content Ops",
    minRole: "admin",
    actionRole: "admin",
    actions: { view: "admin", draft: "admin", approve: "admin", administer: "admin" },
    audience: "steward",
    summary: "Admin-owned editorial guidance, directives, and claims layer.",
  },
  siteContent: {
    id: "siteContent",
    href: "/site-content",
    label: "Site Content Creator",
    category: "Content Ops",
    minRole: "admin",
    actionRole: "admin",
    actions: { view: "admin", draft: "admin", approve: "admin", administer: "admin" },
    audience: "steward",
    summary: "Governed crawl, mapping, assessment, and rewrite workflow.",
  },
  vacs: {
    id: "vacs",
    href: "/vacs",
    label: "VACS",
    category: "Content Ops",
    minRole: "editor",
    actionRole: "editor",
    actions: { view: "editor", draft: "editor", approve: "editor", administer: "admin" },
    audience: "curator",
    summary: "Machine-first content execution lane with governed bridge surface.",
  },
  evs: {
    id: "evs",
    href: "/evs",
    label: "EVS",
    category: "Validation",
    minRole: "editor",
    actionRole: "editor",
    actions: { view: "editor", draft: "editor", handoff: "editor", administer: "admin" },
    audience: "curator",
    summary: "Validation workflow for experiential testing and request review.",
  },
  controlPlane: {
    id: "controlPlane",
    href: "/system",
    label: "Control Plane",
    category: "Toolbox",
    minRole: "admin",
    actionRole: "admin",
    actions: { view: "admin", administer: "admin" },
    audience: "steward",
    summary: "Admin-only system awareness, trust posture, and consolidation map.",
  },
  backup: {
    id: "backup",
    href: "/backup",
    label: "Backup & Export",
    category: "Utilities",
    minRole: "editor",
    actionRole: "editor",
    actions: { view: "editor", draft: "editor", administer: "admin" },
    audience: "curator",
    summary: "Operational exports and backup-oriented utility lane.",
  },
  adminUsers: {
    id: "adminUsers",
    href: "/admin/users",
    label: "Admin",
    category: "Utilities",
    minRole: "admin",
    actionRole: "admin",
    actions: { view: "admin", administer: "admin" },
    audience: "steward",
    summary: "User, access, and administrative controls.",
  },
};

export const OFFERING_ORDER: SurfaceId[] = [
  "pond",
  "watchtower",
  "dock",
  "fish",
  "tracker",
  "popBrief",
  "pibBuilder",
  "searchIntelligence",
  "gbpPosts",
  "gscReport",
  "intelligenceOffice",
  "siteContent",
  "vacs",
  "evs",
  "controlPlane",
  "backup",
  "adminUsers",
];

const EDITOR_ALLOWED_OFFERINGS = new Set<SurfaceId>([
  "pond",
  "popBrief",
]);

const EDITOR_ALLOWED_PATH_PREFIXES = [
  "/",
  "/pond",
  "/analysis",
  "/communities",
  "/t7-metrics",
  "/t30-metrics",
  "/marketing",
  "/backup",
];

export function hasRole(userRole: AppRole | undefined | null, minRole: AppRole): boolean {
  if (!userRole) return false;
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole];
}

export function canAccessSurface(userRole: AppRole | undefined | null, minRole: AppRole): boolean {
  return hasRole(userRole, minRole);
}

export function canAccessOffering(userRole: AppRole | undefined | null, surfaceId: SurfaceId): boolean {
  if (userRole === "editor") {
    return EDITOR_ALLOWED_OFFERINGS.has(surfaceId);
  }
  return hasRole(userRole, OFFERING_ACCESS[surfaceId].minRole);
}

export function getOfferingActionRole(surfaceId: SurfaceId, action: SurfaceAction): AppRole {
  const offering = OFFERING_ACCESS[surfaceId];
  if (action === "view") return offering.minRole;
  return offering.actions?.[action] ?? offering.actionRole ?? offering.minRole;
}

export function canPerformOfferingAction(
  userRole: AppRole | undefined | null,
  surfaceId: SurfaceId,
  action: SurfaceAction
): boolean {
  if (userRole === "editor" && !EDITOR_ALLOWED_OFFERINGS.has(surfaceId)) {
    return false;
  }
  return hasRole(userRole, getOfferingActionRole(surfaceId, action));
}

export function canAccessPath(userRole: AppRole | undefined | null, pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (userRole !== "editor") return true;
  return EDITOR_ALLOWED_PATH_PREFIXES.some((prefix) =>
    prefix === "/" ? pathname === "/" || pathname === "/pond" : pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function getSidebarOfferings(userRole: AppRole | undefined | null): SurfaceAccessDefinition[] {
  if (userRole === "editor") {
    return OFFERING_ORDER.map((id) => OFFERING_ACCESS[id]);
  }
  return getVisibleOfferings(userRole);
}

export function getVisibleOfferings(userRole: AppRole | undefined | null): SurfaceAccessDefinition[] {
  return OFFERING_ORDER.map((id) => OFFERING_ACCESS[id]).filter((offering) => canAccessOffering(userRole, offering.id));
}

export function getVisibleOfferingsByCategory(
  userRole: AppRole | undefined | null,
  category: SurfaceCategory
): SurfaceAccessDefinition[] {
  return getVisibleOfferings(userRole).filter((offering) => offering.category === category);
}

export function getFeaturedOfferings(userRole: AppRole | undefined | null): SurfaceAccessDefinition[] {
  return getVisibleOfferings(userRole).filter((offering) => offering.featuredHome);
}

export function getRoleTitle(userRole: AppRole | undefined | null): string {
  return userRole ? ROLE_PRODUCT_TITLES[userRole] : "Guest";
}

export function getAudienceLabel(audience: SurfaceAudience): string {
  if (audience === "observer") return "Observers";
  if (audience === "curator") return "Curators";
  return "Stewards";
}
