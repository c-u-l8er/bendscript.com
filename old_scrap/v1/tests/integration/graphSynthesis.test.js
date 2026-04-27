// ProjectAmp2/bendscript.com/tests/integration/graphSynthesis.test.js
import { describe, it, expect, vi } from "vitest";
import {
  buildGraphContext,
  callGraphSynthesis,
  materializeSynthesisForPlane,
} from "../../src/lib/ai/graphSynthesis.js";

function makeState() {
  return {
    version: 1,
    rootPlaneId: "plane_root",
    activePlaneId: "plane_root",
    planes: {
      plane_root: {
        id: "plane_root",
        nodes: [
          {
            id: "n1",
            text: "Alpha",
            type: "normal",
            x: 10,
            y: 20,
            pinned: false,
          },
          {
            id: "n2",
            text: "Beta",
            type: "stargate",
            x: 30,
            y: 40,
            pinned: true,
          },
          {
            id: "n3",
            text: "Gamma",
            type: "normal",
            x: 50,
            y: 60,
            pinned: false,
          },
        ],
        edges: [
          {
            id: "e1",
            a: "n1",
            b: "n2",
            props: { label: "causes", kind: "causal", strength: 4 },
          },
          {
            id: "e2",
            a: "n2",
            b: "n3",
            props: { label: "related", kind: "associative", strength: 2 },
          },
          {
            id: "e3",
            a: "n1",
            b: "outside",
            props: { label: "filtered", kind: "context", strength: 1 },
          },
        ],
      },
    },
  };
}

describe("graphSynthesis integration", () => {
  it("buildGraphContext extracts active-plane graph with limits and normalization", () => {
    const context = buildGraphContext(makeState(), {
      activePlaneId: "plane_root",
      maxNodes: 2,
      maxEdges: 10,
    });

    expect(context.version).toBe(1);
    expect(context.activePlaneId).toBe("plane_root");
    expect(context.nodeCount).toBe(3);
    expect(context.edgeCount).toBe(3);

    expect(context.nodes).toHaveLength(2);
    expect(context.nodes[0]).toMatchObject({
      id: "n1",
      text: "Alpha",
      type: "normal",
    });

    // only edges fully inside selected node subset are included
    expect(context.edges).toHaveLength(1);
    expect(context.edges[0]).toMatchObject({
      fromId: "n1",
      toId: "n2",
      kind: "causal",
      strength: 4,
    });
  });

  it("callGraphSynthesis posts graph context and returns normalized synthesis", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          synthesis: {
            tier: 2,
            summary: "Graph-aware response",
            nodes: [
              { id: "new_1", text: "New Concept", type: "normal", x: 1, y: 2 },
              { id: "new_2", text: "⊛ Deeper", type: "stargate" },
            ],
            edges: [
              {
                id: "edge_1",
                fromId: "new_1",
                toId: "new_2",
                label: "expands",
                kind: "context",
                strength: 3,
              },
            ],
          },
        }),
    });

    const result = await callGraphSynthesis({
      prompt: "Generate connected ideas",
      tier: 2,
      state: makeState(),
      activePlaneId: "plane_root",
      workspaceId: "ws_1",
      graphId: "g_1",
      fetchImpl,
      endpoint: "/api/ai",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchImpl.mock.calls[0];
    expect(endpoint).toBe("/api/ai");
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/json");

    const body = JSON.parse(init.body);
    expect(body.prompt).toBe("Generate connected ideas");
    expect(body.tier).toBe(2);
    expect(body.workspaceId).toBe("ws_1");
    expect(body.graphId).toBe("g_1");
    expect(body.context.activePlaneId).toBe("plane_root");
    expect(body.context.nodes.length).toBeGreaterThan(0);

    expect(result.ok).toBe(true);
    expect(result.tier).toBe(2);
    expect(result.summary).toBe("Graph-aware response");
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.nodes[1]).toMatchObject({
      id: "new_2",
      type: "stargate",
    });
  });

  it("callGraphSynthesis parses fenced JSON content payloads", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          content: [
            {
              type: "text",
              text: '```json\n{"tier":1,"summary":"ok","nodes":[{"text":"One"}],"edges":[]}\n```',
            },
          ],
        }),
    });

    const result = await callGraphSynthesis({
      prompt: "quick response",
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.tier).toBe(1);
    expect(typeof result.summary).toBe("string");
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it("callGraphSynthesis throws useful API error messages", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: "Rate limit exceeded" }),
    });

    await expect(
      callGraphSynthesis({
        prompt: "do something",
        fetchImpl,
      }),
    ).rejects.toThrow("Rate limit exceeded");
  });

  it("materializeSynthesisForPlane places nodes and injects parent edge", () => {
    const synthesis = {
      tier: 3,
      summary: "Topic map",
      nodes: [
        { id: "nA", text: "Alpha", type: "normal" },
        { id: "nB", text: "Beta", type: "stargate", x: 10, y: 20 },
      ],
      edges: [
        {
          id: "e1",
          fromIndex: 0,
          toIndex: 1,
          label: "links",
          kind: "associative",
          strength: 2,
        },
      ],
    };

    const output = materializeSynthesisForPlane({
      synthesis,
      parentNode: { id: "parent_1" },
      anchorX: 100,
      anchorY: 100,
      radius: 50,
    });

    expect(output.tier).toBe(3);
    expect(output.summary).toBe("Topic map");
    expect(output.nodes).toHaveLength(2);
    expect(output.edges).toHaveLength(2);

    // auto-placed (x/y were missing on first node)
    expect(output.nodes[0].x).toBeCloseTo(100, 6);
    expect(output.nodes[0].y).toBeCloseTo(50, 6);

    // preserved explicit x/y
    expect(output.nodes[1].x).toBe(10);
    expect(output.nodes[1].y).toBe(20);

    // prepended parent link
    expect(output.edges[0]).toMatchObject({
      fromId: "parent_1",
      toIndex: 0,
      kind: "context",
      label: "expands",
    });
  });
});
