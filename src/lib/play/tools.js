// Tool definitions for the /play LLM chat.
// Built-in tools run client-side; MCP tools proxy through /api/play/mcp-proxy.

import { validateSpec } from "./validator.js";
import { WORKSPACES } from "./workspaces/index.js";

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
        "Load an example JSON spec into the editor. Pass an example_id for a specific workspace example, or a schema_type for the default example of that protocol.",
      parameters: {
        type: "object",
        properties: {
          example_id: {
            type: "string",
            description: "Specific example ID from a workspace (e.g. 'fleet-agent', 'cl-loop', 'deadlock-test')",
          },
          schema_type: {
            type: "string",
            enum: [
              "ampersand",
              "capability-contract",
              "registry",
              "pulse",
              "prism",
            ],
            description: "Fallback: load the default example for this schema type",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_workspaces",
      description:
        "List all available workspaces and their examples. Use this to help users discover what demo specs are available.",
      parameters: { type: "object", properties: {}, required: [] },
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
      const id = args.example_id || args.schema_type;
      if (ctx.onLoadExample && id) {
        ctx.onLoadExample(id);
        return JSON.stringify({
          success: true,
          message: `Loaded ${id} example into the editor.`,
        });
      }
      return JSON.stringify({ success: false, message: "Missing example_id or schema_type" });
    }
    case "list_workspaces": {
      const summary = WORKSPACES.map((ws) => ({
        id: ws.id,
        label: ws.label,
        description: ws.description,
        isDemo: ws.isDemo,
        examples: ws.examples.map((ex) => ({
          id: ex.id,
          label: ex.label,
          schemaType: ex.schemaType,
        })),
      }));
      return JSON.stringify(summary);
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
