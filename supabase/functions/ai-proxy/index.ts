// ProjectAmp2/bendscript.com/supabase/functions/ai-proxy/index.ts
import Anthropic from "npm:@anthropic-ai/sdk@0.35.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

type Tier = 1 | 2 | 3 | 4;
type WorkspacePlan = "free" | "kag_api" | "kag_teams" | "enterprise";

interface AiProxyRequestBody {
  workspaceId: string;
  graphId?: string | null;
  planeId?: string | null;
  prompt: string;
  tier?: number;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  graphContext?: Json;
  metadata?: Record<string, Json>;
}

interface WorkspaceAccess {
  workspaceId: string;
  role: "owner" | "admin" | "member" | "viewer";
  plan: WorkspacePlan;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const MAX_PROMPT_CHARS = 12_000;
const MAX_CONTEXT_CHARS = 18_000;
const MAX_TOKENS_CAP = 4_096;
const DEFAULT_TEMPERATURE = 0.25;

const SUPABASE_URL = Deno.env.get("PUBLIC_SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("PUBLIC_SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const DEFAULT_MODEL =
  Deno.env.get("ANTHROPIC_DEFAULT_MODEL") ?? "claude-3-5-sonnet-latest";
const FAST_MODEL =
  Deno.env.get("ANTHROPIC_FAST_MODEL") ?? "claude-3-5-haiku-latest";
const DEFAULT_MAX_TOKENS = safeInt(
  Deno.env.get("ANTHROPIC_MAX_TOKENS"),
  2_048,
  128,
  MAX_TOKENS_CAP,
);

const FREE_LIMIT = safeInt(
  Deno.env.get("AI_FREE_TIER_MONTHLY_LIMIT"),
  100,
  1,
  1_000_000,
);
const API_LIMIT = safeInt(
  Deno.env.get("AI_TEAM_TIER_MONTHLY_LIMIT"),
  5_000,
  1,
  1_000_000,
);
const TEAMS_LIMIT = safeInt(
  Deno.env.get("AI_ENTERPRISE_TIER_MONTHLY_LIMIT"),
  20_000,
  1,
  5_000_000,
);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "[ai-proxy] Missing required Supabase env vars. Ensure PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are set.",
  );
}

