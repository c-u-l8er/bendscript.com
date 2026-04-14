/**
 * Benchmark runner — executes PRISM evaluation cycles via MCP tool calls.
 * No LLM in the loop; calls MCP tools directly.
 */
import { callTool } from "./mcp-client.js";

/**
 * Call a PRISM MCP tool and unwrap the MCP content envelope.
 *
 * MCP tools/call returns: { content: [{ type: "text", text: "..." }], structuredContent: {...} }
 * We prefer structuredContent, fall back to parsing the text content.
 *
 * @param {object} conn - MCP connection object { url, authHeader, sessionId }
 * @param {string} toolName - raw MCP tool name (e.g., "config", "compose")
 * @param {object} args - tool arguments
 * @returns {Promise<object>}
 */
async function prismCall(conn, toolName, args) {
  const raw = await callTool(conn.url, conn.authHeader, toolName, args, conn.sessionId);

  // If we got a structured content object, prefer it
  if (raw?.structuredContent) {
    return raw.structuredContent;
  }

  // Try parsing text content from the MCP content array
  if (raw?.content && Array.isArray(raw.content)) {
    const textItem = raw.content.find((c) => c.type === "text" && c.text);
    if (textItem) {
      try { return JSON.parse(textItem.text); } catch { return { raw: textItem.text }; }
    }
  }

  // Fallback: maybe the proxy already unwrapped it
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return { raw }; }
  }

  return raw || {};
}

/**
 * Resolve "auto" system_id by listing registered systems and picking the first.
 */
async function resolveSystemId(conn, systemId) {
  if (systemId && systemId !== "auto") return systemId;
  const data = await prismCall(conn, "config", { action: "list_systems" });
  // PRISM returns { status: "ok", result: [{ id, name, ... }] }
  const systems = data?.result || data?.systems || [];
  if (!Array.isArray(systems) || systems.length === 0) {
    throw new Error("No systems registered in PRISM");
  }
  return systems[0].id || systems[0].system_id;
}

/**
 * Run a single PRISM benchmark cycle:
 *   compose(list) → interact(run) per scenario → observe(judge) → diagnose(report)
 *
 * @param {object} params
 * @param {object} params.conn - PRISM MCP connection
 * @param {string} params.systemId - resolved system ID
 * @param {string[]} [params.scenarioIds] - specific scenarios, or empty = all
 * @param {number} params.cycle - current cycle number (1-based)
 * @param {number} params.totalCycles - total planned cycles
 * @param {(msg: object) => void} params.onProgress - progress callback
 * @param {AbortSignal} params.signal - cancellation signal
 * @returns {Promise<object>} - cycle result with scores
 */
async function runSingleCycle({ conn, systemId, scenarioIds, cycle, totalCycles, onProgress, signal }) {
  const prefix = `Cycle ${cycle}/${totalCycles}`;

  // 1. Compose — list available scenarios
  onProgress({ phase: "compose", message: `${prefix} — listing scenarios...` });
  if (signal?.aborted) throw new Error("Cancelled");

  const composeResult = await prismCall(conn, "compose", { action: "list" });
  // PRISM compose returns { status: "ok", result: [...scenarios...] }
  // The result itself is the array of scenarios (not nested under .scenarios)
  let scenarios = Array.isArray(composeResult?.result) ? composeResult.result
    : composeResult?.result?.scenarios || composeResult?.scenarios || [];
  if (!Array.isArray(scenarios)) scenarios = [];

  // Filter to specific scenario IDs if provided
  if (scenarioIds && scenarioIds.length > 0) {
    scenarios = scenarios.filter((s) => scenarioIds.includes(s.id || s.scenario_id));
  }

  if (scenarios.length === 0) {
    onProgress({ phase: "compose", message: `${prefix} — no scenarios found` });
    return { cycle, scores: {}, scenarios: 0, error: "No scenarios available" };
  }

  onProgress({ phase: "compose", message: `${prefix} — ${scenarios.length} scenario(s)` });

  // 2. Interact — run each scenario
  const transcriptIds = [];
  for (let i = 0; i < scenarios.length; i++) {
    if (signal?.aborted) throw new Error("Cancelled");
    const scenario = scenarios[i];
    const sid = scenario.id || scenario.scenario_id;
    const sname = scenario.name || sid;

    onProgress({
      phase: "interact",
      message: `${prefix} — running ${sname} (${i + 1}/${scenarios.length})`,
    });

    try {
      const result = await prismCall(conn, "interact", {
        action: "run",
        scenario_id: sid,
        system_id: systemId,
        llm_backend: "qwen/qwen3.6-plus",
      });
      const tid = result?.result?.transcript_id || result?.transcript_id;
      if (tid) transcriptIds.push(tid);
    } catch (err) {
      onProgress({
        phase: "interact",
        message: `${prefix} — scenario ${sname} failed: ${err.message}`,
      });
    }
  }

  // 3. Observe — judge transcripts
  if (signal?.aborted) throw new Error("Cancelled");
  onProgress({ phase: "observe", message: `${prefix} — judging ${transcriptIds.length} transcript(s)...` });

  for (const tid of transcriptIds) {
    try {
      await prismCall(conn, "observe", {
        action: "judge",
        transcript_id: tid,
      });
    } catch {
      // Some transcripts may already be judged
    }
  }

  // 4. Diagnose — get report
  if (signal?.aborted) throw new Error("Cancelled");
  onProgress({ phase: "diagnose", message: `${prefix} — generating report...` });

  const report = await prismCall(conn, "diagnose", {
    action: "report",
    system_id: systemId,
  });

  // Extract dimensional scores — PRISM nests in result.dimensions or dimensions
  const reportData = report?.result || report || {};
  const dimensions = reportData?.dimensions || {};
  const scores = {};
  if (typeof dimensions === "object" && !Array.isArray(dimensions)) {
    for (const [dim, dimData] of Object.entries(dimensions)) {
      scores[dim] = dimData?.mean ?? dimData?.mean_score ?? dimData?.score ?? dimData;
    }
  }

  // 5. Reflect — advance cycle for next iteration
  try {
    await prismCall(conn, "reflect", {
      action: "advance_cycle",
      system_id: systemId,
    });
  } catch {
    // reflect may not be available
  }

  return { cycle, scores, scenarios: scenarios.length, transcripts: transcriptIds.length, report };
}

