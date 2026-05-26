export type ServiceAccessMode = "access_service_token" | "shared_token";
export type CloudflareAccessIdentity = {
  jwt: string;
  issuer: string;
  commonName: string | null;
  email: string | null;
};
export type CloudflareAccessVerificationResult =
  | "valid"
  | "missing_jwt"
  | "malformed_jwt"
  | "missing_kid"
  | "cert_lookup_failed"
  | "unknown_key_id"
  | "signature_invalid"
  | "token_not_yet_valid"
  | "token_expired"
  | "issuer_mismatch"
  | "audience_mismatch"
  | "email_mismatch"
  | "missing_email";

export type CloudflareAccessIdentityResolution = {
  identity: CloudflareAccessIdentity | null;
  hasJwt: boolean;
  hasHeader: boolean;
  verificationResult: CloudflareAccessVerificationResult;
  issExpected: string;
  issActual: string | null;
  audExpected: string[];
  audActual: string[];
};
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
  aud?: string | string[];
  common_name?: string;
  email?: string;
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

type AccessJwtValidation = {
  ok: boolean;
  verificationResult: Exclude<CloudflareAccessVerificationResult, "missing_jwt" | "email_mismatch" | "missing_email">;
  claims: AccessJwtClaims | null;
  expectedIssuer: string;
  actualIssuer: string | null;
  expectedAudience: string[];
  actualAudience: string[];
};

function normalizeAudience(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item)).filter(Boolean);
  }
  const single = normalize(value);
  return single ? [single] : [];
}

function normalizeExpectedAudiences(value?: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => normalize(item))
    .filter(Boolean);
}

async function validateAccessJwtAssertion(
  token: string,
  accessTeamDomain?: string | null,
  accessAud?: string | null
): Promise<AccessJwtValidation> {
  const teamDomain = normalizeTeamDomain(accessTeamDomain);
  const expectedAudience = normalizeExpectedAudiences(accessAud);
  const parts = token.split(".");
  if (parts.length !== 3) {
    return {
      ok: false,
      verificationResult: "malformed_jwt",
      claims: null,
      expectedIssuer: teamDomain,
      actualIssuer: null,
      expectedAudience,
      actualAudience: [],
    };
  }

  const header = parseJwtPart<AccessJwtHeader>(parts[0]);
  const claims = parseJwtPart<AccessJwtClaims>(parts[1]);
  if (!header || !claims || header.alg !== "RS256") {
    return {
      ok: false,
      verificationResult: "malformed_jwt",
      claims,
      expectedIssuer: teamDomain,
      actualIssuer: claims?.iss ?? null,
      expectedAudience,
      actualAudience: normalizeAudience(claims?.aud),
    };
  }
  if (!header.kid) {
    return {
      ok: false,
      verificationResult: "missing_kid",
      claims,
      expectedIssuer: teamDomain,
      actualIssuer: claims.iss ?? null,
      expectedAudience,
      actualAudience: normalizeAudience(claims.aud),
    };
  }

  let certs: Map<string, JsonWebKey>;
  try {
    certs = await loadAccessCerts(teamDomain);
  } catch {
    return {
      ok: false,
      verificationResult: "cert_lookup_failed",
      claims,
      expectedIssuer: teamDomain,
      actualIssuer: claims.iss ?? null,
      expectedAudience,
      actualAudience: normalizeAudience(claims.aud),
    };
  }
  const jwk = certs.get(header.kid);
  if (!jwk) {
    return {
      ok: false,
      verificationResult: "unknown_key_id",
      claims,
      expectedIssuer: teamDomain,
      actualIssuer: claims.iss ?? null,
      expectedAudience,
      actualAudience: normalizeAudience(claims.aud),
    };
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
    return {
      ok: false,
      verificationResult: "signature_invalid",
      claims,
      expectedIssuer: teamDomain,
      actualIssuer: claims.iss ?? null,
      expectedAudience,
      actualAudience: normalizeAudience(claims.aud),
    };
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.nbf && now < claims.nbf) {
    return {
      ok: false,
      verificationResult: "token_not_yet_valid",
      claims,
      expectedIssuer: teamDomain,
      actualIssuer: claims.iss ?? null,
      expectedAudience,
      actualAudience: normalizeAudience(claims.aud),
    };
  }
  if (claims.exp && now >= claims.exp) {
    return {
      ok: false,
      verificationResult: "token_expired",
      claims,
      expectedIssuer: teamDomain,
      actualIssuer: claims.iss ?? null,
      expectedAudience,
      actualAudience: normalizeAudience(claims.aud),
    };
  }

  if (claims.iss !== teamDomain) {
    return {
      ok: false,
      verificationResult: "issuer_mismatch",
      claims,
      expectedIssuer: teamDomain,
      actualIssuer: claims.iss ?? null,
      expectedAudience,
      actualAudience: normalizeAudience(claims.aud),
    };
  }

  const actualAudience = normalizeAudience(claims.aud);
  if (expectedAudience.length > 0 && !expectedAudience.some((aud) => actualAudience.includes(aud))) {
    return {
      ok: false,
      verificationResult: "audience_mismatch",
      claims,
      expectedIssuer: teamDomain,
      actualIssuer: claims.iss ?? null,
      expectedAudience,
      actualAudience,
    };
  }

  return {
    ok: true,
    verificationResult: "valid",
    claims,
    expectedIssuer: teamDomain,
    actualIssuer: claims.iss ?? null,
    expectedAudience,
    actualAudience,
  };
}

