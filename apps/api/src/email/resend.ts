/**
 * Resend email adapter.
 * Per ADR-0001: SMTP cannot run in Workers; email uses HTTPS API provider.
 * This stub uses Resend's API via fetch.
 */

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: {
    filename: string;
    contentBase64: string;
    contentType?: string;
  }[];
}

interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via Resend HTTPS API.
 * Requires RESEND_API_KEY and EMAIL_FROM secrets in Worker env.
 */
export async function sendEmail(
  apiKey: string,
  from: string,
  params: SendEmailParams
): Promise<SendEmailResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        attachments: params.attachments?.map((a) => ({
          filename: a.filename,
          content: a.contentBase64,
          content_type: a.contentType,
        })),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend API error (${res.status}): ${body}` };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, messageId: data.id };
  } catch (err) {
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }
}
