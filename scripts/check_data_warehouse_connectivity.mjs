#!/usr/bin/env node
import dns from "node:dns/promises";
import net from "node:net";

const DEFAULT_SERVER = "sqlreport.ocs-vr.onecornerstone.com";
const DEFAULT_PORT = 1433;
const DEFAULT_CONNECT_TIMEOUT_MS = 8000;

function parseArgs(argv) {
  const args = {
    server: DEFAULT_SERVER,
    port: DEFAULT_PORT,
    timeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--server") {
      args.server = next;
      i += 1;
    } else if (arg === "--port") {
      args.port = Number(next);
      i += 1;
    } else if (arg === "--timeout-ms") {
      args.timeoutMs = Number(next);
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.server || /\s/.test(args.server)) {
    throw new Error("--server must be a hostname.");
  }
  if (!Number.isInteger(args.port) || args.port < 1 || args.port > 65535) {
    throw new Error("--port must be an integer between 1 and 65535.");
  }
  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 1000 || args.timeoutMs > 120000) {
    throw new Error("--timeout-ms must be an integer between 1000 and 120000.");
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/check_data_warehouse_connectivity.mjs [options]

Options:
  --server HOST       SQL Server host, default ${DEFAULT_SERVER}
  --port PORT         SQL Server port, default ${DEFAULT_PORT}
  --timeout-ms MS     TCP connect timeout, default ${DEFAULT_CONNECT_TIMEOUT_MS}
`);
}

function sanitizeError(error) {
  return String(error?.code || error?.message || error || "unknown_error").trim();
}

async function resolveHost(server) {
  try {
    const records = await dns.lookup(server, { all: true });
    const addresses = records.map((record) => record.address).filter(Boolean);
    if (!addresses.length) {
      throw new Error("NO_ADDRESSES");
    }
    return { ok: true, addresses };
  } catch (error) {
    return {
      ok: false,
      code: sanitizeError(error),
      message:
        `Data Warehouse connectivity preflight failed: DNS resolution unavailable for ${server}. ` +
        `Likely VPN or network reachability issue. Sanitized context: ${sanitizeError(error)}`,
    };
  }
}

function checkTcpReachability(server, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish({ ok: true }));
    socket.once("timeout", () => finish({
      ok: false,
      code: "ETIMEDOUT",
      message:
        `Data Warehouse connectivity preflight failed: TCP connection to ${server}:${port} timed out after ${timeoutMs}ms. ` +
        "Likely VPN or warehouse network path issue. Sanitized context: ETIMEDOUT",
    }));
    socket.once("error", (error) => finish({
      ok: false,
      code: sanitizeError(error),
      message:
        `Data Warehouse connectivity preflight failed: TCP connection to ${server}:${port} was unavailable. ` +
        `Likely VPN or warehouse network path issue. Sanitized context: ${sanitizeError(error)}`,
    }));

    socket.connect(port, server);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dnsResult = await resolveHost(args.server);
  if (!dnsResult.ok) {
    console.error(dnsResult.message);
    process.exit(1);
  }

  const tcpResult = await checkTcpReachability(args.server, args.port, args.timeoutMs);
  if (!tcpResult.ok) {
    console.error(tcpResult.message);
    process.exit(1);
  }

  console.log(`Data Warehouse connectivity: OK (${args.server}:${args.port})`);
  console.log(`Resolved addresses: ${dnsResult.addresses.join(", ")}`);
}

main().catch((error) => {
  console.error(`Data Warehouse connectivity preflight failed: ${sanitizeError(error)}`);
  process.exit(1);
});
