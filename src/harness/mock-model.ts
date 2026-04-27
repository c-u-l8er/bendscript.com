// A deterministic mock LLM client for testing the harness mechanics.
// Does NOT call any external API. Returns canned responses based on the
// task class. Used to verify the harness correctly:
//   - parses model output as BendScript
//   - computes drift between before/after
//   - aggregates median/P95 across documents
//   - emits a valid run report

import { parseAndNormalize } from "../parse.ts";
import { serialize } from "../serialize.ts";
import type { Document } from "../types.ts";
import type { ModelClient, TaskClass } from "./types.ts";

export type MockMode =
  /** Returns the input document unchanged — minimum drift. */
  | { mode: "identity" }
  /** Returns the input with one span text edited — small drift. */
  | { mode: "small-edit" }
  /** Returns garbage text — parse error. */
  | { mode: "garbage" }
  /** Returns input with all edges stripped — high drift. */
  | { mode: "lossy" };

export class MockModel implements ModelClient {
  constructor(
    public readonly id: string,
    private readonly mode: MockMode,
  ) {}

  async complete(prompt: string): Promise<{ text: string }> {
    // Detect task class from the prompt header (the harness includes a
    // marker line that mock can dispatch on).
    const taskMatch = prompt.match(/^TASK_CLASS:\s*([ABC])/m);
    const taskClass = (taskMatch?.[1] ?? "B") as TaskClass;
    const docMatch = prompt.match(/<DOCUMENT_JSON>\n([\s\S]*?)\n<\/DOCUMENT_JSON>/);
    if (!docMatch) {
      return { text: this.mode.mode === "garbage" ? "(no document found)" : "{}" };
    }
    const inputText = docMatch[1];
    if (this.mode.mode === "garbage") {
      return { text: "I cannot do that." };
    }
    if (taskClass === "A") {
      return { text: "The document discusses content present in the document." };
    }
    let doc: Document;
    try {
      doc = parseAndNormalize(inputText);
    } catch {
      return { text: "{}" };
    }
    let modified: Document = doc;
    if (this.mode.mode === "small-edit") {
      modified = applyTinyEdit(doc);
    } else if (this.mode.mode === "lossy") {
      modified = { ...doc, edges: [] };
    }
    return { text: serialize(modified) };
  }
}

function applyTinyEdit(doc: Document): Document {
  const cloned = JSON.parse(JSON.stringify(doc)) as Document;
  function visit(blocks: any[]): boolean {
    for (const b of blocks) {
      if (b.spans && b.spans.length > 0) {
        for (const s of b.spans) {
          if (typeof s.text === "string" && s.text.length > 0) {
            s.text = s.text + " (edited)";
            return true;
          }
        }
      }
      if (b.blocks && visit(b.blocks)) return true;
      if (b.items && visit(b.items)) return true;
    }
    return false;
  }
  visit(cloned.blocks);
  return cloned;
}
