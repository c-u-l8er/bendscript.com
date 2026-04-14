/**
 * Repository Ingestor — fetches repo files from GitHub and stores them
 * in Graphonomous via MCP `act(build_from_text)` calls.
 *
 * Smart file selection: prioritizes README, config files, and source code.
 * Skips binaries, lockfiles, and generated artifacts.
 */
import { callTool } from "./mcp-client.js";

// File patterns worth ingesting (order = priority)
const PRIORITY_FILES = [
  /^readme\.md$/i,
  /^readme$/i,
  /^package\.json$/,
  /^mix\.exs$/,
  /^cargo\.toml$/,
  /^pyproject\.toml$/,
  /^go\.mod$/,
  /^claude\.md$/i,
  /^contributing\.md$/i,
  /^architecture\.md$/i,
];

// Extensions we want to ingest
const GOOD_EXTENSIONS = new Set([
  "js", "ts", "jsx", "tsx", "svelte", "vue",
  "py", "rb", "rs", "go", "ex", "exs",
  "java", "kt", "scala", "cs", "fs",
  "c", "cpp", "h", "hpp",
  "md", "txt", "rst",
  "json", "yaml", "yml", "toml", "ini", "cfg",
  "sql", "graphql", "gql",
  "sh", "bash", "zsh",
  "html", "css", "scss", "less",
  "dockerfile", "makefile",
]);

// Files/dirs to always skip
const SKIP_PATTERNS = [
  /^node_modules\//,
  /^\.git\//,
  /^dist\//,
  /^build\//,
  /^_build\//,
  /^deps\//,
  /^vendor\//,
  /^\.next\//,
  /^\.svelte-kit\//,
  /^target\//,
  /\bpackage-lock\.json$/,
  /\byarn\.lock$/,
  /\bpnpm-lock\.yaml$/,
  /\bmix\.lock$/,
  /\bCargo\.lock$/,
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.wasm$/,
  /\.png$/, /\.jpg$/, /\.jpeg$/, /\.gif$/, /\.svg$/, /\.ico$/,
  /\.woff2?$/, /\.ttf$/, /\.eot$/,
  /\.pdf$/, /\.zip$/, /\.tar\.gz$/,
];

const MAX_FILE_SIZE = 50_000; // 50KB per file limit

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
 * Score a file path for ingestion priority (lower = higher priority).
 */
function filePriority(path) {
  const filename = path.split("/").pop().toLowerCase();
  for (let i = 0; i < PRIORITY_FILES.length; i++) {
    if (PRIORITY_FILES[i].test(filename)) return i;
  }
  // Source files in src/, lib/, app/ get medium priority
  if (/^(src|lib|app)\//.test(path)) return 100;
  // Config files at root
  if (!path.includes("/")) return 150;
  // Other files
  return 200;
}

/**
 * Filter and sort repo tree files for ingestion.
 */
function selectFiles(tree, maxFiles) {
  return tree
    .filter((entry) => {
      if (entry.type !== "blob") return false;
      if (entry.size > MAX_FILE_SIZE) return false;
      if (SKIP_PATTERNS.some((p) => p.test(entry.path))) return false;
      const ext = entry.path.split(".").pop().toLowerCase();
      const filename = entry.path.split("/").pop().toLowerCase();
      // Priority files always pass
      if (PRIORITY_FILES.some((p) => p.test(filename))) return true;
      // Dotfiles without extensions (Dockerfile, Makefile)
      if (GOOD_EXTENSIONS.has(filename)) return true;
      return GOOD_EXTENSIONS.has(ext);
    })
    .sort((a, b) => filePriority(a.path) - filePriority(b.path))
    .slice(0, maxFiles);
}

/**
 * Fetch file content from GitHub API.
 */
async function fetchFileContent(owner, repo, branch, filePath, signal) {
  const resp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
    { signal },
  );
  if (!resp.ok) throw new Error(`GitHub API ${resp.status} for ${filePath}`);
  const data = await resp.json();
  if (data.encoding === "base64") {
    return atob(data.content.replace(/\n/g, ""));
  }
  return data.content || "";
}

