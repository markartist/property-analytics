import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryAll, queryFirst } from "../lib/db";
import { isFriday, errJson } from "../lib/validate";

const analysis = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
analysis.use("*", requireAuth);

/**
 * GET /v1/analysis?community_id=&week_ending=
 * Returns composite payload: community, T7/T30 community+portfolio metrics, marketing.
 * Portfolio rows are stored explicitly per ADR-0004 — no rollup calculation.
 */
analysis.get("/", async (c) => {
  const { community_id, week_ending } = c.req.query();
  if (!week_ending) return c.json(errJson("VALIDATION_ERROR", "week_ending is required"), 400);
  if (!isFriday(week_ending)) return c.json(errJson("VALIDATION_ERROR", "week_ending must be a Friday (ADR-0002)"), 400);

  const db = c.env.POP_BRIEF_DB;

  // Community record (if community_id provided)
  let community = null;
  if (community_id) {
    community = await queryFirst(db,
      "SELECT id, name, external_key, region, status FROM communities WHERE id = ? AND deleted_at IS NULL",
      [community_id]
    );
  }

  // T7 community metrics
  const t7_community = community_id
    ? await queryFirst(db,
        "SELECT * FROM weekly_metrics WHERE metric_date = ? AND window_days = 7 AND type = 'community' AND community_id = ?",
        [week_ending, community_id])
    : null;

  // T7 portfolio metrics
  const t7_portfolio = await queryFirst(db,
    "SELECT * FROM weekly_metrics WHERE metric_date = ? AND window_days = 7 AND type = 'portfolio' AND community_id IS NULL",
    [week_ending]
  );

  // T30 community metrics
  const t30_community = community_id
    ? await queryFirst(db,
        "SELECT * FROM weekly_metrics WHERE metric_date = ? AND window_days = 30 AND type = 'community' AND community_id = ?",
        [week_ending, community_id])
    : null;

  // T30 portfolio metrics
  const t30_portfolio = await queryFirst(db,
    "SELECT * FROM weekly_metrics WHERE metric_date = ? AND window_days = 30 AND type = 'portfolio' AND community_id IS NULL",
    [week_ending]
  );

  // Marketing weekly
  const marketing = community_id
    ? await queryFirst(db,
        "SELECT * FROM marketing_weekly WHERE week_ending = ? AND community_id = ?",
        [week_ending, community_id])
    : null;

  // If no community_id, return all communities' data for this week
  let communities_list = null;
  if (!community_id) {
    communities_list = await queryAll(db,
      "SELECT * FROM weekly_metrics WHERE metric_date = ? AND type = 'community' ORDER BY community_id, window_days",
      [week_ending]
    );
  }

  return c.json({
    week_ending,
    community,
    metrics: {
      t7_community,
      t7_portfolio,
      t30_community,
      t30_portfolio,
    },
    marketing,
    communities: communities_list,
  });
});

export { analysis };
