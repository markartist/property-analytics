import { generateKeyPairSync, sign } from "node:crypto";

function base64UrlEncode(input: Buffer | string) {
  const value = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function buildCloudflareAccessJwt(options: {
  teamDomain: string;
  aud?: string | string[];
  clientId?: string;
  commonName?: string;
  email?: string;
  kid?: string;
  expiresInSeconds?: number;
}) {
  const kid = options.kid ?? "test-access-kid";
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  const header = {
    alg: "RS256",
    typ: "JWT",
    kid,
  };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    type: "app",
    iss: options.teamDomain,
    iat: now,
    exp: now + (options.expiresInSeconds ?? 300),
    ...(options.aud ? { aud: options.aud } : {}),
    common_name: options.commonName ?? options.clientId ?? "",
    ...(options.email ? { email: options.email } : {}),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), privateKey);

  const jwk = publicKey.export({ format: "jwk" }) as JsonWebKey;
  jwk.kid = kid;
  jwk.alg = "RS256";
  jwk.use = "sig";

  return {
    token: `${signingInput}.${base64UrlEncode(signature)}`,
    jwk,
  };
}
