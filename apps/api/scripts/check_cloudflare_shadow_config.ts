import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { checkCloudflareShadowConfig } from "../src/platform/model-gateway/cloudflare-shadow-config";

const result = checkCloudflareShadowConfig(process.env as Record<string, string | undefined>);
const frontendExposure = scanFrontendExposure();
const output = {
  ...result,
  frontend_provider_access_absent: frontendExposure.exposed_keys.length === 0,
  frontend_exposed_key_names: frontendExposure.exposed_keys,
};

console.log(JSON.stringify(output, null, 2));

if (process.env.MODEL_GATEWAY_CONFIG_CHECK_STRICT === "true") {
  const failed = !output.shadow_provider_eligible || !output.frontend_provider_access_absent;
  process.exit(failed ? 1 : 0);
}

function scanFrontendExposure(): { exposed_keys: string[] } {
  const root = resolve(process.cwd(), "../..");
  const files = [
    resolve(root, "apps/web/src/lib/api.ts"),
    resolve(root, "apps/web/.env.production"),
  ];
  const keys = [
    "CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN",
    "CLOUDFLARE_AI_GATEWAY_BASE_URL",
    "CLOUDFLARE_AI_GATEWAY_MODEL",
    "CLOUDFLARE_AI_GATEWAY_DYNAMIC_ROUTE_NAME",
  ];
  const exposed = new Set<string>();
  for (const file of files) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const key of keys) {
      if (text.includes(key)) exposed.add(key);
    }
  }
  return { exposed_keys: [...exposed].sort() };
}
