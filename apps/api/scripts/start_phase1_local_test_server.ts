import { createTestD1Database } from "../test/helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../test/helpers/platform-route-env";
import { startPlatformHttpServer } from "../test/helpers/platform-http-server";
import { seedPhase1PlatformBasics } from "../test/helpers/platform-seeds";

async function main() {
  const port = Number(process.env.PORT ?? "8788");
  const host = process.env.HOST ?? "127.0.0.1";

  const { db, close } = await createTestD1Database();
  await seedPhase1PlatformBasics(db);
  const env = createPlatformRouteEnv(db);
  const server = await startPlatformHttpServer(env, { port, host });

  console.log(
    JSON.stringify({
      message: "phase1_local_test_server_started",
      baseUrl: server.baseUrl,
      platformSharedToken: env.PLATFORM_SHARED_TOKEN,
    })
  );

  const shutdown = async () => {
    await server.close();
    close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      message: "phase1_local_test_server_failed",
      error: error instanceof Error ? error.message : String(error),
    })
  );
  process.exit(1);
});