if (!ANTHROPIC_API_KEY) {
  console.error("[ai-proxy] Missing ANTHROPIC_API_KEY env var.");
}

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json(
      { error: "Method not allowed. Use POST." },
      { status: 405 },
    );
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(
        { error: "Server misconfigured: Supabase credentials are missing." },
        { status: 500 },
      );
    }

    if (!ANTHROPIC_API_KEY) {
      return json(
        { error: "Server misconfigured: Anthropic API key is missing." },
        { status: 500 },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(
        { error: "Missing or invalid Authorization header." },
        { status: 401 },
      );
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !user) {
      return json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await req.json()) as AiProxyRequestBody;
    const parseResult = parseAndValidateBody(body);

    if (!parseResult.ok) {
      return json({ error: parseResult.error }, { status: 400 });
    }

    const input = parseResult.value;
    const access = await resolveWorkspaceAccess(
      userClient,
      input.workspaceId,
      user.id,
    );

    if (!access) {
      return json(
        { error: "You do not have access to this workspace." },
        { status: 403 },
      );
    }

    if (access.role === "viewer") {
      return json(
        { error: "Workspace viewers cannot create AI generations." },
        { status: 403 },
      );
    }

    if (access.plan === "free" && input.tier > 1) {
      return json(
        {
          error:
            "This workspace plan supports Tier 1 only. Upgrade to use Tier 2–4 synthesis.",
        },
        { status: 402 },
      );
    }

    const monthStartIso = startOfMonthIso();
    const monthlyLimit = monthlyLimitForPlan(access.plan);

    const { count: usageCount, error: usageErr } = await adminClient
      .from("ai_generations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .gte("created_at", monthStartIso);

    if (usageErr) {
      return json(
        { error: `Failed usage lookup: ${usageErr.message}` },
        { status: 500 },
      );
    }

    if ((usageCount ?? 0) >= monthlyLimit) {
      return json(
        {
          error:
            "Monthly AI generation limit reached for this workspace plan.",
          code: "RATE_LIMIT_MONTHLY",
          limit: monthlyLimit,
          used: usageCount ?? 0,
        },
        { status: 429 },
      );
    }

    const model = modelForTier(input.tier);
    const system = buildSystemPrompt({
      tier: input.tier,
      customSystemPrompt: input.systemPrompt,
    });

    const userPrompt = buildUserPrompt(input.prompt, input.graphContext);

    const started = performance.now();
    const aiResponse = await anthropic.messages.create({
      model,
      max_tokens: input.maxTokens,
      temperature: input.temperature,
      system,
      messages: [{ role: "user", content: userPrompt }],
    });
    const latencyMs = Math.round(performance.now() - started);

    const outputText = flattenAnthropicText(aiResponse.content).trim();
    if (!outputText) {
      return json(
        { error: "AI response was empty." },
        { status: 502 },
      );
    }

    const tokensInput = aiResponse.usage?.input_tokens ?? 0;
    const tokensOutput = aiResponse.usage?.output_tokens ?? 0;

    const aiLogRow = {
      workspace_id: input.workspaceId,
      graph_id: input.graphId ?? null,
      plane_id: input.planeId ?? null,
      user_id: user.id,
      prompt: input.prompt,
      model,
      tier: input.tier,
      request_json: {
        prompt: input.prompt,
        tier: input.tier,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        systemPrompt: input.systemPrompt ?? null,
        graphContext: input.graphContext ?? null,
        metadata: input.metadata ?? {},
      },
      response_json: {
        id: aiResponse.id,
        model: aiResponse.model,
        role: aiResponse.role,
        stop_reason: aiResponse.stop_reason,
        stop_sequence: aiResponse.stop_sequence,
        content: aiResponse.content,
      },
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      nodes_spawned: estimateNodesSpawned(outputText),
      edges_spawned: estimateEdgesSpawned(outputText),
      latency_ms: latencyMs,
    };

    const { data: logData, error: logErr } = await adminClient
      .from("ai_generations")
      .insert(aiLogRow)
      .select("id")
      .single();

    if (logErr) {
      // Non-fatal for caller; we still return AI output.
      console.warn("[ai-proxy] Failed to write ai_generations row:", logErr);
    }

    return json({
      ok: true,
      data: {
        text: outputText,
        model,
        tier: input.tier,
        usage: {
          inputTokens: tokensInput,
          outputTokens: tokensOutput,
          totalTokens: tokensInput + tokensOutput,
        },
        stopReason: aiResponse.stop_reason ?? null,
        generationId: logData?.id ?? null,
        latencyMs,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown server error.";
    console.error("[ai-proxy] Unhandled error:", err);
    return json({ error: message }, { status: 500 });
  }
});

/* -------------------------------- Helpers -------------------------------- */

function json(body: unknown, init?: ResponseInit) {
  const status = init?.status ?? 200;
  const headers = {
    ...CORS_HEADERS,
    ...(init?.headers ?? {}),
  };
  return new Response(JSON.stringify(body), { status, headers });
}

function safeInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function startOfMonthIso(): string {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return first.toISOString();
}

function monthlyLimitForPlan(plan: WorkspacePlan): number {
  if (plan === "free") return FREE_LIMIT;
  if (plan === "kag_api") return API_LIMIT;
  if (plan === "kag_teams") return TEAMS_LIMIT;
  return 1_000_000_000; // enterprise default (effectively unlimited unless overridden)
}

function modelForTier(tier: Tier): string {
  return tier === 1 ? FAST_MODEL : DEFAULT_MODEL;
}

function parseAndValidateBody(body: AiProxyRequestBody):
  | {
      ok: true;
      value: {
        workspaceId: string;
        graphId: string | null;
        planeId: string | null;
        prompt: string;
        tier: Tier;
        maxTokens: number;
        temperature: number;
        systemPrompt: string | null;
        graphContext: Json | null;
        metadata: Record<string, Json>;
      };
    }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const workspaceId = String(body.workspaceId ?? "").trim();
  if (!workspaceId) {
    return { ok: false, error: "`workspaceId` is required." };
  }

  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) {
    return { ok: false, error: "`prompt` is required." };
  }

  if (prompt.length > MAX_PROMPT_CHARS) {
    return {
      ok: false,
      error: `Prompt too long (max ${MAX_PROMPT_CHARS} chars).`,
    };
  }

  const tierRaw = Number(body.tier ?? 1);
  const tier = normalizeTier(tierRaw);
  if (!tier) {
    return { ok: false, error: "`tier` must be 1, 2, 3, or 4." };
  }

  const maxTokens = Math.max(
    128,
    Math.min(MAX_TOKENS_CAP, Math.floor(Number(body.maxTokens ?? DEFAULT_MAX_TOKENS))),
  );

  const temperatureRaw = Number(body.temperature ?? DEFAULT_TEMPERATURE);
  const temperature = Number.isFinite(temperatureRaw)
    ? Math.max(0, Math.min(1, temperatureRaw))
    : DEFAULT_TEMPERATURE;

  const graphId = body.graphId ? String(body.graphId).trim() : null;
  const planeId = body.planeId ? String(body.planeId).trim() : null;

  const systemPrompt = body.systemPrompt
    ? String(body.systemPrompt).trim().slice(0, 4_000)
    : null;

  const graphContext = body.graphContext ?? null;
  const metadata =
    body.metadata && typeof body.metadata === "object"
      ? body.metadata
      : ({} as Record<string, Json>);

  return {
    ok: true,
    value: {
      workspaceId,
      graphId,
      planeId,
      prompt,
      tier,
      maxTokens,
      temperature,
      systemPrompt,
      graphContext,
      metadata,
    },
  };
}