export async function resolveCloudflareAccessIdentity(
  headers: HeadersLike,
  accessTeamDomain?: string | null,
  accessAud?: string | null
): Promise<CloudflareAccessIdentityResolution> {
  const headerEmail = normalize(headers.get("cf-access-authenticated-user-email"));
  const token = cloudflareAccessJwtFromHeaders(headers);
  const hasHeader = Boolean(headerEmail);
  if (!token) {
    const resolution = {
      identity: null,
      hasJwt: false,
      hasHeader,
      verificationResult: "missing_jwt" as const,
      issExpected: normalizeTeamDomain(accessTeamDomain),
      issActual: null,
      audExpected: normalizeExpectedAudiences(accessAud),
      audActual: [],
    };
    if (hasHeader) {
      console.warn("[AUTH_CF_ACCESS]", resolution);
    }
    return resolution;
  }

  const validation = await validateAccessJwtAssertion(token, accessTeamDomain, accessAud);
  if (!validation.ok) {
    const resolution = {
      identity: null,
      hasJwt: true,
      hasHeader,
      verificationResult: validation.verificationResult,
      issExpected: validation.expectedIssuer,
      issActual: validation.actualIssuer,
      audExpected: validation.expectedAudience,
      audActual: validation.actualAudience,
    };
    console.warn("[AUTH_CF_ACCESS]", resolution);
    return resolution;
  }

  const claims = validation.claims;
  const claimEmail = normalize(claims?.email);
  const commonName = normalize(claims?.common_name);
  const commonNameEmail = commonName.includes("@") ? commonName : "";
  const resolvedEmail = (claimEmail || commonNameEmail || headerEmail).toLowerCase();

  if (headerEmail && resolvedEmail && headerEmail.toLowerCase() !== resolvedEmail) {
    const resolution = {
      identity: null,
      hasJwt: true,
      hasHeader,
      verificationResult: "email_mismatch" as const,
      issExpected: validation.expectedIssuer,
      issActual: validation.actualIssuer,
      audExpected: validation.expectedAudience,
      audActual: validation.actualAudience,
    };
    console.warn("[AUTH_CF_ACCESS]", resolution);
    return resolution;
  }

  if (!resolvedEmail) {
    const resolution = {
      identity: null,
      hasJwt: true,
      hasHeader,
      verificationResult: "missing_email" as const,
      issExpected: validation.expectedIssuer,
      issActual: validation.actualIssuer,
      audExpected: validation.expectedAudience,
      audActual: validation.actualAudience,
    };
    console.warn("[AUTH_CF_ACCESS]", resolution);
    return resolution;
  }

  if (!token) {
    return {
      identity: null,
      hasJwt: false,
      hasHeader,
      verificationResult: "missing_jwt",
      issExpected: normalizeTeamDomain(accessTeamDomain),
      issActual: null,
      audExpected: normalizeExpectedAudiences(accessAud),
      audActual: [],
    };
  }

  return {
    identity: {
      jwt: token,
      issuer: claims?.iss ?? normalizeTeamDomain(accessTeamDomain),
      commonName: commonName || null,
      email: resolvedEmail,
    },
    hasJwt: true,
    hasHeader,
    verificationResult: "valid",
    issExpected: validation.expectedIssuer,
    issActual: validation.actualIssuer,
    audExpected: validation.expectedAudience,
    audActual: validation.actualAudience,
  };
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
  const accessValidation = accessJwt
    ? await validateAccessJwtAssertion(accessJwt, options.accessTeamDomain)
    : null;
  if (
    expectedClientId &&
    expectedClientSecret &&
    accessValidation?.ok &&
    accessValidation.claims?.common_name === expectedClientId
  ) {
    return "access_service_token";
  }

  const sharedToken = normalize(options.sharedToken);
  if (sharedToken && bearerFromHeaders(headers) === sharedToken) {
    return "shared_token";
  }

  return null;
}
