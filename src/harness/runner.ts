// §8 round-trip harness runner.
// Loads the corpus, builds prompts, calls models, computes drift, emits report.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseAndNormalize } from "../parse.ts";
import type { Document } from "../types.ts";
import { computeDrift, median, p95 } from "./drift.ts";
import {
  type CorpusEntry,
  type ModelClient,
  type RunReport,
  type TaskClass,
  type Transcript,
  THRESHOLDS,
} from "./types.ts";

export const HARNESS_VERSION = "0.1.0";

export function loadCorpus(corpusDir: string): CorpusEntry[] {
  const files = readdirSync(corpusDir)
    .filter((f) => f.endsWith(".bend.json"))
    .sort();
  return files.map((file) => {
    const raw = readFileSync(join(corpusDir, file), "utf8");
    const document = parseAndNormalize(raw);
    return {
      file,
      document,
      raw,
      tasks: defaultTasksFor(file),
    };
  });
}

function defaultTasksFor(file: string): CorpusEntry["tasks"] {
  // Default task set; per-file overrides could be loaded from a sibling
  // .tasks.json if needed. v0.1 corpus uses these defaults.
  return {
    A: { question: "What is the main subject of this document?" },
    B: {
      instruction:
        "Add a paragraph block at the end of the document that says 'Appended.' — preserve all existing blocks, edges, and ids exactly.",
    },
    C: {
      instruction:
        "Add a top-level edge with predicate 'cites' from the document root (subject 'bend:<this-doc-id>') to the external URI 'https://example.com/source'. Preserve all existing edges.",
    },
  };
}

export function buildPrompt(entry: CorpusEntry, taskClass: TaskClass): string {
  const task =
    taskClass === "A"
      ? entry.tasks.A.question
      : taskClass === "B"
        ? entry.tasks.B.instruction
        : entry.tasks.C.instruction;
  const responseFormat =
    taskClass === "A"
      ? "Respond with one or two sentences answering the question. Do not produce JSON."
      : "Respond with the modified BendScript document as a single fenced JSON block (```json ... ```). Do not include any explanation outside the fence.";
  return [
    `TASK_CLASS: ${taskClass}`,
    `BENDSCRIPT_VERSION: 0.1`,
    "",
    "You are evaluating the BendScript Protocol — a graph-first JSON document format with typed inline link facets.",
    "",
    "<DOCUMENT_JSON>",
    entry.raw,
    "</DOCUMENT_JSON>",
    "",
    "TASK:",
    task,
    "",
    "RESPONSE FORMAT:",
    responseFormat,
  ].join("\n");
}

function extractJson(text: string): string | null {
  const fence = text.match(/```json\s*\n([\s\S]*?)\n```/);
  if (fence) return fence[1];
  const fenceLoose = text.match(/```\s*\n([\s\S]*?)\n```/);
  if (fenceLoose) return fenceLoose[1];
  // Bare JSON: try to find a top-level {...} object
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  return null;
}

export async function runOne(
  client: ModelClient,
  entry: CorpusEntry,
  taskClass: TaskClass,
): Promise<Transcript> {
  const prompt = buildPrompt(entry, taskClass);
  const { text, promptTokens, completionTokens } = await client.complete(prompt);
  const transcript: Transcript = {
    modelId: client.id,
    file: entry.file,
    taskClass,
    raw_response: text,
    promptTokens,
    completionTokens,
  };
  if (taskClass === "A") {
    transcript.answer = text.trim();
    return transcript;
  }
  const json = extractJson(text);
  if (!json) {
    transcript.parseError = "no JSON found in response";
    return transcript;
  }
  let result: Document;
  try {
    result = parseAndNormalize(json);
  } catch (err) {
    transcript.parseError = err instanceof Error ? err.message : String(err);
    return transcript;
  }
  transcript.parsedResult = result;
  transcript.drift = computeDrift(entry.document, result);
  return transcript;
}

