import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXTRA_PATH_SEGMENTS = [
  "/Library/Frameworks/Python.framework/Versions/3.12/bin",
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
];

const MARKETINGOPS_HOME = "/Users/mark";
const MARKETINGOPS_USER = "mark";

const DEFAULT_MARKETINGOPS_ENV = {
  KSM_PROFILE: "marketingops",
  KSM_CLOUDFLARE_TOKEN_NOTATION: "keeper://sBtNdBG1I4n0mjvKcSC3MA/field/password",
  KSM_BROWSERSTACK_USERNAME_NOTATION: "keeper://y6GUrHJgXsSxybHruXcVWg/field/login",
  KSM_BROWSERSTACK_ACCESS_KEY_NOTATION: "keeper://y6GUrHJgXsSxybHruXcVWg/field/password",
  KSM_OPENAI_API_KEY_NOTATION: "keeper://fsL4Qd2Q_9CPadtyeBr7-Q/field/password",
  KSM_PAGESPEED_API_KEY_NOTATION: "keeper://XTQySA3sVMlwouNIWGCcCg/field/password",
  KSM_GTMETRIX_API_KEY_NOTATION: "keeper://lkluImtpQHpBWcldViKfiQ/field/password",
  KSM_SEMRUSH_API_KEY_NOTATION: "keeper://q1dizD20qVFSS1ZCYoRPEw/field/password",
  KSM_AHREFS_API_KEY_NOTATION: "keeper://xbIaayyCqMfrzVFjRei5hA/field/password",
  KSM_DATAFORSEO_LOGIN_NOTATION: "keeper://8xxZUZB5ISyM1BhBrnaI2w/field/login",
  KSM_DATAFORSEO_PASSWORD_NOTATION: "keeper://8xxZUZB5ISyM1BhBrnaI2w/field/password",
  KSM_APARTMENTIQ_API_KEY_NOTATION: "keeper://aRP2hTUWhLTCAn-ye7GJ_w/field/password",
  KSM_APARTMENTIQ_ACCOUNT_ID_NOTATION: "keeper://aRP2hTUWhLTCAn-ye7GJ_w/field/login",
  KSM_GOOGLE_ADS_CONFIG_UID: "ulYC1ol6Wg_5U2xvpM6sUw",
  KSM_GA4_SERVICE_ACCOUNT_UID: "mVZqo2oVSqfS6YDvBDer8g",
  KSM_GSC_CLIENT_SECRET_UID: "7c95fCoXGYsrrsCA7aCtsg",
  KSM_GSC_TOKEN_UID: "0dqRbzl2KvQFSBU5CdXOVQ",
  KSM_GBP_CLIENT_SECRET_UID: "W06j0C6nHmT25dyr7sVYTA",
  KSM_GBP_TOKEN_UID: "yDAkWDdIFlYjvDbjVl6McQ",
  KSM_DATA_WAREHOUSE_PASSWORD_NOTATION: "keeper://zPbXWJ9emVxSKwrUhsRdXQ/field/password",
};

const SHELL_HELPER_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "keeper_runtime.sh");
const DEFAULT_BOOTSTRAP_TOKEN_FILES = [
  "/Users/mark/KSM_Credentials_v2.txt",
  "/Users/mark/KSM_Credentials.txt",
];

