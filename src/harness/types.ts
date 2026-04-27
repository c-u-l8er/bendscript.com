// §8 round-trip harness types.
// The harness is independent of any specific LLM provider — it talks to
// a `ModelClient` interface that any provider can implement.

import type { Document } from "../types.ts";

export type TaskClass = "A" | "B" | "C";

export type CorpusEntry = {
  /** filename, e.g. "01-plain-prose.bend.json" */
  file: string;
  /** parsed-and-normalized document */
  document: Document;
  /** raw on-disk JSON text (for prompts that show literal JSON) */
  raw: string;
  /** instruction set for each task class */
  tasks: {
    A: { question: string };
    B: { instruction: string };
    C: { instruction: string };
  };
};

/** A single transcript: one model + one document + one task class. */
export type Transcript = {
  modelId: string;
  file: string;
  taskClass: TaskClass;
  promptTokens?: number;
  completionTokens?: number;
  /** raw text returned by the model */
  raw_response: string;
  /** parse error if the model produced invalid JSON / invalid BendScript */
  parseError?: string;
  /** Class A: the answer text. Class B/C: parsed result document. */
  parsedResult?: Document;
  /** answer text for Class A */
  answer?: string;
  /** computed drift, present if parsing succeeded for B/C */
  drift?: DriftScore;
  /** answer faithfulness for Class A — present after judge runs */
  answer_faithful?: boolean;
};

/** Per-component drift values, all in [0, 1]. */
export type DriftComponents = {
  block_structure: number;
  edge_preservation: number;
  span_coverage: number;
  mark_fidelity: number;
  vocabulary_integrity: number;
};

export type DriftScore = {
  components: DriftComponents;
  /** weighted sum, in [0, 1] */
  total: number;
};

/** Pluggable model interface — any provider can implement this. */
export interface ModelClient {
  readonly id: string;
  /**
   * Send a prompt to the model. Returns raw text response.
   * The harness does not handle retries, timeouts, or rate limiting —
   * those are the implementation's concern.
   */
  complete(prompt: string): Promise<{ text: string; promptTokens?: number; completionTokens?: number }>;
}

export type RunReport = {
  harness_version: string;
  ran_at: string;
  models: string[];
  results: Record<
    string,
    {
      class_a_faithfulness: number | null; // null if no judge configured
      class_b_median_drift: number;
      class_b_p95_drift: number;
      class_c_median_drift: number;
      class_c_p95_drift: number;
      transcripts_path: string;
    }
  >;
  verdict: "pass" | "fail";
  /** When verdict is "fail", lists the thresholds that failed */
  failures?: string[];
};

/** §8.5 thresholds. */
export const THRESHOLDS = {
  CLASS_A_FAITHFULNESS_MIN: 0.9,
  CLASS_B_MEDIAN_MAX: 0.05,
  CLASS_B_P95_MAX: 0.2,
  CLASS_C_MEDIAN_MAX: 0.1,
  CLASS_C_P95_MAX: 0.3,
} as const;

/** §8.4 component weights. Must sum to 1.0. */
export const DRIFT_WEIGHTS: DriftComponents = {
  block_structure: 0.25,
  edge_preservation: 0.3,
  span_coverage: 0.2,
  mark_fidelity: 0.1,
  vocabulary_integrity: 0.15,
};
