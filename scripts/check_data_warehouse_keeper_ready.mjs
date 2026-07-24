#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import {
  DEFAULT_KEEPER_RECORD_TITLE,
  resolveDataWarehousePassword,
} from "./lib/data_warehouse_keeper.mjs";
import { ensureMarketingOpsKeeperRuntimeOrReexec } from "./lib/keeper_runtime.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);

ensureMarketingOpsKeeperRuntimeOrReexec({ scriptPath: SCRIPT_PATH });

function parseArgs(argv) {
  const args = {
    keeperRecordTitle: DEFAULT_KEEPER_RECORD_TITLE,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--keeper-record-title") {
      args.keeperRecordTitle = next;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/check_data_warehouse_keeper_ready.mjs [options]

Options:
  --keeper-record-title TITLE  Keeper record title, default ${DEFAULT_KEEPER_RECORD_TITLE}
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

try {
  const args = parseArgs(process.argv.slice(2));
  resolveDataWarehousePassword({ keeperRecordTitle: args.keeperRecordTitle });
  console.log("Data Warehouse Keeper readiness: OK");
  console.log("Credential source: Keeper/KSM");
} catch (error) {
  console.error(`Data Warehouse Keeper readiness failed: ${error.message}`);
  process.exit(1);
}
