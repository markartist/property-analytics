import type { Env } from "../../src/env";

export function createPlatformRouteEnv(db: D1Database): Env {
  return {
    POP_BRIEF_DB: db,
    POP_BRIEF_UPLOADS: {} as R2Bucket,
    RESEND_API_KEY: "test-resend",
    EMAIL_FROM: "test@example.com",
    SESSION_SIGNING_SECRET: "test-secret",
    ENABLE_EMAIL_SEND: "false",
    OPENAI_API_KEY: "test-openai",
    PLATFORM_SHARED_TOKEN: "test-platform-token",
    VACS_SHARED_TOKEN: "test-vacs-token",
    EVS_SHARED_TOKEN: "test-evs-token",
  };
}