function normalizeTier(value: number): Tier | null {
  if (value === 1 || value === 2 || value === 3 || value === 4) {
    return value;
  }
  return null;
}

async function resolveWorkspaceAccess(
  userClient: ReturnType<typeof createClient>,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceAccess | null> {
  const { data, error } = await userClient
    .from("workspace_members")
    .select(
      `
      role,
      workspace:workspaces (
        id,
        plan
      )
    `,
    )
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.workspace?.id) return null;

  const plan = (data.workspace.plan ?? "free") as WorkspacePlan;
  const role = data.role as WorkspaceAccess["role"];

  return {
    workspaceId: data.workspace.id,
    role,
    plan,
  };
}

function buildSystemPrompt(input: {
  tier: Tier;
  customSystemPrompt: string | null;
}): string {
  const base = [
    "You are BendScript's graph synthesis engine.",
    "Return concise, high-signal output that can be represented as graph nodes and typed edges.",
    "Edge kinds available: context, causal, temporal, associative, user.",
    "Node types available: normal, stargate (prefix stargate text with ⊛).",
  ];

  if (input.tier === 1) {
    base.push(
      "Tier 1: Provide a direct contextual response (one primary synthesis).",
    );
  } else if (input.tier === 2) {
    base.push(
      "Tier 2: Provide graph-aware synthesis with 2-4 semantically related concepts.",
    );
  } else if (input.tier === 3) {
    base.push(
      "Tier 3: Provide topic-to-graph synthesis with a compact hierarchy and edge labels.",
    );
  } else {
    base.push(
      "Tier 4: Include edge inference suggestions that connect new ideas to existing context.",
    );
  }

  if (input.customSystemPrompt) {
    base.push("Additional instruction:");
    base.push(input.customSystemPrompt);
  }

  return base.join("\n");
}

function buildUserPrompt(prompt: string, graphContext: Json | null): string {
  if (!graphContext) return prompt;

  let contextText = "";
  try {
    contextText = JSON.stringify(graphContext);
  } catch {
    contextText = "";
  }

  if (contextText.length > MAX_CONTEXT_CHARS) {
    contextText = contextText.slice(0, MAX_CONTEXT_CHARS) + "…";
  }

  return [
    "User prompt:",
    prompt,
    "",
    "Graph context (JSON):",
    contextText,
  ].join("\n");
}

function flattenAnthropicText(content: unknown): string {
  if (!Array.isArray(content)) return "";

  const parts: string[] = [];
  for (const block of content) {
    if (
      block &&
      typeof block === "object" &&
      "type" in block &&
      (block as { type?: string }).type === "text" &&
      "text" in block
    ) {
      const text = String((block as { text?: string }).text ?? "").trim();
      if (text) parts.push(text);
    }
  }

  return parts.join("\n\n").trim();
}

function estimateNodesSpawned(text: string): number {
  // Heuristic only; real count should be determined by downstream parser.
  const bullets = text.match(/^\s*[-*]\s+/gm)?.length ?? 0;
  const headers = text.match(/^\s{0,3}#{1,6}\s+/gm)?.length ?? 0;
  return Math.max(1, Math.min(12, bullets + headers || 1));
}

function estimateEdgesSpawned(text: string): number {
  // Heuristic based on relational verbs / arrows.
  const arrowCount = (text.match(/->|→/g) ?? []).length;
  const relCount =
    (text.match(/\b(causes|enables|depends on|relates to|precedes|follows)\b/gi) ?? [])
      .length;
  return Math.max(0, Math.min(20, arrowCount + relCount));
}
