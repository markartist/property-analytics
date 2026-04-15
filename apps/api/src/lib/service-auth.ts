export type ServiceAccessMode = "access_service_token" | "shared_token";
type AccessCertJwk = JsonWebKey & { kid?: string };

type HeadersLike = {
  get(name: string): string | null | undefined;
};

type ServiceAuthOptions = {
  sharedToken?: string | null;
  accessClientId?: string | null;
  accessClientSecret?: string | null;
  accessTeamDomain?: string | null;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function bearerFromHeaders(headers: HeadersLike): string {
  const authHeader = normalize(headers.get("authorization"));
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

function cloudflareAccessJwtFromHeaders(headers: HeadersLike): string {
  const assertionHeader = normalize(headers.get("cf-access-jwt-assertion"));
  if (assertionHeader) {
    return assertionHeader;
  }

  const cookieHeader = normalize(headers.get("cookie"));
  if (!cookieHeader) {
    return "";
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.split("=");
    if (normalize(rawName) === "CF_Authorization") {
      return normalize(rawValue.join("="));
    }
  }

  return "";
}

function normalizeTeamDomain(teamDomain?: string | null): string {
  const normalized = normalize(teamDomain);
  if (!normalized) {
    return "https://macxs.cloudflareaccess.com";
  }
  const withProtocol = /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
  return withProtocol.replace(/\/+$/, "");
}

function base64UrlToUint8Array(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

function parseJwtPart<T>(value: string): T | null {
  try {
    const bytes = base64UrlToUint8Array(value);
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

type AccessJwtHeader = {
  alg?: string;
  kid?: string;
};

type AccessJwtClaims = {
  iss?: string;
  exp?: number;
  nbf?: number;
  common_name?: string;
};

const accessCertCache = new Map<string, { expiresAt: number; keys: Map<string, JsonWebKey> }>();

async function loadAccessCerts(teamDomain: string): Promise<Map<string, JsonWebKey>> {
  const cached = accessCertCache.get(teamDomain);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }

  const response = await fetch(`${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) {
    throw new Error(`Cloudflare Access cert lookup failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { keys?: AccessCertJwk[] };
  const keys = new Map<string, JsonWebKey>();
  for (const key of payload.keys ?? []) {
    const kid = typeof key.kid === "string" ? key.kid : "";
    if (kid) {
      keys.set(kid, key);
    }
  }

  accessCertCache.set(teamDomain, {
    expiresAt: Date.now() + 5 * 60 * 1000,
    keys,
  });
  return keys;
}

async function validateAccessJwtAssertion(
  token: string,
  expectedClientId: string,
  accessTeamDomain?: string | null
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const header = parseJwtPart<AccessJwtHeader>(parts[0]);
  const claims = parseJwtPart<AccessJwtClaims>(parts[1]);
  if (!header || !claims || header.alg !== "RS256" || !header.kid) {
    return false;
  }

  const teamDomain = normalizeTeamDomain(accessTeamDomain);
  const certs = await loadAccessCerts(teamDomain);
  const jwk = certs.get(header.kid);
  if (!jwk) {
    return false;
  }

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    base64UrlToUint8Array(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!verified) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if ((claims.nbf && now < claims.nbf) || (claims.exp && now >= claims.exp)) {
    return false;
  }

  return claims.iss === teamDomain && claims.common_name === expectedClientId;
}

export function hasServiceAuthConfig(options: ServiceAuthOptions): boolean {
  return Boolean(
    normalize(options.sharedToken) ||
      (normalize(options.accessClientId) && normalize(options.accessClientSecret))
  );
}

export async function resolveServiceAccessMode(
  headers: HeadersLike,
  options: ServiceAuthOptions
): Promise<ServiceAccessMode | null> {
  const expectedClientId = normalize(options.accessClientId);
  const expectedClientSecret = normalize(options.accessClientSecret);
  const actualClientId = normalize(headers.get("cf-access-client-id"));
  const actualClientSecret = normalize(headers.get("cf-access-client-secret"));

  if (
    expectedClientId &&
    expectedClientSecret &&
    actualClientId === expectedClientId &&
    actualClientSecret === expectedClientSecret
  ) {
    return "access_service_token";
  }

  const accessJwt = cloudflareAccessJwtFromHeaders(headers);
  if (
    expectedClientId &&
    expectedClientSecret &&
    accessJwt &&
    (await validateAccessJwtAssertion(accessJwt, expectedClientId, options.accessTeamDomain))
  ) {
    return "access_service_token";
  }

  const sharedToken = normalize(options.sharedToken);
  if (sharedToken && bearerFromHeaders(headers) === sharedToken) {
    return "shared_token";
  }

  return null;
}
