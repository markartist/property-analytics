/**
 * Cloudflare Worker environment bindings.
 * Per ADR-0001: D1 + R2 + Secrets.
 */
export interface Env {
  POP_BRIEF_DB: D1Database;
  POP_BRIEF_UPLOADS: R2Bucket;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  SESSION_SIGNING_SECRET: string;
  ENABLE_EMAIL_SEND: string; // "true" | "false" — feature flag for email delivery
  OPENAI_API_KEY: string; // OpenAI API key for The Fishing Hole
  VACS_SHARED_TOKEN?: string; // optional bearer token for service-to-service VACS context access
  EVS_SHARED_TOKEN?: string; // optional bearer token for workflow-to-EVS result ingestion
  PLATFORM_SHARED_TOKEN?: string; // optional bearer token for Phase 1 platform orchestration endpoints
}

/**
 * Authenticated user context injected by auth middleware.
 */
export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
}
