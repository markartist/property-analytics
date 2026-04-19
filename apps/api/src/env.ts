/**
 * Cloudflare Worker environment bindings.
 * Per ADR-0001: D1 + R2 + Secrets.
 * Repo standard: Keeper is the intended source of truth for long-lived
 * secrets, then deployment injects the runtime values into Worker bindings.
 */
export interface Env {
  POP_BRIEF_DB: D1Database;
  POP_BRIEF_UPLOADS: R2Bucket;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  SEMRUSH_API_KEY: string;
  SESSION_SIGNING_SECRET: string;
  ENABLE_EMAIL_SEND: string; // "true" | "false" — feature flag for email delivery
  OPENAI_API_KEY: string; // OpenAI API key for The Fishing Hole
  EVS_SHARED_TOKEN?: string; // optional bearer token for workflow-to-EVS result ingestion
  PLATFORM_SHARED_TOKEN?: string; // optional bearer token for Phase 1 platform orchestration endpoints
  PLATFORM_ACCESS_CLIENT_ID?: string; // optional Cloudflare Access service-token client id for platform endpoints
  PLATFORM_ACCESS_CLIENT_SECRET?: string; // optional Cloudflare Access service-token client secret for platform endpoints
  VACS_ACCESS_CLIENT_ID?: string; // optional Cloudflare Access service-token client id for VACS endpoints
  VACS_ACCESS_CLIENT_SECRET?: string; // optional Cloudflare Access service-token client secret for VACS endpoints
  EVS_ACCESS_CLIENT_ID?: string; // optional Cloudflare Access service-token client id for EVS ingest endpoints
  EVS_ACCESS_CLIENT_SECRET?: string; // optional Cloudflare Access service-token client secret for EVS ingest endpoints
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string; // optional Cloudflare Access team domain used to validate JWT assertions at origin
  CLOUDFLARE_ACCESS_AUTO_PROVISION_ENABLED?: string; // optional toggle to let Access-approved browser identities become app users automatically
  CLOUDFLARE_ACCESS_DEFAULT_ROLE?: string; // optional default role for auto-provisioned browser identities
  CLOUDFLARE_ACCESS_ALLOWED_EMAILS?: string; // optional comma-separated allowlist for auto-provisioned browser identities
  CLOUDFLARE_ACCESS_ALLOWED_DOMAINS?: string; // optional comma-separated email-domain allowlist for auto-provisioned browser identities
  CLOUDFLARE_ACCESS_ADMIN_EMAILS?: string; // optional comma-separated Cloudflare Access emails that should auto-provision as admin
  CLOUDFLARE_ACCESS_EDITOR_EMAILS?: string; // optional comma-separated Cloudflare Access emails that should auto-provision as editor
}

/**
 * Authenticated user context injected by auth middleware.
 */
export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
}
