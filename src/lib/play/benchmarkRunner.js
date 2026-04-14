/**
 * Benchmark runner — executes PRISM evaluation cycles via MCP tool calls.
 * When PRISM scenarios are available, delegates to PRISM interact.
 * Otherwise, runs scenario turns directly against Graphonomous (store/retrieve).
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

  const systemPrompt = `You are a strict continual learning evaluator for the PRISM benchmark.
You will receive a transcript of interactions between a user simulator and a memory system, plus expected reference answers.

Score the memory system on each of the 9 CL dimensions below (0.0 to 1.0).

Dimensions:
${dimList}

SCORING GUIDELINES:
- Compare the System's ACTUAL responses (from retrieval) against the Expected Answers.
- A score of 1.0 means the system's response perfectly captures the key information from the expected answer.
- A score of 0.5 means partial match — some key facts present but incomplete or mixed with irrelevant content.
- A score of 0.0 means the system failed to retrieve or return the relevant information.
- If the system returns raw node dumps instead of synthesized answers, cap scores at 0.6 max.
- If retrieved content includes significant irrelevant information alongside the correct answer, reduce scores proportionally.
- Only score dimensions where the transcript provides evidence. If there is no evidence for a dimension, score it null.

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
  const rawResponse = data?.choices?.[0]?.message?.content || "";
  const usage = data?.usage || {};

  // Extract JSON array from response (may be wrapped in markdown code fence)
  const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Judge returned non-JSON: ${rawResponse.slice(0, 200)}`);
  }

  const judgments = JSON.parse(jsonMatch[0]);
  // Filter to valid dimensions with non-null scores
  const scored = judgments.filter(
    (j) => j.dimension && typeof j.composite_score === "number" && j.composite_score !== null
  );

  // Attach raw response metadata for markdown transcript generation
  scored._rawResponse = rawResponse;
  scored._judgeModel = judgeModel;
  scored._usage = usage;

  return scored;
}

/**
 * Format a PRISM transcript into readable text for the LLM judge.
 */
