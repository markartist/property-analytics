import type { AuthUser } from "../env";
import type { AuthVariables } from "../middleware/auth";
import type { Context, Next } from "hono";
import type { Env } from "../env";

export type OfferingId =
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

export type OfferingAction = "view" | "draft" | "approve" | "administer" | "handoff";

type Role = AuthUser["role"];

const ROLE_LEVEL: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
};

const OFFERING_ACTION_REQUIREMENTS: Record<OfferingId, Partial<Record<OfferingAction, Role>>> = {
  pond: { view: "viewer" },
  watchtower: { view: "viewer" },
  dock: { view: "viewer" },
  fish: { view: "viewer" },
  tracker: { view: "viewer" },
  popBrief: { view: "editor", draft: "editor", approve: "admin", administer: "admin" },
  pibBuilder: { view: "editor", draft: "editor", approve: "admin", administer: "admin" },
  searchIntelligence: { view: "editor", draft: "editor", approve: "editor", administer: "admin" },
  gbpPosts: { view: "editor", draft: "editor", approve: "editor", administer: "admin" },
  gscReport: { view: "editor" },
  intelligenceOffice: { view: "admin", draft: "admin", approve: "admin", administer: "admin" },
  siteContent: { view: "admin", draft: "admin", approve: "admin", administer: "admin" },
  vacs: { view: "editor", draft: "editor", approve: "editor", administer: "admin" },
  evs: { view: "editor", draft: "editor", handoff: "editor", administer: "admin" },
  controlPlane: { view: "admin", administer: "admin" },
  backup: { view: "editor", draft: "editor", administer: "admin" },
  adminUsers: { view: "admin", administer: "admin" },
};

const EDITOR_ALLOWED_OFFERINGS = new Set<OfferingId>([
  "pond",
  "popBrief",
]);

function hasRole(userRole: Role | undefined, minimumRole: Role): boolean {
  return !!userRole && ROLE_LEVEL[userRole] >= ROLE_LEVEL[minimumRole];
}

export function getOfferingActionRole(offeringId: OfferingId, action: OfferingAction): Role {
  return OFFERING_ACTION_REQUIREMENTS[offeringId]?.[action] ?? OFFERING_ACTION_REQUIREMENTS[offeringId]?.view ?? "viewer";
}

export function canPerformOfferingAction(userRole: Role | undefined, offeringId: OfferingId, action: OfferingAction): boolean {
  if (userRole === "editor" && !EDITOR_ALLOWED_OFFERINGS.has(offeringId)) {
    return false;
  }
  return hasRole(userRole, getOfferingActionRole(offeringId, action));
}

export function requireOfferingAction(offeringId: OfferingId, action: OfferingAction) {
  return async (c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) => {
    const user = c.get("user");
    if (!canPerformOfferingAction(user?.role, offeringId, action)) {
      const requiredRole = getOfferingActionRole(offeringId, action);
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: `Requires ${requiredRole} role for ${offeringId}:${action}`,
            details: [],
          },
        },
        403
      );
    }
    await next();
  };
}
