interface Env {
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  EMAIL_FROM_NAME?: string;
  ENABLE_EMAIL_SEND?: string;
}

type JourneyPrayer = {
  stepLabel: string;
  stepTitle: string;
  promptTitle: string;
  item: string;
  body: string;
};

const allowedOrigins = new Set([
  "https://steps.yournamehere.vip",
  "https://steps-freedom.pages.dev",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
]);

const ipLimiter = new Map<string, number[]>();
const recipientLimiter = new Map<string, number[]>();

function json(body: unknown, status = 200, origin?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function error(code: string, message: string, status: number, origin?: string) {
  return json({ error: { code, message, details: [] } }, status, origin);
}

function checkLimit(store: Map<string, number[]>, key: string, maxRequests: number, windowMs: number) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const current = (store.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
  if (current.length >= maxRequests) return false;
  current.push(now);
  store.set(key, current);
  return true;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paragraphs(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function normalizePrayer(value: unknown): JourneyPrayer | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const prayer = {
    stepLabel: cleanString(row.stepLabel, 80),
    stepTitle: cleanString(row.stepTitle, 180),
    promptTitle: cleanString(row.promptTitle, 220),
    item: cleanString(row.item, 1500),
    body: cleanString(row.body, 10000),
  };
  return Object.values(prayer).every(Boolean) ? prayer : null;
}

function buildJourneyHtml(prayers: JourneyPrayer[]) {
  if (!prayers.length) return "<p>No journey prayers are ready yet.</p>";
  return prayers
    .map(
      (prayer, index) => `
        <section style="border:1px solid #D6D6D2;border-radius:6px;margin:0 0 14px;padding:14px;">
          <div style="color:#3B9189;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(prayer.stepLabel)}: ${escapeHtml(prayer.stepTitle)}</div>
          <h2 style="color:#15284B;font-size:18px;margin:8px 0 4px;">${index + 1}. ${escapeHtml(prayer.promptTitle)}</h2>
          <p style="color:#294782;font-weight:700;margin:0 0 10px;">${escapeHtml(prayer.item)}</p>
          <p style="color:#15284B;font-size:16px;line-height:1.65;margin:0;">${paragraphs(prayer.body)}</p>
        </section>`,
    )
    .join("");
}

function buildEmailHtml(kind: "created" | "journey", worksheetText: string, prayers: JourneyPrayer[]) {
  const content =
    kind === "journey"
      ? buildJourneyHtml(prayers)
      : `<pre style="white-space:pre-wrap;color:#15284B;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;margin:0;">${escapeHtml(worksheetText)}</pre>`;

  return `
    <div style="background:#F6F6F5;margin:0;padding:24px 12px;">
      <div style="background:#FFFFFF;border:1px solid #D6D6D2;border-radius:8px;font-family:Arial,Helvetica,sans-serif;margin:0 auto;max-width:760px;padding:24px;">
        <div style="color:#3B9189;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Steps to Freedom in Christ</div>
        <h1 style="color:#15284B;font-size:28px;line-height:1.2;margin:8px 0 16px;">${kind === "journey" ? "Entire Journey Prayers and Declarations" : "Created Prayers and Worksheet"}</h1>
        <p style="color:#294782;font-size:14px;line-height:1.5;margin:0 0 20px;">Sent from steps.yournamehere.vip at the request of a participant. The app does not save this email content after sending.</p>
        ${content}
        <p style="border-top:1px solid #D6D6D2;color:#64748b;font-size:12px;line-height:1.5;margin:24px 0 0;padding-top:14px;">
          Hosted by yournamehere.vip. Guided from Steps to Freedom in Christ by Neil Anderson and Freedom in Christ Ministries.
        </p>
      </div>
    </div>`;
}

function buildText(worksheetText: string, prayers: JourneyPrayer[]) {
  if (worksheetText) return worksheetText;
  const lines = ["Steps to Freedom in Christ", "", "Entire journey prayers and declarations"];
  prayers.forEach((prayer, index) => {
    lines.push("", `${index + 1}. ${prayer.stepLabel}: ${prayer.stepTitle}`, prayer.promptTitle, prayer.item, prayer.body);
  });
  return lines.join("\n");
}

async function sendEmail(env: Env, to: string, subject: string, html: string, text: string) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM_NAME ? `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>` : env.EMAIL_FROM,
      to: [to],
      subject,
      html,
      text,
    }),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") ?? "";

    if (request.method === "OPTIONS") {
      return allowedOrigins.has(origin) ? json({ ok: true }, 200, origin) : error("FORBIDDEN_ORIGIN", "Origin is not allowed.", 403);
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/api/email") {
      return error("NOT_FOUND", "Route not found.", 404, allowedOrigins.has(origin) ? origin : undefined);
    }

    if (!allowedOrigins.has(origin)) {
      return error("FORBIDDEN_ORIGIN", "This email endpoint is only available from the Steps app.", 403);
    }

    const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkLimit(ipLimiter, ip, 3, 15 * 60 * 1000)) {
      return error("RATE_LIMITED", "Too many email sends from this connection. Try again later.", 429, origin);
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      return error("VALIDATION_ERROR", "Invalid JSON payload.", 400, origin);
    }

    const to = cleanString(payload.to, 254).toLowerCase();
    const kind = payload.kind === "journey" ? "journey" : payload.kind === "created" ? "created" : null;
    const worksheetText = cleanString(payload.worksheetText, 80000);
    const prayers = Array.isArray(payload.prayers) ? payload.prayers.slice(0, 300).map(normalizePrayer).filter((item): item is JourneyPrayer => Boolean(item)) : [];

    if (!isEmail(to)) return error("VALIDATION_ERROR", "Enter a valid recipient email address.", 400, origin);
    if (!kind) return error("VALIDATION_ERROR", "Email type is required.", 400, origin);
    if (!worksheetText && !prayers.length) return error("VALIDATION_ERROR", "Email content is required.", 400, origin);
    if (!checkLimit(recipientLimiter, to, 5, 60 * 60 * 1000)) {
      return error("RATE_LIMITED", "Too many emails to this recipient. Try again later.", 429, origin);
    }
    if ((env.ENABLE_EMAIL_SEND ?? "").toLowerCase() !== "true") {
      return error("EMAIL_DISABLED", "Email sending is not enabled.", 503, origin);
    }
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      return error("EMAIL_CREDENTIALS_MISSING", "Email credentials are not configured.", 503, origin);
    }

    const subject = kind === "journey" ? "Steps to Freedom in Christ journey prayers" : "Steps to Freedom in Christ prayers";
    const response = await sendEmail(env, to, subject, buildEmailHtml(kind, worksheetText, prayers), buildText(worksheetText, prayers));

    if (!response.ok) {
      console.error("[STEPS_EMAIL_FAIL]", { status: response.status });
      return error("EMAIL_SEND_FAILED", "The email could not be sent.", 502, origin);
    }

    return json({ ok: true }, 200, origin);
  },
};
