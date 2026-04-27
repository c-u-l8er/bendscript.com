<script>
  import { WORKSPACES } from "$lib/play/workspaces/index.js";

  let {
    selectedSchemaType = "ampersand",
    selectedExampleId = "",
    selectedFileKey = "",
    repositories = [],
    benchmarkRuns = [],
    currentRunCycles = [],
    onSelect,
    onLoadExample,
    onLoadJson,
    onLoadRepoFile,
    onLoadText,
    onImportRepo,
    onRemoveRepo,
    onSelectRun,
  } = $props();

  // Track which tree nodes are expanded
  let expanded = $state({
    "ws:ampersand-protocol": true,
    "ws:ampersand-protocol/examples": true,
    "repos": true,
    "benchmarks": true,
  });

  function toggle(key) {
    expanded = { ...expanded, [key]: !expanded[key] };
  }

  // Build a nested tree structure from flat repo file paths
  function buildRepoTree(tree) {
    const root = { children: {} };
    for (const entry of tree) {
      const parts = entry.path.split("/");
      let node = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!node.children[part]) {
          node.children[part] = {
            name: part,
            path: parts.slice(0, i + 1).join("/"),
            type: i === parts.length - 1 ? entry.type : "tree",
            size: entry.size,
            children: {},
          };
        }
        node = node.children[part];
      }
    }
    return root.children;
  }

  // Get sorted children: folders first, then files, alphabetical
  function sortedChildren(children) {
    return Object.values(children).sort((a, b) => {
      if (a.type === "tree" && b.type !== "tree") return -1;
      if (a.type !== "tree" && b.type === "tree") return 1;
      return a.name.localeCompare(b.name);
    });
  }

  function formatTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatScore(val) {
    return typeof val === "number" ? val.toFixed(2) : "\u2014";
  }

  // Compute mean score for a cycle
  function cycleMeanScore(cycle) {
    const vals = Object.values(cycle.scores || {}).filter((v) => typeof v === "number");
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
</script>

<div class="file-tree">
  <div class="ft-header">WORKSPACES</div>

  {#each WORKSPACES as ws}
    {@const wsKey = `ws:${ws.id}`}
    {@const hasSchemas = ws.schemaFiles.length > 0}
    {@const hasExamples = ws.examples.length > 0}
    {@const hasActions = ws.actions?.length > 0}

    <!-- Workspace folder -->
    <button
      class="ft-row ft-folder depth-0"
      class:demo={ws.isDemo}
      onclick={() => toggle(wsKey)}
      title={ws.description}
    >
      <span class="ft-chevron" class:open={expanded[wsKey]}></span>
      <span class="ft-icon ft-icon-folder" class:open={expanded[wsKey]}></span>
      <span class="ft-name">{ws.id}</span>
    </button>

    {#if expanded[wsKey]}
      <!-- meta.json -->
      <button
        class="ft-row ft-file depth-1 ft-meta"
        class:selected={selectedFileKey === `${ws.id}/meta.json`}
        onclick={() => onLoadJson(`${ws.id}/meta.json`, { label: ws.label, description: ws.description, isDemo: ws.isDemo, order: ws.order })}
      >
        <span class="ft-icon ft-icon-json"></span>
        <span class="ft-name">meta.json</span>
      </button>

      <!-- schemas/ folder -->
      {#if hasSchemas}
        <button
          class="ft-row ft-folder depth-1"
          onclick={() => toggle(`${wsKey}/schemas`)}
        >
          <span class="ft-chevron" class:open={expanded[`${wsKey}/schemas`]}></span>
          <span class="ft-icon ft-icon-folder" class:open={expanded[`${wsKey}/schemas`]}></span>
          <span class="ft-name">schemas</span>
        </button>

        {#if expanded[`${wsKey}/schemas`]}
          {#each ws.schemaFiles as sf}
            <button
              class="ft-row ft-file depth-2 ft-schema"
              class:selected={selectedFileKey === `${ws.id}/schemas/${sf.filename}`}
              onclick={() => onLoadJson(`${ws.id}/schemas/${sf.filename}`, sf.data)}
            >
              <span class="ft-icon ft-icon-schema"></span>
              <span class="ft-name">{sf.filename}</span>
            </button>
          {/each}
        {/if}
      {/if}

      <!-- examples/ folder -->
      {#if hasExamples}
        <button
          class="ft-row ft-folder depth-1"
          onclick={() => toggle(`${wsKey}/examples`)}
        >
          <span class="ft-chevron" class:open={expanded[`${wsKey}/examples`]}></span>
          <span class="ft-icon ft-icon-folder" class:open={expanded[`${wsKey}/examples`]}></span>
          <span class="ft-name">examples</span>
        </button>

        {#if expanded[`${wsKey}/examples`]}
          {#each ws.examples as ex}
            <button
              class="ft-row ft-file depth-2"
              class:selected={selectedExampleId === ex.id}
              onclick={() => onLoadExample(ex.id)}
            >
              <span class="ft-icon ft-icon-json"></span>
              <span class="ft-name">{ex.filename}</span>
            </button>
          {/each}
        {/if}
      {/if}

      <!-- actions.json -->
      {#if hasActions}
        <button
          class="ft-row ft-file depth-1 ft-action"
          class:selected={selectedFileKey === `${ws.id}/actions.json`}
          onclick={() => onLoadJson(`${ws.id}/actions.json`, ws.actions)}
        >
          <span class="ft-icon ft-icon-action"></span>
          <span class="ft-name">actions.json</span>
        </button>
      {/if}
    {/if}
  {/each}

  <!-- REPOSITORIES section -->
  <div class="ft-header ft-header-section">
    REPOSITORIES
    <button class="ft-import-btn" onclick={onImportRepo} title="Import repository">+</button>
  </div>

  {#if repositories.length === 0}
    <div class="ft-empty">No repositories imported</div>
  {/if}

  {#each repositories as repo}
    {@const repoKey = `repo:${repo.owner}/${repo.repo}`}
    {@const repoTree = buildRepoTree(repo.tree || [])}

    <button
      class="ft-row ft-folder depth-0 ft-repo"
      onclick={() => toggle(repoKey)}
      title={`${repo.url} (${repo.branch})`}
    >
      <span class="ft-chevron" class:open={expanded[repoKey]}></span>
      <span class="ft-icon ft-icon-repo"></span>
      <span class="ft-name ft-repo-name">{repo.owner}/{repo.repo}</span>
      <span
        class="ft-remove-btn"
        role="button"
        tabindex="0"
        onclick={(e) => { e.stopPropagation(); onRemoveRepo?.(repo); }}
        onkeydown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onRemoveRepo?.(repo); } }}
        title="Remove repository"
      >&times;</span>
    </button>

    {#if expanded[repoKey]}
      <div class="ft-repo-branch depth-1">
        <span class="ft-branch-icon"></span>
        <span class="ft-branch-label">{repo.branch}</span>
      </div>

      {#each sortedChildren(repoTree) as child}
        {@const childKey = `${repoKey}/${child.path}`}
        {#if child.type === "tree"}
          <button
            class="ft-row ft-folder depth-1"
            onclick={() => toggle(childKey)}
          >
            <span class="ft-chevron" class:open={expanded[childKey]}></span>
            <span class="ft-icon ft-icon-folder" class:open={expanded[childKey]}></span>
            <span class="ft-name">{child.name}</span>
          </button>

          {#if expanded[childKey]}
            {#each sortedChildren(child.children) as grandchild}
              {@const gcKey = `${repoKey}/${grandchild.path}`}
              {#if grandchild.type === "tree"}
                <button
                  class="ft-row ft-folder depth-2"
                  onclick={() => toggle(gcKey)}
                >
                  <span class="ft-chevron" class:open={expanded[gcKey]}></span>
                  <span class="ft-icon ft-icon-folder" class:open={expanded[gcKey]}></span>
                  <span class="ft-name">{grandchild.name}</span>
                </button>

                {#if expanded[gcKey]}
                  {#each sortedChildren(grandchild.children) as ggchild}
                    {#if ggchild.type === "blob"}
                      <button
                        class="ft-row ft-file depth-3"
                        class:selected={selectedFileKey === `${repoKey}/${ggchild.path}`}
                        onclick={() => onLoadRepoFile?.(repo, ggchild.path)}
                      >
                        <span class="ft-icon ft-icon-code"></span>
                        <span class="ft-name">{ggchild.name}</span>
                      </button>
                    {:else}
                      <button
                        class="ft-row ft-folder depth-3"
                        onclick={() => toggle(`${repoKey}/${ggchild.path}`)}
                        title="Deeper nesting — click to expand"
                      >
                        <span class="ft-chevron" class:open={expanded[`${repoKey}/${ggchild.path}`]}></span>
                        <span class="ft-icon ft-icon-folder" class:open={expanded[`${repoKey}/${ggchild.path}`]}></span>
                        <span class="ft-name">{ggchild.name}</span>
                      </button>
                    {/if}
                  {/each}
                {/if}
              {:else}
                <button
                  class="ft-row ft-file depth-2"
                  class:selected={selectedFileKey === `${repoKey}/${grandchild.path}`}
                  onclick={() => onLoadRepoFile?.(repo, grandchild.path)}
                >
                  <span class="ft-icon ft-icon-code"></span>
                  <span class="ft-name">{grandchild.name}</span>
                </button>
              {/if}
            {/each}
          {/if}
        {:else}
          <button
            class="ft-row ft-file depth-1"
            class:selected={selectedFileKey === `${repoKey}/${child.path}`}
            onclick={() => onLoadRepoFile?.(repo, child.path)}
          >
            <span class="ft-icon ft-icon-code"></span>
            <span class="ft-name">{child.name}</span>
          </button>
        {/if}
      {/each}
    {/if}
  {/each}

  <!-- BENCHMARKS section -->
  <div class="ft-header ft-header-section">
    BENCHMARKS
    {#if benchmarkRuns.length > 0}
      <span class="ft-count-badge">{benchmarkRuns.length}</span>
    {/if}
  </div>

  {#if benchmarkRuns.length === 0 && currentRunCycles.length === 0}
    <div class="ft-empty">No benchmark results yet</div>
  {/if}

  {#each [...benchmarkRuns].reverse() as run}
    {@const runKey = `bench:${run.id}`}
    {@const meanScore = run.leaderboard?.length > 0
      ? (run.leaderboard.reduce((a, d) => a + d.mean, 0) / run.leaderboard.length)
      : null}

    <!-- Run folder -->
    <button
      class="ft-row ft-folder depth-0 ft-bench-run"
      class:failed={!run.success}
      class:live={run.live}
      onclick={() => { toggle(runKey); onSelectRun?.(run); }}
      title={`${run.label} — ${formatTime(run.completedAt)}`}
    >
      <span class="ft-chevron" class:open={expanded[runKey]}></span>
      <span class="ft-icon ft-icon-bench"></span>
      {#if run.live}<span class="ft-running-dot"></span>{/if}
      <span class="ft-name ft-bench-name">{run.label}</span>
      {#if meanScore !== null}
        <span class="ft-score-badge" class:good={meanScore >= 0.7} class:mid={meanScore >= 0.4 && meanScore < 0.7} class:low={meanScore < 0.4}>
          {formatScore(meanScore)}
        </span>
      {/if}
    </button>

    {#if expanded[runKey]}
      <!-- Leaderboard -->
      {#if run.leaderboard?.length > 0}
        <button
          class="ft-row ft-file depth-1 ft-bench-item"
          class:selected={selectedFileKey === `${runKey}/leaderboard`}
          onclick={() => onLoadJson(`${runKey}/leaderboard`, {
            _type: "leaderboard",
            systemId: run.systemId,
            judgeModel: run.judgeModel,
            cycles: run.cycles.length,
            completedAt: new Date(run.completedAt).toISOString(),
            dimensions: run.leaderboard.map((d) => ({
              rank: run.leaderboard.indexOf(d) + 1,
              dimension: d.label,
              mean: +d.mean.toFixed(3),
              min: +d.min.toFixed(3),
              max: +d.max.toFixed(3),
              trend: +(d.trend || 0).toFixed(3),
              samples: d.samples,
              history: d.history?.map((v) => +v.toFixed(3)),
            })),
          })}
        >
          <span class="ft-icon ft-icon-leaderboard"></span>
          <span class="ft-name">leaderboard.json</span>
        </button>
      {/if}

      <!-- Report (from last cycle) -->
      {#if run.cycles.length > 0}
        {@const lastCycle = run.cycles[run.cycles.length - 1]}
        {#if lastCycle.reportRaw}
          <button
            class="ft-row ft-file depth-1 ft-bench-item"
            class:selected={selectedFileKey === `${runKey}/report`}
            onclick={() => onLoadJson(`${runKey}/report`, {
              _type: "diagnostic_report",
              systemId: run.systemId,
              cycle: lastCycle.cycle,
              ...lastCycle.reportRaw,
            })}
          >
            <span class="ft-icon ft-icon-report"></span>
            <span class="ft-name">report.json</span>
          </button>
        {/if}
      {/if}

      <!-- Cycles folder -->
      <button
        class="ft-row ft-folder depth-1"
        onclick={() => toggle(`${runKey}/cycles`)}
      >
        <span class="ft-chevron" class:open={expanded[`${runKey}/cycles`]}></span>
        <span class="ft-icon ft-icon-folder" class:open={expanded[`${runKey}/cycles`]}></span>
        <span class="ft-name">cycles ({run.cycles.length})</span>
      </button>

      {#if expanded[`${runKey}/cycles`]}
        {#each run.cycles as cycle}
          {@const cycleKey = `${runKey}/cycle-${cycle.cycle}`}
          {@const mean = cycleMeanScore(cycle)}

          <button
            class="ft-row ft-folder depth-2 ft-bench-cycle"
            onclick={() => toggle(cycleKey)}
          >
            <span class="ft-chevron" class:open={expanded[cycleKey]}></span>
            <span class="ft-icon ft-icon-cycle"></span>
            <span class="ft-name">cycle {cycle.cycle}</span>
            {#if mean !== null}
              <span class="ft-score-badge ft-score-sm" class:good={mean >= 0.7} class:mid={mean >= 0.4 && mean < 0.7} class:low={mean < 0.4}>
                {formatScore(mean)}
              </span>
            {/if}
          </button>

          {#if expanded[cycleKey]}
            <!-- Cycle scores -->
            <button
              class="ft-row ft-file depth-3 ft-bench-item"
              class:selected={selectedFileKey === `${cycleKey}/scores`}
              onclick={() => onLoadJson(`${cycleKey}/scores`, {
                _type: "cycle_scores",
                cycle: cycle.cycle,
                timestamp: new Date(cycle.timestamp).toISOString(),
                scenarioCount: cycle.scenarios,
                transcriptCount: cycle.transcripts,
                scores: Object.fromEntries(
                  Object.entries(cycle.scores || {}).map(([k, v]) => [k, typeof v === "number" ? +v.toFixed(3) : v])
                ),
              })}
            >
              <span class="ft-icon ft-icon-scores"></span>
              <span class="ft-name">scores.json</span>
            </button>

            <!-- Transcripts -->
            {#if cycle.transcriptData?.length > 0}
              <button
                class="ft-row ft-folder depth-3"
                onclick={() => toggle(`${cycleKey}/transcripts`)}
              >
                <span class="ft-chevron" class:open={expanded[`${cycleKey}/transcripts`]}></span>
                <span class="ft-icon ft-icon-folder" class:open={expanded[`${cycleKey}/transcripts`]}></span>
                <span class="ft-name">transcripts ({cycle.transcriptData.length})</span>
              </button>

              {#if expanded[`${cycleKey}/transcripts`]}
                {#each cycle.transcriptData as td, ti}
                  {@const tdKey = `${cycleKey}/transcript-${ti}`}

                  <button
                    class="ft-row ft-folder depth-4 ft-bench-transcript"
                    onclick={() => toggle(tdKey)}
                  >
                    <span class="ft-chevron" class:open={expanded[tdKey]}></span>
                    <span class="ft-icon ft-icon-transcript"></span>
                    <span class="ft-name">{td.scenarioName || `transcript-${ti}`}</span>
                    {#if td.error}
                      <span class="ft-error-badge">err</span>
                    {/if}
                  </button>

                  {#if expanded[tdKey]}
                    <!-- Full transcript content -->
                    <button
                      class="ft-row ft-file depth-5 ft-bench-item"
                      class:selected={selectedFileKey === `${tdKey}/content`}
                      onclick={() => onLoadJson(`${tdKey}/content`, {
                        _type: "transcript",
                        transcriptId: td.transcriptId,
                        scenarioId: td.scenarioId,
                        scenarioName: td.scenarioName,
                        formattedText: td.formattedText,
                        raw: td.content,
                      })}
                    >
                      <span class="ft-icon ft-icon-json"></span>
                      <span class="ft-name">transcript.json</span>
                    </button>

                    <!-- Judgments -->
                    {#if td.judgments?.length > 0}
                      <button
                        class="ft-row ft-file depth-5 ft-bench-item"
                        class:selected={selectedFileKey === `${tdKey}/judgments`}
                        onclick={() => onLoadJson(`${tdKey}/judgments`, {
                          _type: "judgments",
                          transcriptId: td.transcriptId,
                          scenarioName: td.scenarioName,
                          dimensions: td.judgments.map((j) => ({
                            dimension: j.dimension,
                            score: +j.composite_score.toFixed(3),
                            evidence: j.evidence,
                          })),
                        })}
                      >
                        <span class="ft-icon ft-icon-scores"></span>
                        <span class="ft-name">judgments.json</span>
                      </button>
                    {/if}

                    <!-- Markdown transcript with LLM reasoning -->
                    {#if td.markdown}
                      <button
                        class="ft-row ft-file depth-5 ft-bench-item ft-bench-md"
                        class:selected={selectedFileKey === `${tdKey}/transcript-md`}
                        onclick={() => onLoadText?.(`${tdKey}/transcript-md`, td.markdown)}
                      >
                        <span class="ft-icon ft-icon-md"></span>
                        <span class="ft-name">transcript.md</span>
                      </button>
                    {/if}
                  {/if}
                {/each}
              {/if}
            {/if}
          {/if}
        {/each}
      {/if}
    {/if}
  {/each}
</div>

<style>
  .file-tree {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    font-size: 13px;
    line-height: 1;
    user-select: none;
    padding: 4px 0;
  }

  .ft-header {
    padding: 6px 12px 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: #888;
  }

  .ft-header-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 10px;
  }

  .ft-import-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: transparent;
    color: #888;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  .ft-import-btn:hover {
    color: #10b981;
    border-color: #10b981;
  }

  .ft-count-badge {
    font-size: 9px;
    font-weight: 700;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    border-radius: 999px;
    background: #f59e0b;
    color: #000;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .ft-empty {
    padding: 6px 12px 6px 24px;
    font-size: 11px;
    color: #666;
    font-style: italic;
  }

  .ft-running-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    flex-shrink: 0;
    animation: pulse-dot 1.2s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .ft-bench-run.live .ft-bench-name {
    color: #10b981;
  }

  /* ── Row base ── */
  .ft-row {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    height: 22px;
    padding: 0 8px;
    border: none;
    background: transparent;
    color: #ccc;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
  }
  .ft-row:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  /* ── Depth indentation ── */
  .depth-0 { padding-left: 8px; }
  .depth-1 { padding-left: 24px; }
  .depth-2 { padding-left: 40px; }
  .depth-3 { padding-left: 56px; }
  .depth-4 { padding-left: 72px; }
  .depth-5 { padding-left: 88px; }

  /* ── Chevron ── */
  .ft-chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    font-size: 10px;
    color: #888;
    transition: transform 0.1s ease;
  }
  .ft-chevron::before {
    content: "\25B8";
  }
  .ft-chevron.open {
    transform: rotate(90deg);
  }

  /* ── Icons ── */
  .ft-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    font-size: 14px;
  }

  .ft-icon-folder::before {
    content: "\1F4C1";
    font-size: 13px;
    filter: saturate(0.7);
  }
  .ft-icon-folder.open::before {
    content: "\1F4C2";
  }

  .ft-icon-json::before {
    content: "{ }";
    font-size: 8px;
    font-weight: 700;
    color: #e8ab53;
    letter-spacing: -1px;
  }

  .ft-icon-schema::before {
    content: "{ }";
    font-size: 8px;
    font-weight: 700;
    color: #56b6c2;
    letter-spacing: -1px;
  }

  .ft-icon-action::before {
    content: "\25B6";
    font-size: 9px;
    color: #10b981;
  }

  .ft-icon-repo::before {
    content: "\2693";
    font-size: 12px;
    color: #a78bfa;
  }

  .ft-icon-code::before {
    content: "\2022";
    font-size: 10px;
    color: #888;
  }

  .ft-icon-bench::before {
    content: "\25C8";
    font-size: 11px;
    color: #f59e0b;
  }

  .ft-icon-leaderboard::before {
    content: "\2261";
    font-size: 13px;
    font-weight: 700;
    color: #f59e0b;
  }

  .ft-icon-report::before {
    content: "\25A3";
    font-size: 11px;
    color: #60a5fa;
  }

  .ft-icon-cycle::before {
    content: "\25CB";
    font-size: 10px;
    color: #f59e0b;
  }

  .ft-icon-scores::before {
    content: "\2605";
    font-size: 10px;
    color: #f59e0b;
  }

  .ft-icon-transcript::before {
    content: "\25A1";
    font-size: 10px;
    color: #94a3b8;
  }

  .ft-icon-md::before {
    content: "M";
    font-size: 9px;
    font-weight: 800;
    color: #60a5fa;
    font-style: italic;
  }

  .ft-bench-md .ft-name {
    color: #60a5fa;
  }

  .ft-file.ft-action .ft-name {
    color: #10b981;
  }

  /* ── Name text ── */
  .ft-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Folder styling ── */
  .ft-folder .ft-name {
    font-weight: 600;
  }
  .ft-folder.demo .ft-name {
    color: #ff6d5a;
  }

  /* ── Repo styling ── */
  .ft-repo .ft-repo-name {
    color: #a78bfa;
    flex: 1;
    min-width: 0;
  }

  .ft-remove-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: none;
    background: transparent;
    color: #666;
    font-size: 14px;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    line-height: 1;
    border-radius: 3px;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .ft-remove-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.12);
  }

  .ft-repo-branch {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 18px;
    padding: 0 8px;
    padding-left: 24px;
    font-size: 10px;
    color: #666;
  }

  .ft-branch-icon::before {
    content: "\2192";
    font-size: 9px;
  }

  /* ── Benchmark styling ── */
  .ft-bench-run .ft-bench-name {
    color: #f59e0b;
    flex: 1;
    min-width: 0;
  }
  .ft-bench-run.failed .ft-bench-name {
    color: #f87171;
  }

  .ft-score-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 999px;
    flex-shrink: 0;
    line-height: 1.2;
  }
  .ft-score-badge.good {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }
  .ft-score-badge.mid {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }
  .ft-score-badge.low {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }
  .ft-score-sm {
    font-size: 8px;
    padding: 0 4px;
  }

  .ft-error-badge {
    font-size: 8px;
    font-weight: 700;
    padding: 0 4px;
    border-radius: 999px;
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    flex-shrink: 0;
  }

  .ft-bench-item .ft-name {
    color: #94a3b8;
  }

  /* ── File styling ── */
  .ft-file .ft-name {
    font-weight: 400;
  }
  .ft-file.ft-meta .ft-name {
    color: #999;
  }
  .ft-file.ft-schema .ft-name {
    color: #56b6c2;
  }

  /* ── Selected state ── */
  .ft-file.selected {
    background: rgba(255, 109, 90, 0.12);
  }
  .ft-file.selected .ft-name {
    color: #ff6d5a;
    font-weight: 600;
  }
</style>
