/**
 * The Fishing Hole — AI Chat powered by OpenAI (GPT-4o)
 *
 * Endpoints:
 *   POST /cast         — Submit a question, receive SSE stream of events
 *   GET  /export/:key  — Download a generated CSV export
 */

import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryAll, queryFirst, run } from "../lib/db";

const fish = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
fish.use("*", requireAuth);

// ── D1 Schema (included in system prompt) ───────────────────────────────────

const D1_SCHEMA = `
-- Database: Venterra Property Analytics (D1 / SQLite)
-- Data is snapshotted weekly on Fridays.
-- ~91 communities (apartment properties) tracked.

CREATE TABLE communities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  manager_name TEXT,
  unit_count INTEGER,
  ga4_property_id TEXT,
  full_url TEXT,
  city TEXT,
  state TEXT
);

CREATE TABLE pib_ga4_metrics (
  community_id TEXT REFERENCES communities(id),
  snapshot_date TEXT,  -- YYYY-MM-DD Friday
  total_sessions INTEGER, total_users INTEGER, new_users INTEGER,
  avg_session_duration REAL,
  organic_sessions INTEGER, direct_sessions INTEGER, paid_sessions INTEGER,
  referral_sessions INTEGER, social_sessions INTEGER,
  desktop_sessions INTEGER, mobile_sessions INTEGER, tablet_sessions INTEGER,
  tour_clicks INTEGER, phone_calls INTEGER, apply_clicks INTEGER,
  price_quotes INTEGER, form_starts INTEGER, form_submits INTEGER,
  sessions_trend_pct REAL, users_trend_pct REAL,
  UNIQUE(community_id, snapshot_date)
);

CREATE TABLE pib_site_performance (
  community_id TEXT REFERENCES communities(id),
  snapshot_date TEXT,
  mobile_score INTEGER, desktop_score INTEGER,
  mobile_lcp REAL, mobile_cls REAL, mobile_fid REAL, mobile_fcp REAL,
  desktop_lcp REAL, desktop_cls REAL, desktop_fid REAL, desktop_fcp REAL,
  UNIQUE(community_id, snapshot_date)
);

CREATE TABLE pib_local_presence (
  community_id TEXT REFERENCES communities(id),
  snapshot_date TEXT,
  total_profile_views INTEGER, maps_views INTEGER, search_views INTEGER,
  website_clicks INTEGER, phone_calls INTEGER, direction_requests INTEGER,
  action_rate REAL, views_trend_pct REAL, actions_trend_pct REAL,
  UNIQUE(community_id, snapshot_date)
);

CREATE TABLE pib_search_performance (
  community_id TEXT REFERENCES communities(id),
  snapshot_date TEXT,
  total_clicks INTEGER, total_impressions INTEGER,
  avg_ctr REAL, avg_position REAL,
  top_keywords_json TEXT,  -- JSON: [{query, clicks, impressions, ctr, position}]
  UNIQUE(community_id, snapshot_date)
);

CREATE TABLE pib_cir (
  community_id TEXT REFERENCES communities(id),
  snapshot_date TEXT,
  total_sessions INTEGER, intent_events INTEGER,
  cir_value REAL, cir_status TEXT,  -- 'strong'|'moderate'|'low'|'critical'
  prior_cir_value REAL, cir_trend_pct REAL,
  -- CIR = Customer Intent Rate (intent_events / total_sessions)
  UNIQUE(community_id, snapshot_date)
);

CREATE TABLE pib_reviews (
  community_id TEXT REFERENCES communities(id),
  snapshot_date TEXT,
  total_reviews INTEGER, avg_rating REAL,
  five_star_count INTEGER, one_star_count INTEGER,
  recent_30d_count INTEGER, avg_rating_trend REAL, sentiment_score REAL,
  themes_json TEXT, critical_reviews_json TEXT,
  UNIQUE(community_id, snapshot_date)
);

CREATE TABLE marketing_data (
  community_id TEXT REFERENCES communities(id),
  week_date TEXT,  -- YYYY-MM-DD Friday
  monthly_budget REAL, google_ppc REAL, google_remarketing REAL,
  apartments_com REAL, social REAL, zillow REAL, mailers REAL,
  kurie_video REAL, other REAL,
  occupancy REAL, atr REAL,
  t7_community_gc_per_door REAL, t7_community_gc_per_avail_door REAL,
  t7_portfolio_gc_per_door REAL, t7_portfolio_gc_per_avail_door REAL,
  t30_community_gc_per_door REAL, t30_community_gc_per_avail_door REAL,
  t30_portfolio_gc_per_door REAL, t30_portfolio_gc_per_avail_door REAL,
  google_review_count INTEGER, google_review_score REAL,
  UNIQUE(community_id, week_date)
);

CREATE TABLE t7_metrics (
  community_id TEXT REFERENCES communities(id),
  week_date TEXT, type TEXT,  -- 'community' or 'portfolio'
  g_cards INTEGER, visits INTEGER, first_tours INTEGER,
  apps INTEGER, leases INTEGER, c_and_ds INTEGER, move_ins INTEGER,
  v_gc_conv REAL, a_gc_conv REAL, l_gc_conv REAL, l_v_ratio REAL,
  c_d_pct_of_gcs REAL, mi_gc_conv REAL, mi_v_ratio REAL,
  g_cards_delta REAL, visits_delta REAL, apps_delta REAL,
  leases_delta REAL, c_and_ds_delta REAL, move_ins_delta REAL,
  v_gc_conv_delta REAL, a_gc_conv_delta REAL, l_gc_conv_delta REAL,
  UNIQUE(community_id, week_date, type)
);

CREATE TABLE t30_metrics (
  -- Same schema as t7_metrics but 30-day window
  community_id TEXT, week_date TEXT, type TEXT,
  g_cards INTEGER, visits INTEGER, first_tours INTEGER,
  apps INTEGER, leases INTEGER, c_and_ds INTEGER, move_ins INTEGER,
  v_gc_conv REAL, a_gc_conv REAL, l_gc_conv REAL, l_v_ratio REAL,
  c_d_pct_of_gcs REAL, mi_gc_conv REAL, mi_v_ratio REAL,
  g_cards_delta REAL, visits_delta REAL, apps_delta REAL,
  leases_delta REAL, c_and_ds_delta REAL, move_ins_delta REAL,
  v_gc_conv_delta REAL, a_gc_conv_delta REAL, l_gc_conv_delta REAL,
  UNIQUE(community_id, week_date, type)
);
`.trim();

// ── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Fishing Hole Guide — an AI analytics assistant exclusively for Venterra Properties.
You help users explore analytics data for ~91 apartment communities in the Venterra portfolio.

You have access to a D1 (SQLite) database with the following schema:

${D1_SCHEMA}

SCOPE — CRITICAL:
You ONLY answer questions related to Venterra property analytics. This includes:
- Property performance metrics (traffic, sessions, conversions, engagement)
- Marketing data (ad spend, budgets, occupancy, ATR)
- Site performance (PageSpeed, Core Web Vitals, LCP, CLS, FID)
- SEO and search performance (clicks, impressions, CTR, rankings, keywords)
- Google Business Profile / local presence (views, actions, direction requests)
- Customer Intent Rate (CIR) analysis
- Reviews and reputation (ratings, sentiment, themes)
- Leasing funnel metrics (guest cards, visits, tours, applications, leases, move-ins)
- Property comparisons, trends, portfolio summaries, and data exports

If a user asks anything outside this scope — general knowledge, coding help, personal questions, news, math problems, creative writing, or ANY topic not directly about Venterra property data — politely decline and redirect:
"I'm the Fishing Hole Guide, and I only have access to Venterra property analytics data. Try rephrasing your question around property performance, marketing, SEO, or leasing metrics and I'll be happy to help!"

