const DEFAULT_FRONTEND_URL = "https://app.venterradev.com";
const KNOWN_FRONTEND_ORIGINS = new Set([
  DEFAULT_FRONTEND_URL,
  "https://app.venterraliving.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
]);

type RequestLike = {
  req: {
    url: string;
    header: (name: string) => string | undefined | null;
  };
};

function parseHostHeader(value?: string | null): URL | null {
  const normalized = (value ?? "").trim();
  if (!normalized) return null;
  try {
    return new URL(`http://${normalized}`);
  } catch {
    return null;
  }
}

function isLocalOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return (
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
      (parsed.port === "3000" || parsed.port === "3001")
    );
  } catch {
    return false;
  }
}

function requestLocalOrigin(c: RequestLike): string | null {
  const host = parseHostHeader(c.req.header("x-forwarded-host") ?? c.req.header("host"));
  if (host && (host.hostname === "localhost" || host.hostname === "127.0.0.1")) {
    const port = host.port === "3001" ? "3001" : "3000";
    return `http://${host.hostname}:${port}`;
  }

  try {
    const url = new URL(c.req.url);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      const port = url.port === "3001" ? "3001" : "3000";
      return `http://${url.hostname}:${port}`;
    }
  } catch {
    return null;
  }

  return null;
}

export function frontendUrl(c: RequestLike): string {
  const origin = c.req.header("origin");
  const referer = c.req.header("referer");

  for (const candidate of [origin, referer]) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (KNOWN_FRONTEND_ORIGINS.has(parsed.origin)) {
        return parsed.origin;
      }
      if (isLocalOrigin(parsed.origin)) {
        return parsed.origin;
      }
    } catch {
      // Ignore malformed header values.
    }
  }

  return requestLocalOrigin(c) ?? DEFAULT_FRONTEND_URL;
}

export function adminFrontendUrl(c: RequestLike): string {
  const resolved = frontendUrl(c);
  return resolved === "https://app.venterraliving.com" ? resolved : DEFAULT_FRONTEND_URL;
}

export function cookieDomainForFrontend(frontendOrigin: string): string | null {
  try {
    const hostname = new URL(frontendOrigin).hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1") return null;
    if (hostname === "app.venterradev.com") return ".venterradev.com";
    if (hostname === "app.venterraliving.com") return ".venterraliving.com";
  } catch {
    return null;
  }
  return null;
}

export function isLocalFrontendRequest(c: RequestLike): boolean {
  return cookieDomainForFrontend(frontendUrl(c)) === null;
}
