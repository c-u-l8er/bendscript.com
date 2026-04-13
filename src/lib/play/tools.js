// Tool definitions for the /play LLM chat.
// Built-in tools run client-side; MCP tools proxy through /api/play/mcp-proxy.

import { validateSpec } from "./validator.js";

/**
 * Built-in playground tools (always available, no auth required).
 * Uses OpenAI-compatible tool calling format for OpenRouter.
 */
export const BUILTIN_TOOLS = [
  {
    type: "function",
    function: {
      name: "validate_spec",
      description:
        "Validate the current JSON spec in the editor against the auto-detected schema ([&] Protocol, PULSE, or PRISM). Returns whether it's valid and any errors.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "load_example",
      description:
        "Load an example JSON spec into the editor for a given schema type. Use this when the user wants to see what a valid spec looks like.",
      parameters: {
        type: "object",
        properties: {
          schema_type: {
            type: "string",
            enum: [
              "ampersand",
              "capability-contract",
              "registry",
              "pulse",
              "prism",
            ],
            description: "The schema type to load an example for",
          },
        },
        required: ["schema_type"],
      },
    },
  },
];

/**
 * Convert an MCP server's tool list into OpenAI-compatible tool definitions.
 * @param {string} serverName - Display name for namespacing
 * @param {Array} mcpTools - Tools from MCP tools/list response
 * @returns {Array} OpenAI-format tool definitions
 */
export function mcpToolsToOpenAI(serverName, mcpTools) {
  return mcpTools.map((t) => ({
    type: "function",
    function: {
      name: `mcp__${serverName}__${t.name}`,
      description: t.description || `MCP tool: ${t.name}`,
      parameters: t.inputSchema || { type: "object", properties: {} },
    },
  }));
}

/**
 * Check if a tool name is an MCP tool (namespaced with mcp__ prefix).
 * @param {string} name
 * @returns {{ serverName: string, toolName: string } | null}
 */
export function parseMcpToolName(name) {
  const match = name.match(/^mcp__(.+?)__(.+)$/);
  if (!match) return null;
  return { serverName: match[1], toolName: match[2] };
}

/**
 * Execute a built-in playground tool.
 * @param {string} name - Tool name
 * @param {object} args - Tool arguments
 * @param {object} ctx - Context: { editorContent, onLoadExample }
 * @returns {string} JSON string result
 */
export function executeBuiltinTool(name, args, ctx) {
  switch (name) {
    case "validate_spec": {
      const result = validateSpec(ctx.editorContent);
      return JSON.stringify(result);
    }
    case "load_example": {
      if (ctx.onLoadExample && args.schema_type) {
        ctx.onLoadExample(args.schema_type);
        return JSON.stringify({
          success: true,
          message: `Loaded ${args.schema_type} example into the editor.`,
        });
      }
      return JSON.stringify({ success: false, message: "Missing schema_type" });
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
