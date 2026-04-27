// Filesystem-driven workspace loader.
// Add/remove folders, schemas, and examples on disk — Vite picks them up via glob.
//
// Workspace layout:
//   workspaces/<name>/meta.json              — { label, description, isDemo, order }
//   workspaces/<name>/schemas/*.schema.json  — JSON Schema files (validation)
//   workspaces/<name>/examples/*.json        — example specs (loadable in editor)
//
// File naming convention for examples:
//   <slug>.<schemaType>.json   — schemaType detected from the second-to-last extension
//   e.g.  fleet-agent.ampersand.json      → schemaType "ampersand"
//         fleet-time.capability.json      → schemaType "capability-contract"
//         fleet-loop.pulse.json           → schemaType "pulse"
//         fleet-recall.scenario.json      → schemaType "prism"

// ── Glob all workspace files (eager: loaded at build/HMR time) ──
const metaModules = import.meta.glob("./**/meta.json", { eager: true });
const schemaModules = import.meta.glob("./**/schemas/*.json", { eager: true });
const exampleModules = import.meta.glob("./**/examples/*.json", { eager: true });
const actionModules = import.meta.glob("./**/actions.json", { eager: true });

// ── Extension → schema type mapping ──
const EXT_TO_SCHEMA_TYPE = {
  ampersand: "ampersand",
  capability: "capability-contract",
  registry: "registry",
  pulse: "pulse",
  scenario: "prism",
};

/**
 * Infer schemaType from filename convention: <slug>.<ext>.json
 * Falls back to auto-detection from content if no known extension.
 */
function inferSchemaType(filename, data) {
  // Try filename convention: name.ext.json
  const parts = filename.replace(/\.json$/, "").split(".");
  if (parts.length >= 2) {
    const ext = parts[parts.length - 1];
    if (EXT_TO_SCHEMA_TYPE[ext]) return EXT_TO_SCHEMA_TYPE[ext];
  }

  // Fallback: sniff from content
  if (data && typeof data === "object") {
    if (data.$schema) {
      if (data.$schema.includes("capability-contract")) return "capability-contract";
      if (data.$schema.includes("registry")) return "registry";
      if (data.$schema.includes("ampersand")) return "ampersand";
      if (data.$schema.includes("pulse-loop-manifest")) return "pulse";
    }
    if (data.loop_id && data.phases) return "pulse";
    if (data.scenario_id || data.dimensions) return "prism";
    if (typeof data.capability === "string" && data.operations) return "capability-contract";
    if (data.agent && data.capabilities) return "ampersand";
  }
  return "unknown";
}

/** Extract workspace ID and filename from a glob path like ./demo-fleet-ops/examples/fleet-agent.ampersand.json */
function parsePath(globPath) {
  const match = globPath.match(/^\.\/([^/]+)\/(?:schemas|examples)\/(.+)$/);
  if (!match) return null;
  return { wsId: match[1], filename: match[2] };
}

/** Turn a filename into a display label: fleet-agent.ampersand.json → Fleet Agent */
function filenameToLabel(filename) {
  const slug = filename.replace(/\.[^.]+\.json$/, "").replace(/\.json$/, "");
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Turn a filename into an ID: fleet-agent.ampersand.json → fleet-agent */
function filenameToId(filename) {
  return filename.replace(/\.[^.]+\.json$/, "").replace(/\.json$/, "");
}

// ── Build workspace map ──
const wsMap = new Map();

// 1) Register workspaces from meta.json files
for (const [path, mod] of Object.entries(metaModules)) {
  const match = path.match(/^\.\/([^/]+)\/meta\.json$/);
  if (!match) continue;
  const wsId = match[1];
  const meta = mod.default || mod;
  wsMap.set(wsId, {
    id: wsId,
    label: meta.label || wsId,
    description: meta.description || "",
    isDemo: meta.isDemo || false,
    order: typeof meta.order === "number" ? meta.order : 50,
    schemas: {},
    schemaFiles: [],
    examples: [],
    actions: [],
  });
}

// 2) Attach schemas
for (const [path, mod] of Object.entries(schemaModules)) {
  const parsed = parsePath(path);
  if (!parsed) continue;
  const ws = wsMap.get(parsed.wsId);
  if (!ws) continue;
  const schema = mod.default || mod;
  const key = filenameToId(parsed.filename);
  ws.schemas[key] = schema;
  ws.schemaFiles.push({ filename: parsed.filename, key, data: schema });
}

// 3) Attach examples
for (const [path, mod] of Object.entries(exampleModules)) {
  const parsed = parsePath(path);
  if (!parsed) continue;
  const ws = wsMap.get(parsed.wsId);
  if (!ws) continue;
  const data = mod.default || mod;
  const id = filenameToId(parsed.filename);
  const schemaType = inferSchemaType(parsed.filename, data);
  ws.examples.push({
    id,
    label: filenameToLabel(parsed.filename),
    schemaType,
    filename: parsed.filename,
    data,
  });
}

// 4) Attach actions
for (const [path, mod] of Object.entries(actionModules)) {
  const match = path.match(/^\.\/([^/]+)\/actions\.json$/);
  if (!match) continue;
  const ws = wsMap.get(match[1]);
  if (!ws) continue;
  const actions = mod.default || mod;
  if (Array.isArray(actions)) {
    ws.actions = actions;
  }
}

// Sort files within each workspace alphabetically
for (const ws of wsMap.values()) {
  ws.schemaFiles.sort((a, b) => a.filename.localeCompare(b.filename));
  ws.examples.sort((a, b) => a.filename.localeCompare(b.filename));
}

// ── Exports ──

/** Ordered list of workspaces for the sidebar */
export const WORKSPACES = [...wsMap.values()].sort((a, b) => a.order - b.order);

/** All JSON schemas across all workspaces, keyed by filename stem */
export const SCHEMAS = Object.fromEntries(
  WORKSPACES.flatMap((ws) => Object.entries(ws.schemas)),
);

/** Flat lookup: example ID → { schemaType, data, workspaceId } */
export const EXAMPLES_BY_ID = Object.fromEntries(
  WORKSPACES.flatMap((ws) =>
    ws.examples.map((ex) => [
      ex.id,
      { schemaType: ex.schemaType, data: ex.data, workspaceId: ws.id },
    ]),
  ),
);

/** Get formatted JSON string for an example */
export function getExampleJson(exampleId) {
  const entry = EXAMPLES_BY_ID[exampleId];
  if (!entry) return "{}";
  return JSON.stringify(entry.data, null, 2);
}

/** Get default example for a schema type (first match from non-demo workspaces) */
export function getDefaultExample(schemaType) {
  for (const ws of WORKSPACES) {
    if (ws.isDemo) continue;
    const match = ws.examples.find((ex) => ex.schemaType === schemaType);
    if (match) return JSON.stringify(match.data, null, 2);
  }
  return "{}";
}