Do NOT answer off-topic questions even if the user insists. Do NOT provide general advice, opinions, or information unrelated to the Venterra portfolio data in this database.

RULES:
1. Always use the query_pond tool to look up data — never guess or make up numbers.
2. When querying, JOIN with the communities table to get property names.
3. To find the latest snapshot date, query MAX(snapshot_date) from pib_ga4_metrics or MAX(week_date) from the relevant table.
4. For per-property leasing data on t7/t30 tables, filter type = 'community'. The type = 'portfolio' row is the aggregate.
5. Format numbers clearly: percentages with 1 decimal, currency with $ and commas, large numbers with commas.
6. Keep responses concise but insightful — highlight notable findings, outliers, and actionable patterns.
7. If the user asks for a download/export/CSV, use generate_csv after getting the data.
8. When comparing properties, include both values and context (portfolio average, trend direction).
9. Use snapshot_date for PIB tables, week_date for marketing_data, t7_metrics, and t30_metrics.
10. If a query fails or returns no data, explain what happened and suggest alternatives.
11. If a user asks to open PIB in the app UI, provide a direct link to /pib instead of generating custom PIB output.
    - Use this format: [Open PIB](/pib)

PERSONALITY:
You're a friendly, knowledgeable guide at The Data Pond resort. Keep fishing metaphors light and occasional — focus on delivering clear, accurate analytics insights.`;

// ── Tool definitions (OpenAI function-calling format) ────────────────────────

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "query_pond",
      description:
        "Execute a read-only SQL query against the Venterra analytics database. Only SELECT statements allowed. Always JOIN with communities to get property names. Use snapshot_date or week_date for date filtering.",
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string", description: "A SELECT SQL query." },
          explanation: { type: "string", description: "Brief explanation of what this query does." },
        },
        required: ["sql", "explanation"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_property_detail",
      description: "Look up a specific property by name (fuzzy match) and return its latest PIB data across all tables.",
      parameters: {
        type: "object",
        properties: {
          property_name: { type: "string", description: "Property name or partial name to search for." },
        },
        required: ["property_name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_portfolio_summary",
      description: "Get a high-level portfolio summary with latest metrics across all properties.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_csv",
      description:
        "Convert tabular data to a CSV file for download. Use after query_pond when the user wants an export.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Name for the CSV (without extension)." },
          columns: { type: "array", items: { type: "string" }, description: "Column headers." },
          rows: {
            type: "array",
            items: { type: "array", items: { type: "string" } },
            description: "Array of row arrays.",
          },
        },
        required: ["filename", "columns", "rows"],
      },
    },
  },
];

// ── SQL validation ──────────────────────────────────────────────────────────

function validateSQL(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim().toUpperCase();

  if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
    return { valid: false, error: "Only SELECT queries are allowed." };
  }

  const blocked = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE",
    "TRUNCATE", "REPLACE", "ATTACH", "DETACH", "PRAGMA",
  ];
  for (const kw of blocked) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(sql)) {
      return { valid: false, error: `Blocked keyword detected: ${kw}` };
    }
  }

  return { valid: true };
}

// ── Tool execution ──────────────────────────────────────────────────────────