/**
 * Ingest selected repositories into Graphonomous.
 *
 * @param {object} opts
 * @param {Array<{ url, owner, repo, branch, tree? }>} opts.repos - Repositories to ingest
 * @param {{ url, authHeader, sessionId }} opts.graphConnection - Graphonomous MCP connection
 * @param {number} [opts.maxFilesPerRepo=30] - Max files to fetch per repo
 * @param {(msg: { role: string, content: string }) => void} opts.onMessage - Status callback
 * @param {AbortSignal} [opts.signal] - Cancellation signal
 * @returns {Promise<{ repos: Array, totalNodes: number, totalFiles: number }>}
 */
export async function ingestRepositories({
  repos,
  graphConnection,
  maxFilesPerRepo = 30,
  onMessage,
  signal,
}) {
  const emit = (role, content) => onMessage?.({ role, content });
  const results = [];
  let totalNodes = 0;
  let totalFiles = 0;

  for (const repo of repos) {
    signal?.throwIfAborted();
    emit("action-status", `Ingesting ${repo.owner}/${repo.repo}...`);

    // Get the file tree if not already available
    let tree = repo.tree;
    if (!tree || tree.length === 0) {
      emit("action-status", `Fetching file tree for ${repo.owner}/${repo.repo}...`);
      try {
        const resp = await fetch(
          `https://api.github.com/repos/${repo.owner}/${repo.repo}/git/trees/${repo.branch}?recursive=1`,
          { signal },
        );
        if (!resp.ok) throw new Error(`GitHub API ${resp.status}`);
        const data = await resp.json();
        tree = (data.tree || [])
          .filter((e) => e.type === "blob" || e.type === "tree")
          .map((e) => ({ path: e.path, type: e.type, size: e.size || 0 }));
      } catch (err) {
        emit("action-error", `Failed to fetch tree for ${repo.owner}/${repo.repo}: ${err.message}`);
        results.push({ repo: `${repo.owner}/${repo.repo}`, files: 0, nodes: 0, error: err.message });
        continue;
      }
    }

    // Select files to ingest
    const files = selectFiles(tree, maxFilesPerRepo);
    emit("action-status", `Selected ${files.length} files from ${repo.owner}/${repo.repo}`);

    let repoNodes = 0;
    let repoFiles = 0;

    for (let i = 0; i < files.length; i++) {
      signal?.throwIfAborted();
      const file = files[i];
      emit("action-status", `[${i + 1}/${files.length}] Fetching ${file.path}...`);

      try {
        const content = await fetchFileContent(repo.owner, repo.repo, repo.branch, file.path, signal);
        if (!content.trim()) continue;

        // Build content for Graphonomous store_node
        const nodeContent = [
          `# ${repo.owner}/${repo.repo} — ${file.path}`,
          `Repository: ${repo.url}`,
          `Branch: ${repo.branch}`,
          `File: ${file.path}`,
          "",
          content,
        ].join("\n");

        emit("action-status", `[${i + 1}/${files.length}] Storing ${file.path} in knowledge graph...`);

        const result = await graphCall(
          graphConnection,
          "act",
          {
            action: "store_node",
            content: nodeContent,
            node_type: "semantic",
            source: `github:${repo.owner}/${repo.repo}/${file.path}`,
            confidence: 0.8,
            metadata: JSON.stringify({
              repo_url: repo.url,
              repo_owner: repo.owner,
              repo_name: repo.repo,
              branch: repo.branch,
              file_path: file.path,
              ingested_at: new Date().toISOString(),
            }),
          },
          signal,
        );

        const stored = result?.status === "ok" || result?.node_id;
        const nodesCreated = stored ? 1 : 0;
        if (!stored) {
          emit("action-status", `Warning: store may have failed for ${file.path}`);
        }
        repoNodes += nodesCreated;
        repoFiles++;
        totalFiles++;
        totalNodes += nodesCreated;
      } catch (err) {
        if (err.name === "AbortError") throw err;
        emit("action-status", `Warning: skipped ${file.path} (${err.message})`);
      }
    }

    results.push({
      repo: `${repo.owner}/${repo.repo}`,
      branch: repo.branch,
      files: repoFiles,
      nodes: repoNodes,
    });

    emit("action-status", `Completed ${repo.owner}/${repo.repo}: ${repoFiles} files → ${repoNodes} nodes`);
  }

  // Summary
  emit("action-status", `Ingestion complete: ${totalFiles} files → ${totalNodes} nodes across ${repos.length} repo(s)`);

  return { repos: results, totalNodes, totalFiles };
}