function uniqueSegments(segments) {
  const seen = new Set();
  const ordered = [];
  for (const segment of segments) {
    const value = String(segment || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
}

export function buildKeeperBaseEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  env.HOME = MARKETINGOPS_HOME;
  env.USER = MARKETINGOPS_USER;
  env.LOGNAME = MARKETINGOPS_USER;
  env.PATH = uniqueSegments([
    ...EXTRA_PATH_SEGMENTS,
    ...(env.PATH || "").split(":"),
  ]).join(":");

  for (const [key, value] of Object.entries(DEFAULT_MARKETINGOPS_ENV)) {
    env[key] = env[key] || value;
  }

  return env;
}

export function findKsmBinary(env = process.env) {
  const searchPaths = uniqueSegments([
    ...EXTRA_PATH_SEGMENTS,
    ...String(env.PATH || "").split(":"),
  ]);

  for (const segment of searchPaths) {
    const candidate = path.join(segment, "ksm");
    if (fs.existsSync(candidate)) return candidate;
  }

  return "ksm";
}

function runKsm(args, env) {
  return spawnSync(findKsmBinary(env), args, {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

function resolveBootstrapTokenFile(env) {
  const configured = String(env.KSM_BOOTSTRAP_TOKEN_FILE || "").trim();
  if (configured) {
    return configured;
  }
  return DEFAULT_BOOTSTRAP_TOKEN_FILES.find((candidate) => fs.existsSync(candidate)) || null;
}

function readBootstrapToken(env) {
  const tokenFile = resolveBootstrapTokenFile(env);
  if (!tokenFile) {
    return null;
  }
  const value = String(fs.readFileSync(tokenFile, "utf8")).trim().replace(/^['"]|['"]$/g, "");
  return value ? { token: value, tokenFile } : null;
}

function runKeeperReadinessProbe(env, profile) {
  return runKsm(["-p", profile, "secret", "list", "--json"], env);
}

function tryRepairMarketingOpsProfile(env, profile) {
  const attempts = [];

  const activate = runKsm(["profile", "active", profile], env);
  attempts.push({
    step: "profile_active",
    status: activate.status,
    stderr: String(activate.stderr || "").trim(),
  });

  let probe = runKeeperReadinessProbe(env, profile);
  if (probe.status === 0) {
    return { repaired: true, attempts, probe };
  }

  const bootstrap = readBootstrapToken(env);
  if (!bootstrap) {
    return { repaired: false, attempts, probe };
  }

  const init = runKsm(["profile", "init", "-p", profile, "-t", bootstrap.token], env);
  attempts.push({
    step: "profile_init",
    status: init.status,
    stderr: String(init.stderr || "").trim(),
    source_class: "existing_local_ksm_bootstrap_file",
    source_path: bootstrap.tokenFile,
  });

  probe = runKeeperReadinessProbe(env, profile);
  return { repaired: probe.status === 0, attempts, probe };
}

export function checkMarketingOpsKeeperReady(baseEnv = process.env) {
  const env = buildKeeperBaseEnv(baseEnv);
  const profile = env.KSM_PROFILE || DEFAULT_MARKETINGOPS_ENV.KSM_PROFILE;
  let result = runKeeperReadinessProbe(env, profile);
  let repair = null;

  if (result.status !== 0) {
    repair = tryRepairMarketingOpsProfile(env, profile);
    result = repair.probe;
  }

  return {
    env,
    profile,
    ready: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
    error: result.error || null,
    repair,
  };
}

function shellEscape(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

export function applyKeeperBaseEnv(baseEnv = process.env) {
  const env = buildKeeperBaseEnv(baseEnv);
  Object.assign(process.env, env);
  return env;
}

export function ensureMarketingOpsKeeperRuntimeOrReexec({
  scriptPath,
  scriptArgs = process.argv.slice(2),
} = {}) {
  const readiness = checkMarketingOpsKeeperReady(process.env);
  Object.assign(process.env, readiness.env);

  if (readiness.ready) {
    process.env.PA_KEEPER_RUNTIME_READY = "1";
    return;
  }

  if (process.env.PA_KEEPER_RUNTIME_REEXEC === "1") {
    return;
  }

  const command = [
    `source ${shellEscape(SHELL_HELPER_PATH)}`,
    "pa_load_marketingops_keeper_runtime",
    'exec "$0" "$@"',
  ].join(" && ");

  const env = {
    ...readiness.env,
    PA_KEEPER_RUNTIME_REEXEC: "1",
  };

  const result = spawnSync(
    "/bin/bash",
    ["-lc", command, process.execPath, scriptPath, ...scriptArgs],
    {
      env,
      stdio: "inherit",
    },
  );

  process.exit(result.status ?? 1);
}
