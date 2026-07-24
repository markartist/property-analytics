import { execFileSync } from "node:child_process";
import {
  buildKeeperBaseEnv,
  findKsmBinary,
} from "./keeper_runtime.mjs";

export const DEFAULT_KEEPER_RECORD_TITLE = "Data Warehouse";
export const DEFAULT_KEEPER_PASSWORD_NOTATION = "keeper://zPbXWJ9emVxSKwrUhsRdXQ/field/password";

function sanitizeKsmError(error) {
  const stderr = String(error?.stderr || error?.stdout || error?.message || "").trim();
  return stderr.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(" | ");
}

function runKsm(args) {
  const env = buildKeeperBaseEnv(process.env);
  const profile = env.KSM_PROFILE || "marketingops";
  try {
    return execFileSync(findKsmBinary(env), ["-p", profile, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
  } catch (error) {
    const sanitized = sanitizeKsmError(error);
    const readinessHint = sanitized.toLowerCase();
    if (
      readinessHint.includes("keeper sdk client has not been loaded") ||
      readinessHint.includes("ini config might not be set")
    ) {
      throw new Error(
        `Keeper/KSM is not ready for the Data Warehouse lane (profile=${profile}). ` +
        "The local Keeper client bootstrap is missing or not loaded for this execution context. " +
        `Sanitized Keeper context: ${sanitized}`,
      );
    }
    if (readinessHint.includes("no such file") && readinessHint.includes("ksm")) {
      throw new Error(
        `Keeper/KSM is not ready for the Data Warehouse lane (profile=${profile}). ` +
        `The ksm binary was not found in PATH. Sanitized Keeper context: ${sanitized}`,
      );
    }
    throw new Error(
      `Keeper/KSM lookup failed for the Data Warehouse lane (profile=${profile}). ` +
      `Sanitized Keeper context: ${sanitized}`,
    );
  }
}

export function resolveDataWarehousePassword({
  keeperRecordTitle = DEFAULT_KEEPER_RECORD_TITLE,
  defaultNotation = DEFAULT_KEEPER_PASSWORD_NOTATION,
} = {}) {
  const notation = process.env.KSM_DATA_WAREHOUSE_PASSWORD_NOTATION || defaultNotation;
  try {
    const password = runKsm(["secret", "notation", notation]).trim();
    if (password) return password;
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("not ready for the Data Warehouse lane")) {
      throw error;
    }
  }

  const list = JSON.parse(runKsm(["secret", "list", "--title", keeperRecordTitle, "--json"]));
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`Keeper record not found for ${keeperRecordTitle}.`);
  }
  const records = JSON.parse(runKsm(["secret", "get", "--uid", list[0].uid, "--json"]));
  const record = Array.isArray(records) ? records[0] : records;
  const fields = [...(record.fields || []), ...(record.custom || [])];
  const passwordField = fields.find((field) => field.type === "password" || field.label === "password");
  const password = Array.isArray(passwordField?.value) ? passwordField.value[0] : passwordField?.value;
  if (!password) {
    throw new Error(`Keeper record ${keeperRecordTitle} does not contain a password value.`);
  }
  return password;
}
