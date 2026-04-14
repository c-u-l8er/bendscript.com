/**
 * Benchmark runner — executes PRISM evaluation cycles via MCP tool calls.
 * LLM judging happens client-side via OpenRouter (MCP servers don't call LLMs).
 */
import { callTool } from "./mcp-client.js";

// 9 CL dimensions with rubric summaries for the judge prompt
const CL_DIMENSIONS = [
  { key: "stability", desc: "Retaining old knowledge when new arrives. 1.0=correct recall after updates, 0.5=partial, 0.0=wrong/lost" },
  { key: "plasticity", desc: "Speed and accuracy of learning new info. 1.0=immediate incorporation, 0.5=delayed/partial, 0.0=fails to learn" },
  { key: "knowledge_update", desc: "Correctly integrating updates/corrections. 1.0=seamless update, 0.5=partial, 0.0=retains stale info" },
  { key: "temporal", desc: "Awareness of time ordering and recency. 1.0=correct temporal reasoning, 0.5=partial, 0.0=ignores time" },
  { key: "consolidation", desc: "Merging/strengthening knowledge over time. 1.0=well-organized graph, 0.5=some redundancy, 0.0=no consolidation" },
  { key: "epistemic_awareness", desc: "Knowing what it knows/doesn't know. 1.0=calibrated confidence, 0.5=partial, 0.0=overconfident/unaware" },
  { key: "transfer", desc: "Applying knowledge to new domains. 1.0=successful transfer, 0.5=partial, 0.0=no cross-domain use" },
  { key: "forgetting", desc: "Appropriate forgetting of outdated info. 1.0=clean pruning, 0.5=partial, 0.0=retains junk" },
  { key: "feedback", desc: "Learning from user corrections/feedback. 1.0=immediate adaptation, 0.5=partial, 0.0=ignores feedback" },
];

/**
 * Call a PRISM MCP tool and unwrap the MCP content envelope.
 */
async function prismCall(conn, toolName, args, signal) {
  const raw = await callTool(conn.url, conn.authHeader, toolName, args, conn.sessionId, signal);

  if (raw?.structuredContent) return raw.structuredContent;

  if (raw?.content && Array.isArray(raw.content)) {
    const textItem = raw.content.find((c) => c.type === "text" && c.text);
    if (textItem) {
      try { return JSON.parse(textItem.text); } catch { return { raw: textItem.text }; }
    }
  }

  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return { raw }; }
  }

  return raw || {};
}

/**
 * Resolve "auto" system_id by listing registered systems and picking the first.
 */
async function resolveSystemId(conn, systemId, signal) {
  if (systemId && systemId !== "auto") return systemId;
  const data = await prismCall(conn, "config", { action: "list_systems" }, signal);
  const systems = data?.result || data?.systems || [];
  if (!Array.isArray(systems) || systems.length === 0) {
    throw new Error("No systems registered in PRISM");
  }
  return systems[0].id || systems[0].system_id;
}

/**
 * Call OpenRouter to judge a transcript against CL dimensions.
 * Returns array of { dimension, composite_score, evidence } objects.
 */
async function llmJudgeTranscript(apiKey, transcript, judgeModel, signal) {
  const dimList = CL_DIMENSIONS.map((d) => `- ${d.key}: ${d.desc}`).join("\n");

  const transcriptText = formatTranscriptForJudge(transcript);

  const systemPrompt = `You are a continual learning evaluator for the PRISM benchmark.
You will receive a transcript of interactions between a user simulator and a memory system.
Score the memory system on each of the 9 CL dimensions below (0.0 to 1.0).

Dimensions:
${dimList}

IMPORTANT: Only score dimensions where the transcript provides evidence. If there is no evidence for a dimension, score it null.
Return ONLY a JSON array, no markdown, no explanation. Each element:
{"dimension": "<key>", "composite_score": <0.0-1.0 or null>, "evidence": "<1 sentence>"}`;

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: judgeModel,
      max_tokens: 2048,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Transcript:\n${transcriptText}` },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenRouter judge call failed (${resp.status}): ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || "";

  // Extract JSON array from response (may be wrapped in markdown code fence)
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Judge returned non-JSON: ${content.slice(0, 200)}`);
  }

  const judgments = JSON.parse(jsonMatch[0]);
  // Filter to valid dimensions with non-null scores
  return judgments.filter(
    (j) => j.dimension && typeof j.composite_score === "number" && j.composite_score !== null
  );
}

/**
 * Format a PRISM transcript into readable text for the LLM judge.
 */
function formatTranscriptForJudge(transcript) {
  const tData = transcript?.result || transcript;
  const sessions = tData?.sessions || [];
  const lines = [];

  for (const session of sessions) {
    lines.push(`--- Session ${session.session_number || "?"} ---`);
    for (const turn of session.turns || []) {
      const text = turn.content || turn.actual_text || turn.text || "";
      const result = turn.result || {};
      const action = result.action || "message";
      lines.push(`[User → ${action}]: ${text}`);

      if (result.response) {
        const resp = typeof result.response === "string"
          ? result.response.slice(0, 500)
          : JSON.stringify(result.response).slice(0, 500);
        lines.push(`[System]: ${resp}`);
      }

      if (result.retrieval_context) {
        const ctx = result.retrieval_context;
        const count = ctx.count || ctx.results?.length || 0;
        lines.push(`[Retrieval]: ${count} nodes returned`);
      }
    }
  }

  return lines.join("\n") || "(empty transcript)";
}

