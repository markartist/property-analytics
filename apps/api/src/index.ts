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
import { createLeasingMetricsRouter } from "./routes/leasing-metrics";
import { marketingData } from "./routes/marketing-data";
import { pib } from "./routes/pib";
import { pond } from "./routes/pond";
import { health } from "./routes/health";
import { fish } from "./routes/fish";
import { gsc } from "./routes/gsc";
import { platform } from "./routes/platform";
import { adminIntelligence } from "./routes/admin-intelligence";
import { adminSiteContent } from "./routes/admin-site-content";

// Phase 2 leasing funnel metric routers
const t7Metrics = createLeasingMetricsRouter("t7_metrics", "t7_metrics");
const t30Metrics = createLeasingMetricsRouter("t30_metrics", "t30_metrics");

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// CORS: allow frontend origin (app.venterradev.com)
app.use(
  "*",
  cors({
    origin: [
      "https://app.venterradev.com",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
    ],
    credentials: true,
  })
);

// Health check (public)
app.get("/health", (c) => c.json({ status: "ok", version: "1.0.0" }));

// Mount route groups under /v1
app.route("/v1/auth", auth);
app.route("/v1/admin", admin);
app.route("/v1/admin/intelligence", adminIntelligence);
app.route("/v1/admin/site-content", adminSiteContent);
app.route("/v1/communities", communities);
app.route("/v1/metrics", metrics);
app.route("/v1/marketing", marketing);
app.route("/v1/analysis", analysis);
app.route("/v1/exports", exports_);

// Phase 2: leasing funnel metrics + marketing data
app.route("/v1/t7-metrics", t7Metrics);
app.route("/v1/t30-metrics", t30Metrics);
app.route("/v1/marketing-data", marketingData);
app.route("/v1/pib", pib);
app.route("/v1/pond", pond);
app.route("/v1/health", health);
app.route("/v1/fish", fish);
app.route("/v1/gsc-snapshot", gsc);
app.route("/v1/platform", platform);

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
