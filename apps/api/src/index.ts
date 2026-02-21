import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import type { AuthVariables } from "./middleware/auth";
import { auth } from "./routes/auth";
import { admin } from "./routes/admin";
import { communities } from "./routes/communities";
import { metrics } from "./routes/metrics";
import { marketing } from "./routes/marketing";
import { analysis } from "./routes/analysis";
import { exports_ } from "./routes/exports";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// CORS: allow frontend origin (app.venterradev.com)
app.use(
  "*",
  cors({
    origin: ["https://app.venterradev.com", "http://localhost:3000"],
    credentials: true,
  })
);

// Health check (public)
app.get("/health", (c) => c.json({ status: "ok", version: "1.0.0" }));

// Mount route groups under /v1
app.route("/v1/auth", auth);
app.route("/v1/admin", admin);
app.route("/v1/communities", communities);
app.route("/v1/metrics", metrics);
app.route("/v1/marketing", marketing);
app.route("/v1/analysis", analysis);
app.route("/v1/exports", exports_);

// 404 fallback
app.notFound((c) =>
  c.json({ error: { code: "NOT_FOUND", message: "Route not found", details: [] } }, 404)
);

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred", details: [] } },
    500
  );
});

export default app;
