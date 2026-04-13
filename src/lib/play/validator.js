// Paste-only JSON schema validators for [&], PULSE, and PRISM specs.
// Uses Ajv with JSON Schema 2020-12 support.

import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import ampersandSchema from "./schemas/ampersand.schema.json";
import capabilityContractSchema from "./schemas/capability-contract.schema.json";
import registrySchema from "./schemas/registry.schema.json";
import pulseManifestSchema from "./schemas/pulse-loop-manifest.v0.1.json";

/** @type {import('ajv').default} */
let ajvInstance = null;

function getAjv() {
  if (!ajvInstance) {
    ajvInstance = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });
    addFormats(ajvInstance);

    // Register all schemas so $ref works across files
    ajvInstance.addSchema(capabilityContractSchema);
    ajvInstance.addSchema(registrySchema);
  }
  return ajvInstance;
}

/**
 * @typedef {{ valid: boolean, errors: Array<{path: string, message: string}>, schemaType: string }} ValidationResult
 */

/**
 * Detect which schema type a JSON document matches and validate it.
 * @param {string} jsonString - Raw JSON string to validate
 * @returns {ValidationResult}
 */
export function validateSpec(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return {
      valid: false,
      errors: [{ path: "", message: `Invalid JSON: ${err.message}` }],
      schemaType: "unknown",
    };
  }

  const schemaType = detectSchemaType(parsed);
  if (!schemaType) {
    return {
      valid: false,
      errors: [
        {
          path: "",
          message:
            "Could not detect schema type. Expected an [&] Protocol spec (.ampersand.json), PULSE manifest, or PRISM scenario.",
        },
      ],
      schemaType: "unknown",
    };
  }

  const ajv = getAjv();
  const schema = getSchemaForType(schemaType);
  const validate = ajv.compile(schema);
  const valid = validate(parsed);

  if (valid) {
    return { valid: true, errors: [], schemaType };
  }

  const errors = (validate.errors || []).map((err) => ({
    path: err.instancePath || "/",
    message: `${err.message}${err.params ? ` (${JSON.stringify(err.params)})` : ""}`,
  }));

  return { valid: false, errors, schemaType };
}

/**
 * Detect which protocol schema a parsed document belongs to.
 * @param {object} doc
 * @returns {string|null}
 */
function detectSchemaType(doc) {
  if (!doc || typeof doc !== "object") return null;

  // Use $schema URL for exact detection when present
  if (typeof doc.$schema === "string") {
    if (doc.$schema.includes("capability-contract.schema.json"))
      return "capability-contract";
    if (doc.$schema.includes("registry.schema.json")) return "registry";
    if (doc.$schema.includes("ampersand.schema.json")) return "ampersand";
    if (doc.$schema.includes("pulse-loop-manifest")) return "pulse";
  }

  // PULSE manifest: has "loop_id" and "phases"
  if (doc.loop_id && doc.phases) return "pulse";

  // PRISM scenario: has "scenario_id" or "dimensions"
  if (doc.scenario_id || doc.dimensions) return "prism";

  // [&] Capability contract: has "capability" string and "operations" object
  if (typeof doc.capability === "string" && doc.operations)
    return "capability-contract";

  // [&] Registry: has a primitive namespace key like "&memory", "&time", etc.
  if (doc["&memory"] || doc["&reason"] || doc["&time"] || doc["&space"] || doc["&govern"])
    return "registry";

  // [&] Protocol: has "capabilities" object (not array) and "agent"
  if (doc.capabilities && typeof doc.capabilities === "object" && !Array.isArray(doc.capabilities))
    return "ampersand";
  if (doc.agent && doc.version) return "ampersand";

  return null;
}

/**
 * Get the JSON Schema object for a detected type.
 * @param {string} schemaType
 * @returns {object}
 */
function getSchemaForType(schemaType) {
  switch (schemaType) {
    case "ampersand":
      return ampersandSchema;
    case "capability-contract":
      return capabilityContractSchema;
    case "registry":
      return registrySchema;
    case "pulse":
      return pulseManifestSchema;
    case "prism":
      // No schema file yet — return a permissive stub
      return {
        type: "object",
        properties: {
          scenario_id: { type: "string" },
        },
        additionalProperties: true,
      };
    default:
      return { type: "object" };
  }
}

/**
 * List available schema types with display names.
 */
export const SCHEMA_TYPES = [
  { id: "ampersand", label: "[&] Protocol", ext: ".ampersand.json" },
  { id: "capability-contract", label: "[&] Capability Contract", ext: ".capability.json" },
  { id: "registry", label: "[&] Registry", ext: ".registry.json" },
  { id: "pulse", label: "PULSE Manifest", ext: ".pulse.json" },
  { id: "prism", label: "PRISM Scenario", ext: ".scenario.json" },
];
