/**
 * Default MCP servers for the /play route.
 *
 * These are the four [&] ecosystem MCP servers deployed to Fly.io.
 * They auto-connect on page load (unless previously disconnected by the user).
 */
export const DEFAULT_MCP_SERVERS = [
  {
    url: "https://graphonomous-mcp.fly.dev/mcp",
    label: "Graphonomous",
    description: "Continual learning knowledge graph",
  },
  {
    url: "https://box-and-box-mcp.fly.dev/mcp",
    label: "box-and-box",
    description: "[&] Protocol validator + composer",
  },
  {
    url: "https://os-pulse-mcp.fly.dev/mcp",
    label: "os-pulse",
    description: "PULSE loop manifest registry",
  },
  {
    url: "https://prism-eval.fly.dev/mcp",
    label: "os-prism",
    description: "CL benchmark engine",
  },
];