interface SSEEvent {
  type: "thinking" | "tool" | "text" | "table" | "csv" | "done" | "error";
  data: unknown;
}

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  db: D1Database,
  r2: R2Bucket,
): Promise<{ result: unknown; events: SSEEvent[] }> {
  const events: SSEEvent[] = [];

  switch (toolName) {
    case "query_pond": {
      const sql = toolInput.sql as string;
      const explanation = toolInput.explanation as string;
      events.push({ type: "tool", data: { tool: "query_pond", status: "running", explanation } });

      const check = validateSQL(sql);
      if (!check.valid) {
        return { result: { error: check.error, rows: [] }, events };
      }

      try {
        const rows = await queryAll(db, sql);
        const capped = rows.slice(0, 200);
        events.push({ type: "table", data: { rows: capped, total: rows.length, capped: rows.length > 200 } });
        return {
          result: {
            rows: capped,
            row_count: rows.length,
            capped: rows.length > 200,
            note: rows.length > 200 ? "Results capped at 200 rows. Use generate_csv for full export." : undefined,
          },
          events,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Query execution failed";
        return { result: { error: msg, rows: [] }, events };
      }
    }

    case "get_property_detail": {
      const name = toolInput.property_name as string;
      events.push({ type: "tool", data: { tool: "get_property_detail", status: "running", property: name } });

      const community = await queryFirst<{
        id: string; name: string; city: string; state: string;
        manager_name: string; unit_count: number; full_url: string;
      }>(
        db,
        `SELECT id, name, city, state, manager_name, unit_count, full_url
         FROM communities WHERE name LIKE ? AND deleted_at IS NULL LIMIT 1`,
        [`%${name}%`],
      );

      if (!community) {
        // Try harder — case-insensitive match on individual words
        const words = name.split(/\s+/).filter(Boolean);
        let found = null;
        for (const word of words) {
          found = await queryFirst<{ id: string; name: string; city: string; state: string; manager_name: string; unit_count: number; full_url: string }>(
            db,
            `SELECT id, name, city, state, manager_name, unit_count, full_url
             FROM communities WHERE LOWER(name) LIKE ? AND deleted_at IS NULL LIMIT 1`,
            [`%${word.toLowerCase()}%`],
          );
          if (found) break;
        }
        if (!found) {
          return { result: { error: `No property found matching "${name}"` }, events };
        }
        return await fetchPropertyDetail(found, db, events);
      }

      return await fetchPropertyDetail(community, db, events);
    }

    case "get_portfolio_summary": {
      events.push({ type: "tool", data: { tool: "get_portfolio_summary", status: "running" } });

      const latest = await queryFirst<{ d: string }>(db, `SELECT MAX(snapshot_date) as d FROM pib_ga4_metrics`);
      const sd = latest?.d;
      if (!sd) return { result: { error: "No data available" }, events };

      const summary = await queryFirst(db, `
        SELECT
          '${sd}' as snapshot_date,
          COUNT(DISTINCT g.community_id) as total_communities,
          SUM(g.total_sessions) as total_sessions,
          AVG(g.sessions_trend_pct) as avg_session_trend,
          AVG(cir.cir_value) as avg_cir,
          AVG(sp.mobile_score) as avg_mobile_score,
          AVG(rv.avg_rating) as avg_review_rating,
          SUM(COALESCE(md.google_ppc,0) + COALESCE(md.google_remarketing,0)) as total_ad_spend,
          AVG(md.occupancy) as avg_occupancy
        FROM pib_ga4_metrics g
        LEFT JOIN pib_cir cir ON cir.community_id = g.community_id AND cir.snapshot_date = g.snapshot_date
        LEFT JOIN pib_site_performance sp ON sp.community_id = g.community_id AND sp.snapshot_date = g.snapshot_date
        LEFT JOIN pib_reviews rv ON rv.community_id = g.community_id AND rv.snapshot_date = g.snapshot_date
        LEFT JOIN marketing_data md ON md.community_id = g.community_id AND md.week_date = g.snapshot_date
        WHERE g.snapshot_date = ?
      `, [sd]);

      return { result: summary ?? { error: "No summary data" }, events };
    }

    case "generate_csv": {
      const filename = toolInput.filename as string;
      const columns = toolInput.columns as string[];
      const rows = toolInput.rows as string[][];
      events.push({ type: "tool", data: { tool: "generate_csv", status: "running", filename } });

      const esc = (v: unknown) => {
        if (v == null) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
      };

      const lines = [columns.map(esc).join(",")];
      for (const row of rows) lines.push(row.map(esc).join(","));
      const csv = lines.join("\n");

      const key = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`;
      await r2.put(`exports/${key}`, csv, { httpMetadata: { contentType: "text/csv" } });

      events.push({ type: "csv", data: { key, filename: `${filename}.csv`, row_count: rows.length } });
      return { result: { stored: true, key, row_count: rows.length }, events };
    }

    default:
      return { result: { error: `Unknown tool: ${toolName}` }, events: [] };
  }
}

/** Fetch all PIB data for a matched community. */
async function fetchPropertyDetail(
  community: { id: string; name: string; city: string; state: string; manager_name: string; unit_count: number; full_url: string },
  db: D1Database,
  events: SSEEvent[],
) {
  const latest = await queryFirst<{ d: string }>(db, `SELECT MAX(snapshot_date) as d FROM pib_ga4_metrics`);
  const sd = latest?.d;

  const [ga4, perf, local, search, cir, reviews, mkt] = await Promise.all([
    sd ? queryFirst(db, `SELECT * FROM pib_ga4_metrics WHERE community_id = ? AND snapshot_date = ?`, [community.id, sd]) : null,
    sd ? queryFirst(db, `SELECT * FROM pib_site_performance WHERE community_id = ? AND snapshot_date = ?`, [community.id, sd]) : null,
    sd ? queryFirst(db, `SELECT * FROM pib_local_presence WHERE community_id = ? AND snapshot_date = ?`, [community.id, sd]) : null,
    sd ? queryFirst(db, `SELECT * FROM pib_search_performance WHERE community_id = ? AND snapshot_date = ?`, [community.id, sd]) : null,
    sd ? queryFirst(db, `SELECT * FROM pib_cir WHERE community_id = ? AND snapshot_date = ?`, [community.id, sd]) : null,
    sd ? queryFirst(db, `SELECT * FROM pib_reviews WHERE community_id = ? AND snapshot_date = ?`, [community.id, sd]) : null,
    sd ? queryFirst(db, `SELECT * FROM marketing_data WHERE community_id = ? AND week_date = ?`, [community.id, sd]) : null,
  ]);

  return {
    result: { community, snapshot_date: sd, ga4, site_performance: perf, local_presence: local, search_performance: search, cir, reviews, marketing: mkt },
    events,
  };
}

// ── SSE encoding ────────────────────────────────────────────────────────────

function encodeSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

// ── OpenAI API types ────────────────────────────────────────────────────────

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatResponse {
  choices: {
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }[];
}

async function callOpenAI(
  apiKey: string,
  messages: ChatMessage[],
): Promise<{ content: string | null; tool_calls: ToolCall[]; finish_reason: string }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 4096,
      messages,
      tools: TOOLS,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${text}`);
  }

  const data = (await res.json()) as ChatResponse;
  const choice = data.choices[0];
  return {
    content: choice.message.content,
    tool_calls: choice.message.tool_calls ?? [],
    finish_reason: choice.finish_reason,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

/** Generate a short title from the first question. */
function titleFromQuestion(q: string): string {
  const clean = q.replace(/\n/g, " ").trim();
  return clean.length > 80 ? clean.slice(0, 77) + "..." : clean;
}

// ── POST /cast — Main chat endpoint ─────────────────────────────────────────

fish.post("/cast", async (c) => {
  const body = await c.req.json<{
    question: string;
    conversation_id?: string;
    history?: { role: string; content: string }[];
  }>();
  const question = body.question?.trim();

  if (!question) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Question is required", details: [] } }, 400);
  }

  const apiKey = c.env.OPENAI_API_KEY;
  if (!apiKey) {
    return c.json({ error: { code: "CONFIG_ERROR", message: "AI service not configured", details: [] } }, 503);
  }

  const db = c.env.POP_BRIEF_DB;
  const r2 = c.env.POP_BRIEF_UPLOADS;
  const user = c.get("user");
  const startTime = Date.now();

  // ── Resolve or create conversation ──
  let conversationId = body.conversation_id ?? null;

  if (conversationId) {
    // Verify it belongs to this user
    const existing = await queryFirst<{ id: string }>(db,
      `SELECT id FROM fish_conversations WHERE id = ? AND user_id = ?`,
      [conversationId, user.id],
    );
    if (!existing) conversationId = null; // fall through to create
  }

  if (!conversationId) {
    conversationId = uid();
    const ts = now();
    await run(db,
      `INSERT INTO fish_conversations (id, user_id, user_email, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [conversationId, user.id, user.email, titleFromQuestion(question), ts, ts],
    );
  } else {
    await run(db, `UPDATE fish_conversations SET updated_at = ? WHERE id = ?`, [now(), conversationId]);
  }

  // Save user message
  await run(db,
    `INSERT INTO fish_messages (id, conversation_id, role, content, created_at)
     VALUES (?, ?, 'user', ?, ?)`,
    [uid(), conversationId, question, now()],
  );

  // Build OpenAI messages — load history from DB if conversation exists
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  // Load prior messages from this conversation for context
  const priorMsgs = await queryAll<{ role: string; content: string }>(db,
    `SELECT role, content FROM fish_messages
     WHERE conversation_id = ? AND content IS NOT NULL
     ORDER BY created_at ASC`,
    [conversationId],
  );
  for (const msg of priorMsgs.slice(-20)) {
    messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
  }

  // SSE stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const write = async (event: SSEEvent) => {
    await writer.write(encoder.encode(encodeSSE(event)));
  };

  const process = async () => {
    // Collect data for persistence
    const allToolEvents: Record<string, unknown>[] = [];
    const allTables: Record<string, unknown>[] = [];
    const allCsvs: Record<string, unknown>[] = [];
    let finalText = "";

    try {
      // Send conversation_id first so frontend can track it
      await write({ type: "thinking", data: { message: "Casting into the data pond...", conversation_id: conversationId } });

      let convo = [...messages];
      let iterations = 0;
      const MAX_LOOPS = 8;

      while (iterations < MAX_LOOPS) {
        iterations++;
        const response = await callOpenAI(apiKey, convo);

        // If no tool calls, emit the final text and break
        if (response.tool_calls.length === 0 || response.finish_reason === "stop") {
          if (response.content) {
            finalText = response.content;
            await write({ type: "text", data: { content: response.content } });
          }
          break;
        }

        // Add assistant message (with tool_calls) to conversation
        convo.push({
          role: "assistant",
          content: response.content,
          tool_calls: response.tool_calls,
        });

        // Execute each tool and append results as tool messages
        for (const tc of response.tool_calls) {
          const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          const { result, events } = await executeTool(
            tc.function.name,
            args,
            db,
            r2,
          );

          for (const evt of events) {
            await write(evt);
            if (evt.type === "tool") allToolEvents.push(evt.data as Record<string, unknown>);
            if (evt.type === "table") allTables.push(evt.data as Record<string, unknown>);
            if (evt.type === "csv") allCsvs.push(evt.data as Record<string, unknown>);
          }

          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });

          // Audit log for each tool call
          const resultObj = result as Record<string, unknown>;
          await run(db,
            `INSERT INTO fish_audit_log (id, user_id, user_email, conversation_id, question, tool_name, tool_input_json, row_count, error, duration_ms, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uid(), user.id, user.email, conversationId, question,
              tc.function.name, tc.function.arguments,
              (resultObj.row_count as number) ?? null,
              (resultObj.error as string) ?? null,
              Date.now() - startTime, now(),
            ],
          );
        }

        await write({ type: "thinking", data: { message: "Analyzing the catch..." } });
      }

      if (iterations >= MAX_LOOPS) {
        finalText = "I hit the analysis depth limit. Try breaking your question into smaller parts for more detail.";
        await write({ type: "text", data: { content: finalText } });
      }

      // Save assistant message
      await run(db,
        `INSERT INTO fish_messages (id, conversation_id, role, content, tables_json, csvs_json, tool_events_json, created_at)
         VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?)`,
        [
          uid(), conversationId, finalText || null,
          allTables.length ? JSON.stringify(allTables) : null,
          allCsvs.length ? JSON.stringify(allCsvs) : null,
          allToolEvents.length ? JSON.stringify(allToolEvents) : null,
          now(),
        ],
      );

      await write({ type: "done", data: { conversation_id: conversationId } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      console.error("Fish error:", err);
      await write({ type: "error", data: { message: msg } });
    } finally {
      await writer.close();
    }
  };

  c.executionCtx.waitUntil(process());

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// ── GET /conversations — List user's conversations ──────────────────────────

fish.get("/conversations", async (c) => {
  const user = c.get("user");
  const db = c.env.POP_BRIEF_DB;

  const conversations = await queryAll<{
    id: string; title: string; created_at: string; updated_at: string; message_count: number;
  }>(db,
    `SELECT fc.id, fc.title, fc.created_at, fc.updated_at,
       (SELECT COUNT(*) FROM fish_messages fm WHERE fm.conversation_id = fc.id) as message_count
     FROM fish_conversations fc
     WHERE fc.user_id = ?
     ORDER BY fc.updated_at DESC
     LIMIT 50`,
    [user.id],
  );

  return c.json({ conversations });
});

// ── GET /conversations/:id/messages — Load conversation messages ────────────

fish.get("/conversations/:id/messages", async (c) => {
  const user = c.get("user");
  const db = c.env.POP_BRIEF_DB;
  const convId = c.req.param("id");

  // Verify ownership
  const conv = await queryFirst<{ id: string; title: string }>(db,
    `SELECT id, title FROM fish_conversations WHERE id = ? AND user_id = ?`,
    [convId, user.id],
  );
  if (!conv) {
    return c.json({ error: { code: "NOT_FOUND", message: "Conversation not found", details: [] } }, 404);
  }

  const messages = await queryAll<{
    id: string; role: string; content: string | null;
    tables_json: string | null; csvs_json: string | null; tool_events_json: string | null;
    created_at: string;
  }>(db,
    `SELECT id, role, content, tables_json, csvs_json, tool_events_json, created_at
     FROM fish_messages WHERE conversation_id = ? ORDER BY created_at ASC`,
    [convId],
  );

  // Parse JSON fields
  const parsed = messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content ?? "",
    tables: m.tables_json ? JSON.parse(m.tables_json) : [],
    csvs: m.csvs_json ? JSON.parse(m.csvs_json) : [],
    events: m.tool_events_json ? JSON.parse(m.tool_events_json) : [],
    created_at: m.created_at,
  }));

  return c.json({ conversation: conv, messages: parsed });
});

// ── DELETE /conversations/:id — Delete a conversation ───────────────────────

fish.delete("/conversations/:id", async (c) => {
  const user = c.get("user");
  const db = c.env.POP_BRIEF_DB;
  const convId = c.req.param("id");

  // Verify ownership
  const conv = await queryFirst<{ id: string }>(db,
    `SELECT id FROM fish_conversations WHERE id = ? AND user_id = ?`,
    [convId, user.id],
  );
  if (!conv) {
    return c.json({ error: { code: "NOT_FOUND", message: "Conversation not found", details: [] } }, 404);
  }

  // CASCADE should handle messages, but be explicit
  await run(db, `DELETE FROM fish_messages WHERE conversation_id = ?`, [convId]);
  await run(db, `DELETE FROM fish_conversations WHERE id = ?`, [convId]);

  return c.json({ deleted: true });
});

// ── GET /export/:key — CSV download ─────────────────────────────────────────

fish.get("/export/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const obj = await c.env.POP_BRIEF_UPLOADS.get(`exports/${key}`);

  if (!obj) {
    return c.json({ error: { code: "NOT_FOUND", message: "Export not found", details: [] } }, 404);
  }

  return new Response(obj.body, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${key}"`,
    },
  });
});

export { fish };