export async function runHarness(opts: {
  corpus: CorpusEntry[];
  models: ModelClient[];
  classes?: TaskClass[];
  /** Per-class A faithfulness judge — if omitted, no judgment is made. */
  judge?: (entry: CorpusEntry, transcript: Transcript) => Promise<boolean>;
}): Promise<{ report: RunReport; transcripts: Transcript[] }> {
  const classes = opts.classes ?? (["A", "B", "C"] as TaskClass[]);
  const transcripts: Transcript[] = [];
  for (const model of opts.models) {
    for (const entry of opts.corpus) {
      for (const cls of classes) {
        const t = await runOne(model, entry, cls);
        if (cls === "A" && opts.judge) {
          t.answer_faithful = await opts.judge(entry, t);
        }
        transcripts.push(t);
      }
    }
  }
  const report = aggregate(transcripts, opts.models, opts.classes ?? classes);
  return { report, transcripts };
}

export function aggregate(
  transcripts: Transcript[],
  models: ModelClient[],
  classes: TaskClass[],
): RunReport {
  const results: RunReport["results"] = {};
  const failures: string[] = [];
  for (const m of models) {
    const own = transcripts.filter((t) => t.modelId === m.id);
    const driftsB = own
      .filter((t) => t.taskClass === "B" && t.drift)
      .map((t) => t.drift!.total);
    const driftsC = own
      .filter((t) => t.taskClass === "C" && t.drift)
      .map((t) => t.drift!.total);
    const aTranscripts = own.filter((t) => t.taskClass === "A");
    const aJudged = aTranscripts.filter((t) => t.answer_faithful !== undefined);
    const faithfulness =
      aJudged.length > 0
        ? aJudged.filter((t) => t.answer_faithful).length / aJudged.length
        : null;
    const bMed = median(driftsB);
    const bP95 = p95(driftsB);
    const cMed = median(driftsC);
    const cP95 = p95(driftsC);
    results[m.id] = {
      class_a_faithfulness: faithfulness,
      class_b_median_drift: bMed,
      class_b_p95_drift: bP95,
      class_c_median_drift: cMed,
      class_c_p95_drift: cP95,
      transcripts_path: `harness/runs/<timestamp>/${m.id}/`,
    };
    if (classes.includes("A") && faithfulness !== null && faithfulness < THRESHOLDS.CLASS_A_FAITHFULNESS_MIN) {
      failures.push(`${m.id}: class A faithfulness ${faithfulness.toFixed(3)} < ${THRESHOLDS.CLASS_A_FAITHFULNESS_MIN}`);
    }
    if (classes.includes("B")) {
      if (bMed > THRESHOLDS.CLASS_B_MEDIAN_MAX) failures.push(`${m.id}: class B median ${bMed.toFixed(3)} > ${THRESHOLDS.CLASS_B_MEDIAN_MAX}`);
      if (bP95 > THRESHOLDS.CLASS_B_P95_MAX) failures.push(`${m.id}: class B P95 ${bP95.toFixed(3)} > ${THRESHOLDS.CLASS_B_P95_MAX}`);
    }
    if (classes.includes("C")) {
      if (cMed > THRESHOLDS.CLASS_C_MEDIAN_MAX) failures.push(`${m.id}: class C median ${cMed.toFixed(3)} > ${THRESHOLDS.CLASS_C_MEDIAN_MAX}`);
      if (cP95 > THRESHOLDS.CLASS_C_P95_MAX) failures.push(`${m.id}: class C P95 ${cP95.toFixed(3)} > ${THRESHOLDS.CLASS_C_P95_MAX}`);
    }
  }
  return {
    harness_version: HARNESS_VERSION,
    ran_at: new Date().toISOString(),
    models: models.map((m) => m.id),
    results,
    verdict: failures.length === 0 ? "pass" : "fail",
    ...(failures.length > 0 ? { failures } : {}),
  };
}
