import { createTestD1Database } from "../test/helpers/sqlite-d1";
import { runSyntheticCloudflareShadowSmoke } from "../src/platform/model-gateway/smoke";

async function main() {
  const { db, close } = await createTestD1Database();
  try {
    const result = await runSyntheticCloudflareShadowSmoke(db, process.env as Record<string, string | undefined>);
    console.log(JSON.stringify({
      attempted: result.attempted,
      calledCloudflare: result.calledCloudflare,
      acceptedOutputSource: result.acceptedOutputSource,
      fallbackUsed: result.fallbackUsed,
      reason: result.reason,
      skipReason: result.skipReason,
      gatewayRequestId: result.gatewayRequestId,
      shadowResultCount: result.shadowResultCount,
    }, null, 2));
  } finally {
    close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Cloudflare shadow smoke failed.";
  console.error(JSON.stringify({ attempted: true, calledCloudflare: false, error: message }, null, 2));
  process.exit(1);
});