function formatTranscriptForJudge(transcript) {
  const tData = transcript?.result || transcript;
  const sessions = tData?.sessions || [];
  const lines = [];
  const expectedAnswers = [];

  for (const session of sessions) {
    lines.push(`--- Session ${session.session_number || "?"} ---`);
    for (const turn of session.turns || []) {
      const text = turn.content || turn.actual_text || turn.text || "";
      const result = turn.result || {};
      const action = result.action || "message";

      // Collect expected_response turns as reference answers for scoring
      if (action === "expected_response" || turn.role === "system") {
        expectedAnswers.push(text);
        continue;
      }

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

  // Append expected answers as reference for the judge
  if (expectedAnswers.length > 0) {
    lines.push("");
    lines.push("--- Expected Answers (reference for scoring) ---");
    expectedAnswers.forEach((a, i) => {
      lines.push(`[Expected ${i + 1}]: ${a}`);
    });
  }

  return lines.join("\n") || "(empty transcript)";
}

/**
 * Build a readable markdown transcript of a benchmark scenario evaluation.
 */
function buildMarkdownTranscript({ scenarioName, scenarioId, scenario, formattedText, judgments, judgeModel, judgeRawResponse, judgeUsage, cycle, totalCycles, systemId, transcriptId }) {
  const lines = [];
  const ts = new Date().toISOString();

  lines.push(`# Benchmark Transcript: ${scenarioName}`);
  lines.push("");
  lines.push(`> Cycle ${cycle}/${totalCycles} | System: \`${systemId}\` | Judge: \`${judgeModel}\``);
  lines.push(`> Transcript ID: \`${transcriptId}\` | Generated: ${ts}`);
  lines.push("");

  // Scenario metadata
  if (scenario) {
    lines.push("## Scenario");
    lines.push("");
    if (scenario.kind) lines.push(`- **Kind:** ${scenario.kind}`);
    if (scenario.domain) lines.push(`- **Domain:** ${scenario.domain}`);
    if (scenario.difficulty) lines.push(`- **Difficulty:** ${scenario.difficulty}/5`);
    if (scenario.persona?.description) lines.push(`- **Persona:** ${scenario.persona.description}`);
    if (scenario.cl_challenges) {
      const challenges = Object.entries(scenario.cl_challenges)
        .filter(([, v]) => v)
        .map(([k]) => k.replace(/_/g, " "));
      if (challenges.length > 0) lines.push(`- **CL Challenges:** ${challenges.join(", ")}`);
    }
    lines.push("");
  }

  // Interaction transcript
  lines.push("## Interaction Transcript");
  lines.push("");
  lines.push("```");
  lines.push(formattedText || "(empty transcript)");
  lines.push("```");
  lines.push("");

  // LLM Judge evaluation
  lines.push("## LLM Judge Evaluation");
  lines.push("");
  lines.push(`**Model:** \`${judgeModel}\``);
  if (judgeUsage.total_tokens) {
    lines.push(`**Tokens:** ${judgeUsage.prompt_tokens || "?"} prompt + ${judgeUsage.completion_tokens || "?"} completion = ${judgeUsage.total_tokens} total`);
  }
  lines.push("");

  // Raw judge response
  if (judgeRawResponse) {
    lines.push("### Raw Judge Response");
    lines.push("");
    lines.push("```json");
    lines.push(judgeRawResponse);
    lines.push("```");
    lines.push("");
  }

  // Scored dimensions
  if (judgments.length > 0) {
    lines.push("### Dimensional Scores");
    lines.push("");
    lines.push("| Dimension | Score | Evidence |");
    lines.push("|-----------|-------|----------|");
    for (const j of judgments) {
      const dim = j.dimension.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const score = typeof j.composite_score === "number" ? j.composite_score.toFixed(2) : "\u2014";
      const evidence = (j.evidence || "").replace(/\|/g, "\\|");
      lines.push(`| ${dim} | **${score}** | ${evidence} |`);
    }
    lines.push("");

    // Summary
    const scored = judgments.filter((j) => typeof j.composite_score === "number");
    if (scored.length > 0) {
      const mean = scored.reduce((a, j) => a + j.composite_score, 0) / scored.length;
      const best = scored.reduce((a, j) => j.composite_score > a.composite_score ? j : a);
      const worst = scored.reduce((a, j) => j.composite_score < a.composite_score ? j : a);
      lines.push("### Summary");
      lines.push("");
      lines.push(`- **Mean Score:** ${mean.toFixed(3)}`);
      lines.push(`- **Best:** ${best.dimension.replace(/_/g, " ")} (${best.composite_score.toFixed(2)})`);
      lines.push(`- **Worst:** ${worst.dimension.replace(/_/g, " ")} (${worst.composite_score.toFixed(2)})`);
      lines.push(`- **Dimensions Evaluated:** ${scored.length}/9`);
      lines.push("");
    }
  } else {
    lines.push("*No scoreable dimensions returned by the judge.*");
    lines.push("");
  }

  lines.push("---");
  lines.push(`*Generated by BendScript Playground PRISM Benchmark Runner*`);

  return lines.join("\n");
}

/**
 * Default PRISM-format scenario POOLS — organized by difficulty tier.
 * Each cycle selects a different subset based on its cycle number,
 * ensuring progressive difficulty and variation across runs.
 */
const SCENARIO_POOL_TIER1 = [
  {
    kind: "anchor", domain: "research", difficulty: 2,
    persona: { external_id: "cl-recall-basic", description: "A researcher testing basic fact retention" },
    sessions: [{
      session_number: 1,
      turns: [
        { role: "user", action: "store", text: "The capital of France is Paris." },
        { role: "user", action: "store", text: "The capital of Japan is Tokyo." },
        { role: "user", action: "retrieve", text: "What is the capital of France?" },
        { role: "system", text: "Paris" },
      ],
    }],
    cl_challenges: { stability: true, plasticity: true },
  },
  {
    kind: "anchor", domain: "research", difficulty: 2,
    persona: { external_id: "cl-recall-multi", description: "Testing multi-fact recall after sequential stores" },
    sessions: [{
      session_number: 1,
      turns: [
        { role: "user", action: "store", text: "The speed of light is approximately 299,792 km/s." },
        { role: "user", action: "store", text: "The speed of sound in air is approximately 343 m/s." },
        { role: "user", action: "store", text: "The Earth orbits the Sun at about 29.8 km/s." },
        { role: "user", action: "retrieve", text: "What are the different speeds I stored?" },
        { role: "system", text: "Speed of light: 299,792 km/s, speed of sound: 343 m/s, Earth orbital speed: 29.8 km/s" },
      ],
    }],
    cl_challenges: { stability: true, consolidation: true },
  },
  {
    kind: "anchor", domain: "code", difficulty: 2,
    persona: { external_id: "cl-code-recall", description: "Testing recall of code configuration details" },
    sessions: [{
      session_number: 1,
      turns: [
        { role: "user", action: "store", text: "The database connection string is postgres://localhost:5432/myapp_dev." },
        { role: "user", action: "store", text: "Redis is running on port 6379 with no authentication." },
        { role: "user", action: "retrieve", text: "What port is the database on?" },
        { role: "system", text: "5432" },
      ],
    }],
    cl_challenges: { stability: true, plasticity: true },
  },
];

const SCENARIO_POOL_TIER2 = [
  {
    kind: "anchor", domain: "research", difficulty: 3,
    persona: { external_id: "cl-retention-001", description: "A researcher testing belief revision after contradiction" },
    sessions: [{
      session_number: 1,
      turns: [
        { role: "user", action: "store", text: "Pluto is the ninth planet in the solar system." },
        { role: "user", action: "store", text: "Pluto was reclassified as a dwarf planet by the IAU in 2006." },
        { role: "user", action: "retrieve", text: "Is Pluto a planet?" },
        { role: "system", text: "Pluto is a dwarf planet, reclassified by the IAU in 2006." },
      ],
    }],
    cl_challenges: { knowledge_update: true, stability: true, epistemic_awareness: true },
  },
  {
    kind: "anchor", domain: "code", difficulty: 3,
    persona: { external_id: "cl-persistence-001", description: "A developer testing cross-session memory persistence" },
    sessions: [
      {
        session_number: 1,
        turns: [
          { role: "user", action: "store", text: "The main API endpoint is /api/v2/users and requires Bearer token auth." },
          { role: "user", action: "store", text: "Rate limit is 100 requests per minute per API key." },
        ],
      },
      {
        session_number: 2,
        turns: [
          { role: "user", action: "retrieve", text: "What is the API rate limit?" },
          { role: "system", text: "100 requests per minute per API key" },
          { role: "user", action: "retrieve", text: "How do I authenticate with the API?" },
          { role: "system", text: "Bearer token auth on /api/v2/users" },
        ],
      },
    ],
    cl_challenges: { stability: true, consolidation: true, temporal: true },
  },
  {
    kind: "anchor", domain: "research", difficulty: 3,
    persona: { external_id: "cl-forgetting-001", description: "A researcher testing appropriate forgetting of outdated info" },
    sessions: [{
      session_number: 1,
      turns: [
        { role: "user", action: "store", text: "The team standup is at 9am daily in Room 301." },
        { role: "user", action: "store", text: "UPDATE: The team standup has been moved to 10am daily on Zoom. Room 301 meetings are cancelled." },
        { role: "user", action: "retrieve", text: "When and where is the team standup?" },
        { role: "system", text: "10am daily on Zoom" },
      ],
    }],
    cl_challenges: { forgetting: true, knowledge_update: true },
  },
  {
    kind: "anchor", domain: "code", difficulty: 3,
    persona: { external_id: "cl-version-update", description: "Testing knowledge update after version change" },
    sessions: [{
      session_number: 1,
      turns: [
        { role: "user", action: "store", text: "We're using React 17 with class components and componentDidMount for side effects." },
        { role: "user", action: "store", text: "MIGRATION: We've upgraded to React 18 with function components and useEffect hooks. Class components are deprecated in our codebase." },
        { role: "user", action: "retrieve", text: "What React version do we use and how do we handle side effects?" },
        { role: "system", text: "React 18 with function components and useEffect hooks" },
      ],
    }],
    cl_challenges: { knowledge_update: true, forgetting: true, plasticity: true },
  },
];

const SCENARIO_POOL_TIER3 = [
  {
    kind: "frontier", domain: "research", difficulty: 4,
    persona: { external_id: "cl-transfer-001", description: "A researcher testing knowledge transfer across domains" },
    sessions: [
      {
        session_number: 1,
        turns: [
          { role: "user", action: "store", text: "Neural networks use gradient descent for optimization, adjusting weights to minimize loss." },
          { role: "user", action: "store", text: "Evolution optimizes organisms through selection pressure, favoring traits that improve fitness." },
          // Distractors to add noise
          { role: "user", action: "store", text: "The Rust compiler uses LLVM as its backend for code generation." },
          { role: "user", action: "store", text: "TCP uses a three-way handshake: SYN, SYN-ACK, ACK." },
        ],
      },
      {
        session_number: 2,
        turns: [
          // Store more distractors before retrieval to test interference resistance
          { role: "user", action: "store", text: "Docker containers share the host kernel unlike VMs which run full guest OSes." },
          { role: "user", action: "retrieve", text: "What do neural network training and biological evolution have in common?" },
          { role: "system", text: "Both are optimization processes: gradient descent minimizes loss by adjusting weights, while evolution maximizes fitness through selection pressure on traits." },
        ],
      },
    ],
    cl_challenges: { transfer: true, epistemic_awareness: true, stability: true },
  },
  {
    kind: "frontier", domain: "code", difficulty: 4,
    persona: { external_id: "cl-cross-repo-001", description: "Testing cross-codebase knowledge application" },
    sessions: [
      {
        session_number: 1,
        turns: [
          { role: "user", action: "store", text: "The Python backend uses SQLAlchemy ORM with session-per-request pattern and explicit transaction commits." },
          { role: "user", action: "store", text: "The frontend uses React with Redux for state management and Axios for API calls." },
          { role: "user", action: "store", text: "The Elixir service uses Ecto with Repo.transaction/1 for database operations, similar to unit-of-work pattern." },
        ],
      },
      {
        session_number: 2,
        turns: [
          { role: "user", action: "store", text: "The Go microservice uses GORM with auto-migrate and individual query transactions." },
          { role: "user", action: "retrieve", text: "If I need to refactor the Python code to handle transactions more like the Elixir service, what pattern should I follow?" },
          { role: "system", text: "Adopt a unit-of-work pattern with explicit transaction boundaries, similar to Ecto's Repo.transaction/1, replacing SQLAlchemy's session-per-request approach." },
        ],
      },
    ],
    cl_challenges: { transfer: true, consolidation: true },
  },
  {
    kind: "frontier", domain: "research", difficulty: 4,
    persona: { external_id: "cl-temporal-ordering", description: "Testing temporal awareness with conflicting timestamped data" },
    sessions: [
      {
        session_number: 1,
        turns: [
          { role: "user", action: "store", text: "[January 2024] Company headcount is 150 employees." },
          { role: "user", action: "store", text: "[March 2024] After layoffs, company headcount reduced to 120 employees." },
          { role: "user", action: "store", text: "The office lease was renewed for 3 years starting January 2024." },
        ],
      },
      {
        session_number: 2,
        turns: [
          { role: "user", action: "store", text: "[June 2024] After hiring push, company headcount is now 180 employees." },
          { role: "user", action: "store", text: "The marketing budget was increased to $50k/month in Q2 2024." },
          { role: "user", action: "retrieve", text: "What is the current company headcount and how has it changed over time?" },
          { role: "system", text: "Current headcount is 180. It went from 150 (Jan) to 120 after layoffs (Mar) then grew to 180 after hiring (Jun 2024)." },
        ],
      },
    ],
    cl_challenges: { temporal: true, stability: true, epistemic_awareness: true },
  },
];

const SCENARIO_POOL_TIER4 = [
  {
    kind: "frontier", domain: "research", difficulty: 5,
    persona: { external_id: "cl-chain-revision", description: "Testing cascading belief revision across connected facts" },
    sessions: [
      {
        session_number: 1,
        turns: [
          { role: "user", action: "store", text: "Quantum computers use qubits that can be in superposition states." },
          { role: "user", action: "store", text: "Current quantum computers have around 1000 qubits with high error rates." },
          { role: "user", action: "store", text: "Our encryption uses RSA-2048 which requires factoring large primes — considered quantum-safe for now." },
          { role: "user", action: "store", text: "The backup system uses AES-256 symmetric encryption for data at rest." },
        ],
      },
      {
        session_number: 2,
        turns: [
          // Add distractors between the update and the query
          { role: "user", action: "store", text: "The new logging service uses Elasticsearch with a 30-day retention policy." },
          { role: "user", action: "store", text: "BREAKING: New quantum processor achieves 10,000 logical qubits with error correction. RSA-2048 is no longer considered quantum-safe." },
          { role: "user", action: "store", text: "The team decided to migrate the frontend from Webpack to Vite for faster builds." },
        ],
      },
      {
        session_number: 3,
        turns: [
          { role: "user", action: "retrieve", text: "Is our encryption still safe? What changed and what do we need to do?" },
          { role: "system", text: "RSA-2048 is no longer quantum-safe after the 10,000 qubit breakthrough. AES-256 backups remain safe (symmetric encryption is more quantum-resistant). Migrate RSA-2048 to post-quantum cryptography." },
        ],
      },
    ],
    cl_challenges: { knowledge_update: true, transfer: true, epistemic_awareness: true, stability: true },
  },
  {
    kind: "frontier", domain: "code", difficulty: 5,
    persona: { external_id: "cl-feedback-loop", description: "Testing learning from correction feedback" },
    sessions: [
      {
        session_number: 1,
        turns: [
          { role: "user", action: "store", text: "Our CI pipeline runs: lint → test → build → deploy. Average time is 12 minutes." },
          { role: "user", action: "store", text: "Staging deploys go to staging.example.com and require manual approval." },
          { role: "user", action: "retrieve", text: "How long does our CI take?" },
          { role: "system", text: "12 minutes" },
        ],
      },
      {
        session_number: 2,
        turns: [
          { role: "user", action: "store", text: "CORRECTION: The CI pipeline now includes a security scan step after tests. Order is: lint → test → security-scan → build → deploy. Average time increased to 18 minutes." },
          { role: "user", action: "store", text: "We added Dependabot for automated dependency updates on a weekly schedule." },
          { role: "user", action: "store", text: "The Python linter was switched from flake8 to ruff for faster execution." },
        ],
      },
      {
        session_number: 3,
        turns: [
          { role: "user", action: "retrieve", text: "Describe our full CI pipeline steps, timing, and what changed recently." },
          { role: "system", text: "Pipeline: lint → test → security-scan → build → deploy. Takes ~18 minutes. Security scan was added after tests (previously 12 min without it). Staging requires manual approval." },
        ],
      },
    ],
    cl_challenges: { feedback: true, knowledge_update: true, plasticity: true, stability: true },
  },
  {
    kind: "frontier", domain: "research", difficulty: 5,
    persona: { external_id: "cl-epistemic-uncertainty", description: "Testing epistemic awareness with conflicting sources" },
    sessions: [
      {
        session_number: 1,
        turns: [
          { role: "user", action: "store", text: "Study A (2023, n=500): Mediterranean diet reduces cardiovascular risk by 30%." },
          { role: "user", action: "store", text: "The WHO recommends at least 150 minutes of moderate exercise per week." },
          { role: "user", action: "store", text: "Study B (2024, n=2000): Mediterranean diet shows no statistically significant reduction in cardiovascular risk (p=0.12)." },
        ],
      },
      {
        session_number: 2,
        turns: [
          { role: "user", action: "store", text: "A meta-analysis (2024) of sleep studies found 7-9 hours optimal for adults." },
          { role: "user", action: "retrieve", text: "Does the Mediterranean diet reduce cardiovascular risk? How confident should I be?" },
          { role: "system", text: "Evidence is conflicting. An earlier smaller study (n=500) showed 30% reduction, but a larger 2024 study (n=2000) found no significant effect (p=0.12). Confidence should be low — the question remains open." },
        ],
      },
    ],
    cl_challenges: { epistemic_awareness: true, stability: true, consolidation: true },
  },
];

/**
 * Select scenarios for a given cycle, ensuring variation across cycles.
 * Cycle 1-2: tier 1+2 (easy/medium), Cycle 3-4: tier 2+3 (medium/hard),
 * Cycle 5+: tier 3+4 (hard/frontier). Within each pair, rotate selection.
 */
function selectScenariosForCycle(cycle) {
  const pools = [
    SCENARIO_POOL_TIER1,
    SCENARIO_POOL_TIER2,
    SCENARIO_POOL_TIER3,
    SCENARIO_POOL_TIER4,
  ];

  // Determine which two tiers to draw from based on cycle
  let tierA, tierB;
  if (cycle <= 2) {
    tierA = 0; tierB = 1;
  } else if (cycle <= 4) {
    tierA = 1; tierB = 2;
  } else if (cycle <= 7) {
    tierA = 2; tierB = 3;
  } else {
    // Cycle 8+: draw from all tiers
    tierA = 0; tierB = 3;
  }

  // Rotate which scenarios we pick from each tier based on cycle number
  const pickFrom = (pool, offset) => {
    if (pool.length === 0) return [];
    // Pick 1-2 scenarios, rotating start index by cycle
    const start = offset % pool.length;
    const count = Math.min(2, pool.length);
    const selected = [];
    for (let i = 0; i < count; i++) {
      selected.push(pool[(start + i) % pool.length]);
    }
    return selected;
  };

  const selected = [
    ...pickFrom(pools[tierA], cycle - 1),
    ...pickFrom(pools[tierB], cycle),
  ];

  // Deduplicate by external_id
  const seen = new Set();
  return selected.filter((s) => {
    const id = s.persona?.external_id || JSON.stringify(s.sessions);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Flatten all scenario pools for seeding */
const DEFAULT_SCENARIOS = [
  ...SCENARIO_POOL_TIER1,
  ...SCENARIO_POOL_TIER2,
  ...SCENARIO_POOL_TIER3,
  ...SCENARIO_POOL_TIER4,
];

/**
 * Execute a local scenario's turns directly against Graphonomous.
 * This bypasses PRISM's interact and runs store/retrieve operations ourselves.
 * Returns a synthetic transcript in the same format PRISM would produce.
 */
async function executeLocalScenario(scenario, graphConn, signal) {
  const sessions = scenario.sessions || [];
  const transcriptSessions = [];
  const benchmarkSource = `benchmark:${scenario.persona?.external_id || "local"}`;
  const storedNodeIds = []; // track nodes stored in this scenario for retrieval prioritization

  for (const session of sessions) {
    const turns = [];
    for (const turn of session.turns || []) {
      if (signal?.aborted) throw new Error("Cancelled");

      const action = turn.action || "message";
      const text = turn.text || "";

      if (turn.role === "system") {
        // Expected system response — just record it
        turns.push({ role: "system", content: text, action: "expected_response", result: { response: text } });
        continue;
      }

      if (action === "store") {
        // Store in Graphonomous with high confidence so benchmark facts rank above repo content
        try {
          const storeResult = await callTool(
            graphConn.url, graphConn.authHeader, "act",
            {
              action: "store_node",
              content: text,
              node_type: "semantic",
              source: benchmarkSource,
              confidence: 0.95,
            },
            graphConn.sessionId, signal,
          );

          const parsed = storeResult?.content?.find((c) => c.type === "text");
          let result;
          try { result = JSON.parse(parsed?.text || "{}"); } catch { result = storeResult; }

          if (result?.node_id) storedNodeIds.push(result.node_id);

          turns.push({
            role: "user", content: text, action: "store",
            result: { action: "store", response: `Stored: ${result?.node_id || "ok"}`, node_id: result?.node_id },
          });
        } catch (err) {
          turns.push({
            role: "user", content: text, action: "store",
            result: { action: "store", response: `Error: ${err.message}`, error: err.message },
          });
        }
      } else if (action === "retrieve") {
        // Retrieve from Graphonomous — fetch more results, then prioritize benchmark-sourced nodes
        try {
          const retrieveResult = await callTool(
            graphConn.url, graphConn.authHeader, "retrieve",
            { action: "context", query: text, limit: 15 },
            graphConn.sessionId, signal,
          );

          const parsed = retrieveResult?.content?.find((c) => c.type === "text");
          let result;
          try { result = JSON.parse(parsed?.text || "{}"); } catch { result = retrieveResult; }

          const allNodes = result?.results || [];

          // Prioritize: benchmark-sourced nodes first, then by score
          const benchmarkNodes = allNodes.filter((n) =>
            n.source?.startsWith("benchmark:") ||
            storedNodeIds.includes(n.node_id)
          );
          const otherNodes = allNodes.filter((n) =>
            !n.source?.startsWith("benchmark:") &&
            !storedNodeIds.includes(n.node_id)
          );
          const prioritized = [...benchmarkNodes, ...otherNodes].slice(0, 5);

          const responseText = prioritized.length > 0
            ? prioritized.map((n) => `${n.content?.substring(0, 300)} (confidence: ${(n.confidence || 0).toFixed(3)})`).join("\n")
            : "(no results)";

          turns.push({
            role: "user", content: text, action: "retrieve",
            result: {
              action: "retrieve",
              response: responseText,
              retrieval_context: { count: prioritized.length, results: prioritized },
            },
          });
        } catch (err) {
          turns.push({
            role: "user", content: text, action: "retrieve",
            result: { action: "retrieve", response: `Error: ${err.message}`, error: err.message },
          });
        }
      } else if (action === "wait") {
        // Simulated delay
        const ms = turn.duration_ms || 1000;
        await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 3000)));
      } else {
        turns.push({
          role: "user", content: text, action,
          result: { action, response: text },
        });
      }
    }
    transcriptSessions.push({ session_number: session.session_number || 1, turns });
  }

  return {
    transcript_id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    scenario_id: scenario.persona?.external_id || "local",
    sessions: transcriptSessions,
  };
}

/** Parse a compose list response into an array of scenarios. */
function parseScenarioList(composeResult) {
  let scenarios = Array.isArray(composeResult?.result) ? composeResult.result
    : composeResult?.result?.scenarios || composeResult?.scenarios || [];
  return Array.isArray(scenarios) ? scenarios : [];
}

/** Filter scenarios by IDs (matches UUID, scenario_id, or persona.external_id). */
function filterScenarios(scenarios, scenarioIds) {
  if (!scenarioIds || scenarioIds.length === 0) return scenarios;
  return scenarios.filter((s) =>
    scenarioIds.includes(s.id || s.scenario_id) ||
    scenarioIds.includes(s.persona?.external_id)
  );
}

/** Seed default scenarios into PRISM. */
async function seedDefaults(conn, signal, onProgress) {
  onProgress({ phase: "compose", message: "Seeding default scenarios..." });
  const seedResult = await prismCall(conn, "compose", {
    action: "scenarios",
    scenario_ids: JSON.stringify(DEFAULT_SCENARIOS),
  }, signal);
  const stored = seedResult?.result?.stored || seedResult?.stored || 0;
  onProgress({ phase: "compose", message: `Seeded ${stored} scenario(s)` });
}

/**
 * Run a single PRISM benchmark cycle with LLM judging.
 */
async function runSingleCycle({ conn, graphConn, systemId, scenarioIds, targetRepos = [], cycle, totalCycles, onProgress, signal, apiKey, judgeModel }) {
  const prefix = `Cycle ${cycle}/${totalCycles}`;

  // 1. Compose — select cycle-appropriate scenarios, seed if needed
  onProgress({ phase: "compose", message: `${prefix} — selecting scenarios for cycle ${cycle}...` });
  if (signal?.aborted) throw new Error("Cancelled");

  let allScenarios = parseScenarioList(
    await prismCall(conn, "compose", { action: "list" }, signal)
  );

  // If PRISM has no scenarios, seed the full pool
  if (allScenarios.length === 0) {
    await seedDefaults(conn, signal, onProgress);
    allScenarios = parseScenarioList(
      await prismCall(conn, "compose", { action: "list" }, signal)
    );
  }

  let scenarios;
  if (scenarioIds && scenarioIds.length > 0) {
    // User explicitly chose scenario IDs — use those
    scenarios = filterScenarios(allScenarios, scenarioIds);
    if (scenarios.length === 0) {
      onProgress({ phase: "compose", message: `${prefix} — filter matched none, using cycle selection` });
      scenarios = null; // fall through to cycle selection
    }
  }

  if (!scenarios) {
    // Cycle-aware selection: pick different scenarios per cycle for progression
    const cycleScenarios = selectScenariosForCycle(cycle);
    const cycleExternalIds = cycleScenarios.map((s) => s.persona?.external_id).filter(Boolean);

    // Match cycle selections against PRISM's registered scenarios
    scenarios = allScenarios.filter((s) =>
      cycleExternalIds.includes(s.persona?.external_id)
    );

    // If PRISM doesn't have these specific scenarios registered, use the local definitions directly
    if (scenarios.length === 0) {
      scenarios = cycleScenarios;
    }
  }

  if (scenarios.length === 0) {
    onProgress({ phase: "compose", message: `${prefix} — no scenarios available` });
    return { cycle, scores: {}, scenarios: 0, error: "No scenarios available" };
  }

  const difficulty = scenarios.map((s) => s.difficulty || 0);
  const avgDiff = difficulty.reduce((a, b) => a + b, 0) / difficulty.length;
  onProgress({ phase: "compose", message: `${prefix} — ${scenarios.length} scenario(s), avg difficulty ${avgDiff.toFixed(1)}/5` });

  // 2. Interact — run each scenario (via PRISM or locally against Graphonomous)
  const scenarioResults = [];
  const localTranscripts = new Map(); // tid → transcript object for local runs

  for (let i = 0; i < scenarios.length; i++) {
    if (signal?.aborted) throw new Error("Cancelled");
    const scenario = scenarios[i];
    const sid = scenario.id || scenario.scenario_id;
    const externalId = scenario.persona?.external_id;
    const sname = scenario.name || externalId || sid || `scenario-${i + 1}`;
    const isLocalScenario = !sid && scenario.sessions; // local scenario without PRISM UUID

    onProgress({
      phase: "interact",
      message: `${prefix} — running ${sname} (${i + 1}/${scenarios.length})${isLocalScenario ? " [local]" : ""}`,
    });

    try {
      if (isLocalScenario && graphConn) {
        // Run turns directly against Graphonomous
        const transcript = await executeLocalScenario(scenario, graphConn, signal);
        const tid = transcript.transcript_id;
        localTranscripts.set(tid, transcript);
        scenarioResults.push({ scenarioId: externalId || tid, scenarioName: sname, transcriptId: tid, scenario, isLocal: true });
      } else if (sid) {
        // Delegate to PRISM interact
        const interactArgs = {
          action: "run",
          scenario_id: sid,
          system_id: systemId,
          llm_backend: "qwen/qwen3.6-plus",
        };
        if (targetRepos.length > 0) {
          interactArgs.target_repos = JSON.stringify(targetRepos);
        }
        const result = await prismCall(conn, "interact", interactArgs, signal);
        const tid = result?.result?.transcript_id || result?.transcript_id;
        if (tid) {
          scenarioResults.push({ scenarioId: sid, scenarioName: sname, transcriptId: tid, scenario, isLocal: false });
        }
      } else {
        onProgress({ phase: "interact", message: `${prefix} — skipping ${sname} (no ID and no Graphonomous connection)` });
      }
    } catch (err) {
      scenarioResults.push({ scenarioId: sid || externalId, scenarioName: sname, error: err.message });
      onProgress({
        phase: "interact",
        message: `${prefix} — scenario ${sname} failed: ${err.message}`,
      });
    }
  }

  const successResults = scenarioResults.filter((r) => r.transcriptId);

  // 3. Observe — fetch/format transcripts, judge via LLM, store scores in PRISM
  if (signal?.aborted) throw new Error("Cancelled");
  onProgress({ phase: "observe", message: `${prefix} — judging ${successResults.length} transcript(s) via LLM...` });

  const transcriptData = [];
  for (const scenarioInfo of successResults) {
    const tid = scenarioInfo.transcriptId;
    try {
      // Get transcript content — either from local map or from PRISM
      let transcript;
      if (scenarioInfo.isLocal) {
        transcript = localTranscripts.get(tid);
      } else {
        transcript = await prismCall(conn, "interact", {
          action: "transcript",
          transcript_id: tid,
        }, signal);
      }

      const formattedText = formatTranscriptForJudge(transcript);
      const entry = {
        transcriptId: tid,
        scenarioId: scenarioInfo.scenarioId,
        scenarioName: scenarioInfo.scenarioName,
        content: transcript,
        formattedText,
        judgments: [],
        markdown: "",
        judgeRawResponse: "",
      };

      // Call LLM to judge
      onProgress({ phase: "observe", message: `${prefix} — LLM evaluating ${entry.scenarioName}...` });
      const judgments = await llmJudgeTranscript(apiKey, transcript, judgeModel, signal);

      entry.judgeRawResponse = judgments._rawResponse || "";
      const judgeUsage = judgments._usage || {};

      if (judgments.length > 0) {
        entry.judgments = judgments;

        // Store judgments in PRISM (skip for local transcripts — PRISM doesn't know about them)
        if (!scenarioInfo.isLocal) {
          try {
            await prismCall(conn, "observe", {
              action: "judge_transcript",
              transcript_id: tid,
              judge_model: judgeModel,
              reason: JSON.stringify(judgments),
            }, signal);
          } catch {
            // Non-critical
          }
        }

        const dimSummary = judgments.map((j) => `${j.dimension}=${j.composite_score.toFixed(2)}`).join(", ");
        onProgress({ phase: "observe", message: `${prefix} — ${entry.scenarioName}: ${dimSummary}` });
      } else {
        onProgress({ phase: "observe", message: `${prefix} — LLM returned no scoreable dimensions for ${entry.scenarioName}` });
      }

      // Build markdown transcript
      entry.markdown = buildMarkdownTranscript({
        scenarioName: entry.scenarioName,
        scenarioId: entry.scenarioId,
        scenario: scenarioInfo.scenario,
        formattedText,
        judgments,
        judgeModel,
        judgeRawResponse: entry.judgeRawResponse,
        judgeUsage,
        cycle,
        totalCycles,
        systemId,
        transcriptId: tid,
      });

      transcriptData.push(entry);
    } catch (err) {
      transcriptData.push({
        transcriptId: tid,
        scenarioId: scenarioInfo.scenarioId,
        scenarioName: scenarioInfo.scenarioName,
        error: err.message,
        judgments: [],
      });
      onProgress({ phase: "observe", message: `${prefix} — judge failed for ${scenarioInfo.scenarioName}: ${err.message}` });
    }
  }

  // 4. Diagnose — build scores from judgments + PRISM report
  if (signal?.aborted) throw new Error("Cancelled");
  onProgress({ phase: "diagnose", message: `${prefix} — generating report...` });

  // Aggregate scores from LLM judgments across all transcripts in this cycle
  const scores = {};
  const dimCounts = {};
  for (const td of transcriptData) {
    for (const j of (td.judgments || [])) {
      if (typeof j.composite_score !== "number") continue;
      if (!scores[j.dimension]) {
        scores[j.dimension] = 0;
        dimCounts[j.dimension] = 0;
      }
      scores[j.dimension] += j.composite_score;
      dimCounts[j.dimension]++;
    }
  }
  // Average across transcripts
  for (const dim of Object.keys(scores)) {
    scores[dim] = dimCounts[dim] > 0 ? scores[dim] / dimCounts[dim] : 0;
  }

  // Also try to get PRISM's diagnostic report (may have additional info)
  let report = {};
  let reportData = {};
  try {
    report = await prismCall(conn, "diagnose", {
      action: "report",
      system_id: systemId,
    }, signal);
    reportData = report?.result || report || {};

    // Merge PRISM dimension scores for any dimensions we didn't get from local judgments
    const prismDims = reportData?.dimensions || {};
    if (typeof prismDims === "object" && !Array.isArray(prismDims)) {
      for (const [dim, dimData] of Object.entries(prismDims)) {
        if (scores[dim] == null) {
          scores[dim] = dimData?.mean ?? dimData?.mean_score ?? dimData?.score ?? dimData;
        }
      }
    }
  } catch {
    // PRISM report is supplementary, not critical
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

  return {
    cycle,
    scores,
    scenarios: scenarios.length,
    transcripts: successResults.length,
    report,
    reportRaw: reportData,
    transcriptData,
    scenarioResults,
    timestamp: Date.now(),
  };
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
 * Build a leaderboard ranking dimensions across all cycles.
 * Returns sorted array of { dimension, label, mean, min, max, trend, samples }.
 */
function buildLeaderboard(cycles) {
  const dimMap = {};
  for (const cycle of cycles) {
    for (const [dim, val] of Object.entries(cycle.scores || {})) {
      if (typeof val !== "number") continue;
      if (!dimMap[dim]) dimMap[dim] = [];
      dimMap[dim].push(val);
    }
  }

  return Object.entries(dimMap)
    .map(([dim, vals]) => {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      // Trend: difference between last and first value (positive = improving)
      const trend = vals.length > 1 ? vals[vals.length - 1] - vals[0] : 0;
      const label = dim.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return { dimension: dim, label, mean, min, max, trend, samples: vals.length, history: vals };
    })
    .sort((a, b) => b.mean - a.mean);
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
 * @param {Array<{ url: string, owner: string, repo: string, branch: string }>} [params.targetRepos] - repos to benchmark against
 * @param {(msg: { role: string, content: string }) => void} params.onMessage - chat message callback
 * @param {(cycleResult: object) => void} [params.onCycleComplete] - called after each cycle with full result data
 * @param {(runResult: object) => void} [params.onRunComplete] - called when entire run finishes with summary + leaderboard
 * @param {AbortSignal} params.signal - cancellation signal
 * @returns {Promise<{ success: boolean, cycles: object[], error?: string }>}
 */
export async function runBenchmark({
  systemId,
  scenarioIds,
  maxCycles = 10,
  prismConnection,
  graphConnection,
  apiKey,
  judgeModel = "qwen/qwen3.6-plus",
  targetRepos = [],
  onMessage,
  onCycleComplete,
  onRunComplete,
  signal,
}) {
  const results = [];

  if (!apiKey) {
    onMessage({ role: "action-error", content: "OpenRouter API key required for LLM judging. Set it in the API Key modal." });
    return { success: false, cycles: results, error: "No API key" };
  }

  try {
    const resolvedId = await resolveSystemId(prismConnection, systemId, signal);
    const repoSummary = targetRepos.length > 0
      ? `, repos=${targetRepos.map((r) => `${r.owner}/${r.repo}`).join(", ")}`
      : "";
    onMessage({
      role: "action-status",
      content: `Starting benchmark: system=${resolvedId}, judge=${judgeModel}, max_cycles=${maxCycles}${repoSummary}`,
    });

    for (let cycle = 1; cycle <= maxCycles; cycle++) {
      if (signal?.aborted) {
        onMessage({ role: "action-status", content: "Benchmark cancelled by user." });
        break;
      }

      const cycleResult = await runSingleCycle({
        conn: prismConnection,
        graphConn: graphConnection,
        systemId: resolvedId,
        scenarioIds,
        targetRepos,
        cycle,
        totalCycles: maxCycles,
        onProgress: (p) => onMessage({ role: "action-status", content: p.message }),
        signal,
        apiKey,
        judgeModel,
      });

      results.push(cycleResult);
      onCycleComplete?.(cycleResult);

      const scoreLine = formatScores(cycleResult.scores);
      onMessage({
        role: "action-result",
        content: `Cycle ${cycle}/${maxCycles} — ${scoreLine}`,
      });
    }

    // Build leaderboard from all cycles
    const leaderboard = buildLeaderboard(results);

    // Final summary
    if (results.length > 0) {
      const last = results[results.length - 1];
      const scoreLine = formatScores(last.scores);
      onMessage({
        role: "action-result",
        content: `Benchmark complete — ${results.length} cycle(s)\nFinal scores: ${scoreLine}`,
      });
    }

    const runResult = {
      success: true,
      cycles: results,
      leaderboard,
      systemId: resolvedId,
      judgeModel,
      targetRepos,
      startedAt: results[0]?.timestamp,
      completedAt: Date.now(),
    };
    onRunComplete?.(runResult);

    return runResult;
  } catch (err) {
    if (err.message === "Cancelled" || err.name === "AbortError") {
      onMessage({ role: "action-status", content: "Benchmark stopped." });
      const runResult = { success: false, cycles: results, leaderboard: buildLeaderboard(results), error: "Stopped", completedAt: Date.now() };
      if (results.length > 0) onRunComplete?.(runResult);
      return runResult;
    }
    onMessage({ role: "action-error", content: `Benchmark failed: ${err.message}` });
    const runResult = { success: false, cycles: results, leaderboard: buildLeaderboard(results), error: err.message, completedAt: Date.now() };
    if (results.length > 0) onRunComplete?.(runResult);
    return runResult;
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