/**
 * Run a single PRISM benchmark cycle with LLM judging.
 */
async function runSingleCycle({ conn, systemId, scenarioIds, cycle, totalCycles, onProgress, signal, apiKey, judgeModel }) {
  const prefix = `Cycle ${cycle}/${totalCycles}`;

  // 1. Compose — list available scenarios
  onProgress({ phase: "compose", message: `${prefix} — listing scenarios...` });
  if (signal?.aborted) throw new Error("Cancelled");

  const composeResult = await prismCall(conn, "compose", { action: "list" }, signal);
  let scenarios = Array.isArray(composeResult?.result) ? composeResult.result
    : composeResult?.result?.scenarios || composeResult?.scenarios || [];
  if (!Array.isArray(scenarios)) scenarios = [];

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
      }, signal);
      const tid = result?.result?.transcript_id || result?.transcript_id;
      if (tid) transcriptIds.push(tid);
    } catch (err) {
      onProgress({
        phase: "interact",
        message: `${prefix} — scenario ${sname} failed: ${err.message}`,
      });
    }
  }

  // 3. Observe — fetch transcripts, judge via LLM, store scores in PRISM
  if (signal?.aborted) throw new Error("Cancelled");
  onProgress({ phase: "observe", message: `${prefix} — judging ${transcriptIds.length} transcript(s) via LLM...` });

  for (const tid of transcriptIds) {
    try {
      // Fetch transcript content
      const transcript = await prismCall(conn, "interact", {
        action: "transcript",
        transcript_id: tid,
      }, signal);

      // Call LLM to judge
      onProgress({ phase: "observe", message: `${prefix} — LLM evaluating transcript...` });
      const judgments = await llmJudgeTranscript(apiKey, transcript, judgeModel, signal);

      if (judgments.length > 0) {
        // Store judgments in PRISM via observe
        await prismCall(conn, "observe", {
          action: "judge_transcript",
          transcript_id: tid,
          judge_model: judgeModel,
          reason: JSON.stringify(judgments),
        }, signal);

        const dimSummary = judgments.map((j) => `${j.dimension}=${j.composite_score.toFixed(2)}`).join(", ");
        onProgress({ phase: "observe", message: `${prefix} — judged: ${dimSummary}` });
      } else {
        onProgress({ phase: "observe", message: `${prefix} — LLM returned no scoreable dimensions` });
      }
    } catch (err) {
      onProgress({ phase: "observe", message: `${prefix} — judge failed: ${err.message}` });
    }
  }

  // 4. Diagnose — get report
  if (signal?.aborted) throw new Error("Cancelled");
  onProgress({ phase: "diagnose", message: `${prefix} — generating report...` });

  const report = await prismCall(conn, "diagnose", {
    action: "report",
    system_id: systemId,
  }, signal);

  // Extract dimensional scores
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
    }, signal);
  } catch {
    // reflect may not be available
  }

  return { cycle, scores, scenarios: scenarios.length, transcripts: transcriptIds.length, report };
}

/**
 * Format a scores object into a single-line summary.
 */
function formatScores(scores) {
  const dims = Object.entries(scores);
  if (dims.length === 0) return "No scores available";
  return dims
    .map(([dim, val]) => {
      const label = dim.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
 * @param {string} params.apiKey - OpenRouter API key for LLM judging
 * @param {string} [params.judgeModel="qwen/qwen3.6-plus"] - model for judging
 * @param {(msg: { role: string, content: string }) => void} params.onMessage - chat message callback
 * @param {AbortSignal} params.signal - cancellation signal
 * @returns {Promise<{ success: boolean, cycles: object[], error?: string }>}
 */
export async function runBenchmark({
  systemId,
  scenarioIds,
  maxCycles = 10,
  prismConnection,
  apiKey,
  judgeModel = "qwen/qwen3.6-plus",
  onMessage,
  signal,
}) {
  const results = [];

  if (!apiKey) {
    onMessage({ role: "action-error", content: "OpenRouter API key required for LLM judging. Set it in the API Key modal." });
    return { success: false, cycles: results, error: "No API key" };
  }

  try {
    const resolvedId = await resolveSystemId(prismConnection, systemId, signal);
    onMessage({
      role: "action-status",
      content: `Starting benchmark: system=${resolvedId}, judge=${judgeModel}, max_cycles=${maxCycles}`,
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
        apiKey,
        judgeModel,
      });

      results.push(cycleResult);

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
    if (err.message === "Cancelled" || err.name === "AbortError") {
      onMessage({ role: "action-status", content: "Benchmark stopped." });
      return { success: false, cycles: results, error: "Stopped" };
    }
    onMessage({ role: "action-error", content: `Benchmark failed: ${err.message}` });
    return { success: false, cycles: results, error: err.message };
  }
}

/**
 * Run a single MCP tool call action (non-benchmark).
 */
export async function runMcpCall({ toolName, args, connection, onMessage, signal }) {
  try {
    onMessage({ role: "action-status", content: `Calling ${toolName}...` });
    const result = await prismCall(connection, toolName, args, signal);
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
