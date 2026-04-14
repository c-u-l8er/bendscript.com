/**
 * Repository Analyzer — analyzes ingested repo knowledge via LLM + Graphonomous retrieval.
 *
 * After ingestion, this module queries the knowledge graph for repo nodes,
 * synthesizes insights (architecture, tech stack, patterns, dependencies),
 * and stores the analysis back as higher-level semantic nodes.
 */
import { callTool } from "./mcp-client.js";

/**
 * Call a Graphonomous MCP tool.
 */
async function graphCall(conn, toolName, args, signal) {
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
 * Build an analysis prompt from retrieved nodes.
 */
function buildAnalysisPrompt(repoName, nodes) {
  const nodeTexts = nodes
    .slice(0, 15)
    .map((n, i) => `[${i + 1}] ${n.content?.substring(0, 800) || "(empty)"}`)
    .join("\n\n---\n\n");

  return `Analyze the following code files from the repository "${repoName}".

Produce a structured analysis covering:
1. **Tech Stack** — languages, frameworks, build tools
2. **Architecture** — module structure, patterns (MVC, ECS, pipeline, etc.)
3. **Key Modules** — the 3-5 most important files/modules and what they do
4. **Dependencies** — external libraries and what they're used for
5. **Code Quality Signals** — test presence, documentation, config quality
6. **Knowledge Graph Connections** — what concepts from this repo connect to other repos or domains

Be concise. Each section should be 2-4 sentences.

FILES:
${nodeTexts}`;
}

/**
 * Call OpenRouter to generate analysis.
 */
async function llmAnalyze(apiKey, prompt, model, signal) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://bendscript.com/play",
      "X-Title": "BendScript Playground",
    },
    body: JSON.stringify({
      model: model || "qwen/qwen3.6-plus",
      messages: [
        { role: "system", content: "You are a code analysis expert. Respond in markdown." },
        { role: "user", content: prompt },
      ],
      max_tokens: 2048,
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Analyze one or more repositories that have been ingested into Graphonomous.
 *
 * @param {object} opts
 * @param {Array<{ url, owner, repo, branch }>} opts.repos - Repositories to analyze
 * @param {{ url, authHeader, sessionId }} opts.graphConnection - Graphonomous MCP connection
 * @param {string} opts.apiKey - OpenRouter API key
 * @param {string} [opts.model] - LLM model for analysis
 * @param {(msg: { role: string, content: string }) => void} opts.onMessage - Status callback
 * @param {AbortSignal} [opts.signal] - Cancellation signal
 * @returns {Promise<{ repos: Array, totalAnalyses: number }>}
 */
export async function analyzeRepositories({
  repos,
  graphConnection,
  apiKey,
  model,
  onMessage,
  signal,
}) {
  const emit = (role, content) => onMessage?.({ role, content });
  const results = [];
  let totalAnalyses = 0;

  for (const repo of repos) {
    signal?.throwIfAborted();
    const repoName = `${repo.owner}/${repo.repo}`;
    emit("action-status", `Analyzing ${repoName}...`);

    // Step 1: Retrieve ingested nodes for this repo using multiple queries
    emit("action-status", `Retrieving knowledge for ${repoName}...`);

    // Run several targeted queries to maximize recall of repo nodes
    const queries = [
      `${repoName}`,
      `${repo.repo} source code`,
      `${repo.repo} architecture modules`,
    ];

    const allNodes = new Map(); // dedupe by node_id
    for (const query of queries) {
      try {
        const retrieved = await graphCall(
          graphConnection,
          "retrieve",
          {
            action: "context",
            query,
            limit: 20,
          },
          signal,
        );
        for (const node of (retrieved?.results || [])) {
          if (node.node_id && !allNodes.has(node.node_id)) {
            allNodes.set(node.node_id, node);
          }
        }
      } catch {
        // Continue with other queries
      }
    }

    // Filter to nodes that actually belong to this repo
    const repoNodes = [...allNodes.values()].filter((n) =>
      n.content?.includes(repoName) ||
      n.content?.includes(repo.repo) ||
      n.source?.includes(repoName) ||
      n.source?.includes(repo.repo)
    );

    if (repoNodes.length === 0) {
      emit("action-status", `No ingested files found for ${repoName}. Run "Ingest Repository" first.`);
      results.push({ repo: repoName, error: "No ingested nodes found", analysisStored: false });
      continue;
    }

    emit("action-status", `Found ${repoNodes.length} nodes for ${repoName}. Running LLM analysis...`);

    // Step 2: LLM analysis
    const prompt = buildAnalysisPrompt(repoName, repoNodes);
    let analysis;
    try {
      analysis = await llmAnalyze(apiKey, prompt, model, signal);
    } catch (err) {
      if (err.name === "AbortError") throw err;
      emit("action-error", `LLM analysis failed for ${repoName}: ${err.message}`);
      results.push({ repo: repoName, error: err.message, analysisStored: false });
      continue;
    }

    emit("action-status", `Storing analysis for ${repoName} in knowledge graph...`);

    // Step 3: Store analysis as a semantic node
    const storeResult = await graphCall(
      graphConnection,
      "act",
      {
        action: "store_node",
        content: `# Repository Analysis: ${repoName}\n\n${analysis}`,
        node_type: "semantic",
        source: `analysis:${repoName}`,
        confidence: 0.75,
        metadata: JSON.stringify({
          type: "repo_analysis",
          repo_url: repo.url,
          repo_owner: repo.owner,
          repo_name: repo.repo,
          branch: repo.branch,
          source_nodes: repoNodes.length,
          analyzed_at: new Date().toISOString(),
          model: model || "qwen/qwen3.6-plus",
        }),
      },
      signal,
    );

    const stored = storeResult?.status === "ok" || storeResult?.node_id;
    if (stored) {
      totalAnalyses++;

      // Step 4: Create edges from analysis to source nodes (up to 5)
      const analysisNodeId = storeResult.node_id;
      if (analysisNodeId) {
        for (const sourceNode of repoNodes.slice(0, 5)) {
          if (!sourceNode.node_id) continue;
          try {
            await graphCall(
              graphConnection,
              "act",
              {
                action: "store_edge",
                source_id: analysisNodeId,
                target_id: sourceNode.node_id,
                relationship: "derived_from",
                weight: 0.8,
              },
              signal,
            );
          } catch {
            // Non-critical, continue
          }
        }
      }
    }

    results.push({
      repo: repoName,
      nodesRetrieved: repoNodes.length,
      analysisStored: stored,
      analysisNodeId: storeResult?.node_id,
      analysis,
    });

    emit("action-status", `Completed analysis for ${repoName}`);
  }

  emit("action-status", `Analysis complete: ${totalAnalyses} repo(s) analyzed`);
  return { repos: results, totalAnalyses };
}
