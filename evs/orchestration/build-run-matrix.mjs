import fs from "node:fs";

function loadConfig() {
  return JSON.parse(fs.readFileSync(new URL("../config/pilot-properties.json", import.meta.url), "utf8"));
}

function readEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return {};
  return JSON.parse(fs.readFileSync(eventPath, "utf8"));
}

const properties = loadConfig().filter((property) => property.active);
const event = readEvent();
const explicitPropertyId =
  process.env.INPUT_PROPERTY_ID ||
  event.inputs?.property_id ||
  event.client_payload?.property_id ||
  "";

const filtered = explicitPropertyId
  ? properties.filter((property) => property.property_id === explicitPropertyId)
  : properties;

if (filtered.length === 0) {
  throw new Error(`No pilot properties matched property_id=${explicitPropertyId || "<all>"}`);
}

process.stdout.write(JSON.stringify({ include: filtered }, null, 2));