/**
 * Format a scores object into a single-line summary.
 * e.g., "Stability: 0.78 | Coherence: 0.65 | Retention: —"
 */
function formatScores(scores) {
  const dims = Object.entries(scores);
  if (dims.length === 0) return "No scores available";
  return dims
    .map(([dim, val]) => {
      const label = dim.charAt(0).toUpperCase() + dim.slice(1);
      const score = typeof val === "number" ? val.toFixed(2) : "—";
      return `${label}: ${score}`;
    })
    .join(" | ");
}

/**
 * Run multiple PRISM benchmark cycles.
 *
 * @param {object} params
 * @param {string} params.systemId - system ID or "auto"
 * @param {string[]} [params.scenarioIds] - specific scenarios, or empty = all
 * @param {number} [params.maxCycles=10] - maximum number of cycles
 * @param {object} params.prismConnection - MCP connection for PRISM server
 * @param {(msg: { role: string, content: string }) => void} params.onMessage - chat message callback
 * @param {AbortSignal} params.signal - cancellation signal
 * @returns {Promise<{ success: boolean, cycles: object[], error?: string }>}
 */
export async function runBenchmark({
  systemId,
  scenarioIds,
  maxCycles = 10,
  prismConnection,
  onMessage,
  signal,
}) {
  const results = [];

  try {
    // Resolve system ID
    const resolvedId = await resolveSystemId(prismConnection, systemId);
    onMessage({
      role: "action-status",
      content: `Starting benchmark: system=${resolvedId}, max_cycles=${maxCycles}`,
    });

    for (let cycle = 1; cycle <= maxCycles; cycle++) {
      if (signal?.aborted) {
        onMessage({ role: "action-status", content: "Benchmark cancelled by user." });
        break;
      }

      const cycleResult = await runSingleCycle({
        conn: prismConnection,
        systemId: resolvedId,
        scenarioIds,
        cycle,
        totalCycles: maxCycles,
        onProgress: (p) => onMessage({ role: "action-status", content: p.message }),
        signal,
      });

      results.push(cycleResult);

      // Emit cycle summary
      const scoreLine = formatScores(cycleResult.scores);
      onMessage({
        role: "action-result",
        content: `Cycle ${cycle}/${maxCycles} — ${scoreLine}`,
      });
    }

    // Final summary
    if (results.length > 0) {
      const last = results[results.length - 1];
      const scoreLine = formatScores(last.scores);
      onMessage({
        role: "action-result",
        content: `Benchmark complete — ${results.length} cycle(s)\nFinal scores: ${scoreLine}`,
      });
    }

    return { success: true, cycles: results };
  } catch (err) {
    if (err.message === "Cancelled") {
      onMessage({ role: "action-status", content: "Benchmark cancelled." });
      return { success: false, cycles: results, error: "Cancelled" };
    }
    onMessage({ role: "action-error", content: `Benchmark failed: ${err.message}` });
    return { success: false, cycles: results, error: err.message };
  }
}

/**
 * Run a single MCP tool call action (non-benchmark).
 *
 * @param {object} params
 * @param {string} params.toolName - raw MCP tool name
 * @param {object} params.args - tool arguments
 * @param {object} params.connection - MCP connection object
 * @param {(msg: { role: string, content: string }) => void} params.onMessage
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function runMcpCall({ toolName, args, connection, onMessage }) {
  try {
    onMessage({ role: "action-status", content: `Calling ${toolName}...` });
    const result = await prismCall(connection, toolName, args);
    const formatted = typeof result === "object"
      ? JSON.stringify(result, null, 2)
      : String(result);
    onMessage({ role: "action-result", content: formatted });
    return { success: true, data: result };
  } catch (err) {
    onMessage({ role: "action-error", content: `Call failed: ${err.message}` });
    return { success: false, error: err.message };
  }
}
