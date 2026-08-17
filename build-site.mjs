/* ==========================================================================
   bendscript.com site build.

   The landing page is GENERATED from records/surface.json and from the
   library itself. Every id, block count and edge count that reaches the page
   is RECOMPUTED here by importing ./dist/index.js — the same compiled artifact
   that is published to npm — and parsing the corpus files from disk. If a
   recomputed value disagrees with the frozen record in records/corpus.json,
   this build throws and nothing is emitted.

   The direction of dependency is the whole point (SHELL.md §4.1). The page
   cell is COMPUTED; the record is what it is CHECKED AGAINST. If the page
   were the source, nothing could audit it.

   Run it through the gate, never on its own:   npm run test:launch
   ========================================================================== */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";

const read = (p) => readFileSync(p, "utf8");
const J = (p) => JSON.parse(read(p));

const surface = J("./records/surface.json");
const pkg = J("./package.json");
const CORPUS_DIR = "./test-corpus/v0.1";
const APP_PATH = "/app/";
const SPEC_URL = "https://docs.ampersandboxdesign.com/#/bendscript.com/docs/spec/README.md";
const RUNGS = ["spec", "in_tree", "live_local", "live_deployed", "external"];

if (!existsSync("./dist/index.js")) {
    throw new Error(
        "BUILD REFUSED — ./dist/index.js is missing. The page's numbers come from the compiled library, not from prose; run `npm run build` first. (test:launch does this for you.)"
    );
}
const B = await import("./dist/index.js");

/* ---------- release identity: one version, or no build ---------- */
if (pkg.version !== surface.version) {
    throw new Error(
        `release identity: package.json ${pkg.version} != records/surface.json ${surface.version}`
    );
}
const STAMP = `BENDSCRIPT v${surface.version} · RECORDS ${surface.verified_at}`;

const esc = (s) =>
    String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

/* ==========================================================================
   THE CONSISTENCY GATE
   Reparse the corpus with the library and compare against the frozen record.
   ========================================================================== */
const files = readdirSync(CORPUS_DIR).filter((f) => f.endsWith(".bend.json")).sort();
const computed = [];
for (const f of files) {
    const doc = B.parseAndNormalize(read(`${CORPUS_DIR}/${f}`));
    B.validate(doc);
    const id = await B.computeDocumentId(doc);
    /* §8.1.1 is the protocol's own strict guarantee, so the build exercises it
       rather than citing the test suite for it:
           parse(serialize(parse(d))) === parse(d)
       Re-serialised, re-parsed, and the id recomputed. If the two ids differ
       the guarantee is false on this machine and no page is emitted. */
    const again = B.parseAndNormalize(B.serialize(doc));
    const id2 = await B.computeDocumentId(again);
    computed.push({
        file: f,
        title: f.replace(/^\d+-/, "").replace(/\.bend\.json$/, "").replace(/-/g, " "),
        blocks: doc.blocks.length,
        edges: (doc.edges || []).length,
        vocabulary: doc.vocabulary || "core",
        id,
        round_trip_id: id2,
    });
}

const drift = [];
for (const c of computed) {
    if (c.id !== c.round_trip_id) {
        drift.push(`${c.file}: §8.1.1 round-trip changed the id — ${c.id} then ${c.round_trip_id}`);
    }
}

/* records/corpus.json is written by this build the first time and CHECKED
   against on every run afterwards. Freezing it is what turns "the numbers came
   out of the library" into "the numbers have not moved since a human looked". */
const FROZEN = "./records/corpus.json";
if (existsSync(FROZEN)) {
    const frozen = J(FROZEN);
    if (frozen.documents.length !== computed.length) {
        drift.push(`corpus size: built ${computed.length} != record ${frozen.documents.length}`);
    }
    for (const f of frozen.documents) {
        const c = computed.find((x) => x.file === f.file);
        if (!c) { drift.push(`${f.file}: in the record, not in the corpus`); continue; }
        for (const k of ["blocks", "edges", "vocabulary", "id"]) {
            if (c[k] !== f[k]) drift.push(`${f.file} ${k}: built ${JSON.stringify(c[k])} != record ${JSON.stringify(f[k])}`);
        }
    }
} else {
    writeFileSync(FROZEN, JSON.stringify({
        schema: "bendscript-corpus-v1",
        _comment: "Frozen by build-site.mjs on first run. Every value here is recomputed from ./dist/index.js on every subsequent build and the build refuses on any disagreement. Do not hand-edit: if the library changes what a document hashes to, that is a protocol event, not a typo.",
        corpus: "test-corpus/v0.1",
        frozen_at: surface.verified_at,
        documents: computed.map(({ file, blocks, edges, vocabulary, id }) => ({ file, blocks, edges, vocabulary, id })),
    }, null, 2) + "\n");
    console.log(`froze ${computed.length} corpus documents into ${FROZEN}`);
}

/* Every BendScript document printed in README.md must actually parse.
   This is not hypothetical: the README's first usage example declared
       "version": "bendscript/0.1"
   where the validator requires
       "bendscript": "0.1"
   so the quick-start anyone copied threw ValidationError on line one, and had
   done so since the file was written. A documented command that does not run
   is the same defect as a button that does nothing — it is only discovered
   after somebody spends effort on it. Checked here because this is the only
   file in the repository that has the library loaded. */
for (const m of read("./README.md").matchAll(/```json\n([\s\S]*?)```|`{3,}\w*\n(\{[\s\S]*?"blocks"[\s\S]*?\})\n`{3,}/g)) {
    const body = (m[1] ?? m[2] ?? "").trim();
    if (!body.startsWith("{") || !body.includes('"blocks"')) continue;
    try { B.validate(B.parseAndNormalize(body)); }
    catch (e) { drift.push(`README document example does not parse: ${e.message}`); }
}
for (const m of read("./README.md").matchAll(/const text = `([\s\S]*?)`;/g)) {
    try { B.validate(B.parseAndNormalize(m[1])); }
    catch (e) { drift.push(`README usage example does not parse: ${e.message}`); }
}

if (drift.length) {
    console.error("BUILD REFUSED — the library and the frozen records disagree:");
    drift.forEach((d) => console.error("  " + d));
    process.exit(1);
}
console.log(`consistency gate: ${computed.length} corpus documents reparsed and rehashed, §8.1.1 re-exercised, 0 drift`);

/* ==========================================================================
   SHELL FRAGMENTS — shared markup; only the tokens in src/shell.css differ.
   ========================================================================== */

/* The chip renders the stored rung, and "?" when there is none. It never
   defaults, because a defaulted rung is a fabricated status. */
function rung(value) {
    const r = RUNGS.includes(value) ? value : "?";
    return `<span class="rung" data-rung="${r}" title="spec · in_tree · live_local · live_deployed · external">${r}</span>`;
}

/* The band states where you are, and WHAT IT MAY STATE DEPENDS ON THE PLACE.
   ampersand-nav/src/amp-nav.js records bendscript as place:3, and its own
   renderPlacement() emits the layer sentence for place 2 only — place 3 gets
   "a specification in the ComputeDriven world". Writing the layer sentence
   here would put this band in direct contradiction with the nav rendered
   immediately beneath it. SHELL.md §1 documents the place-2 and place-4
   variants and not this one; the nav is the record and the nav wins. */
function band() {
    const where = {
        4: `A <b>${esc(surface.parent)}</b> project`,
        3: `${esc(surface.surface)} &mdash; a <b>specification</b> in the ${esc(surface.parent)} world`,
        2: `${esc(surface.surface)} is the <b>${esc(surface.layer)}</b> layer of ${esc(surface.parent)}`,
    }[surface.tier];
    if (!where) {
        throw new Error("BUILD REFUSED — records/surface.json declares no usable place, so the band cannot know what it may claim.");
    }
    return `<div class="band" data-tier="${surface.tier}"><span class="where">${where}</span>${rung(surface.surface_rung)}<span class="covers">That rung covers ${esc(surface.surface_rung_covers)}.</span></div>`;
}

function statusBlock() {
    const s = surface.status;
    return `<dl class="status">
<div><dt>Status</dt><dd><strong>${esc(surface.surface_rung)}</strong> &mdash; ${esc(s.statement)}</dd></div>
<div><dt>Last verified</dt><dd>${esc(surface.verified_at)}</dd></div>
<div><dt>Source</dt><dd>${esc(s.source)}</dd></div>
<div class="limit"><dt>Limit</dt><dd>${esc(s.limit)}</dd></div>
<div><dt>Next rung</dt><dd><strong>${esc(surface.advance.next_rung)}</strong> &mdash; ${esc(surface.advance.requires)}</dd></div>
</dl>`;
}

/* §0.7: the rung gates the call to action. A CTA block declares its rung and
   may only use verbs that rung has earned; anything else throws. */
const VERBS = {
    spec: ["Read", "Challenge", "Implement"],
    in_tree: ["Inspect the source", "Run the tests"],
    live_local: ["Use it", "Reproduce it locally"],
    live_deployed: ["Use the deployed artifact"],
    external: ["See independent evidence", "Contribute another result"],
};

function cta(groupRung, label, actions) {
    const allowed = VERBS[groupRung];
    if (!allowed) throw new Error(`CTA group declares an unknown rung: ${groupRung}`);
    for (const a of actions) {
        if (!allowed.includes(a.verb)) {
            throw new Error(
                `BUILD REFUSED — CTA "${a.verb}" is not available at rung ${groupRung}. Allowed: ${allowed.join(", ")}`
            );
        }
    }
    const cls = groupRung === "spec" ? "tag" : "tag ok";
    return `<div class="ctagroup"><div class="${cls}">${esc(groupRung)} &mdash; ${esc(label)}</div><div class="cta">${actions
        .map(
            (a) =>
                `<a href="${a.href}"${a.href.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}><span class="verb">${esc(a.verb)}</span><span class="what">${a.what}</span></a>`
        )
        .join("")}</div></div>`;
}

/* ==========================================================================
   GENERATED CONTENT
   ========================================================================== */

/* Every plate figure is derived from something on disk or from the record —
   none is typed here. The suffixes matter: a bare "20" as a text node would
   collide with any literal 20 in the animation source and refuse the build,
   and the honest fix for that is a label, not a quieter check. */
const totalEdges = computed.reduce((n, c) => n + c.edges, 0);
const vocabularies = [...new Set(computed.map((c) => c.vocabulary))];
function plate() {
    const cells = [
        [String(computed.length), "Corpus documents"],
        [String(totalEdges), "Edges recomputed"],
        [String(vocabularies.length), "Vocabularies exercised"],
        ...surface.zero_counts.map((z) => [z.value, z.label]),
    ];
    return `<div class="grid plate">${cells
        .map(([n, l]) => `<div><div class="n">${esc(n)}</div><div class="l">${esc(l)}</div></div>`)
        .join("")}</div>`;
}

function artifactCards() {
    return `<div class="grid">${surface.artifacts
        .map(
            (a) =>
                `<div><div class="head"><h3>${esc(a.name)}</h3>${rung(a.rung)}</div><p>${esc(a.detail)}</p><div class="needs"><b>Where:</b> <span class="where-tag">${esc(a.where)}</span><br><b>Witness:</b> ${esc(a.witness)}</div></div>`
        )
        .join("")}</div>`;
}

function openCards() {
    return `<div class="grid">${surface.unmeasured
        .map(
            (c) =>
                `<div><div class="head"><h3>${esc(c.name)}</h3>${rung(c.rung)}</div><p>${esc(c.detail)}</p><div class="needs"><b>Needs:</b> ${esc(c.needs)} <b>Built:</b> ${esc(c.built)}.</div></div>`
        )
        .join("")}</div>`;
}

/* The table cells come from the library, not from the record — the record is
   only what they are checked against. A hand-typed id is impossible. The
   counts carry their noun so that no cell is a bare integer. */
function corpusTable() {
    const rows = computed
        .map(
            (c) =>
                `<tr><td class="place">${esc(c.title)}</td><td class="num">${c.blocks} blocks</td><td class="num">${c.edges} edges</td><td>${esc(c.vocabulary)}</td><td class="cid">${esc(c.id)}</td></tr>`
        )
        .join("");
    return `<div class="scroll"><table><thead><tr><th>Corpus document</th><th>Structure</th><th>Graph</th><th>Vocabulary</th><th>Document id (CIDv1, json multicodec, sha2-256)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

const METHOD_NOTE =
    `Each row was produced by importing the compiled library, parsing the file at <code>${CORPUS_DIR}/</code>, ` +
    `expanding its link marks into edges per §2.5.1, validating it against §2/§3, and hashing the JCS-canonical ` +
    `<code>{ blocks, edges }</code> with sha2-256 wrapped as a CIDv1. Then the document was re-serialised, re-parsed and ` +
    `re-hashed, and the two ids compared &mdash; §8.1.1 exercised at build time rather than cited. ` +
    `<code>id</code> and <code>meta</code> are excluded from the hash, so editing metadata does not invalidate the address (§5.1).`;

function zeros() {
    return `<dl class="status">${surface.zero_counts
        .map(
            (z) =>
                `<div><dt>${esc(z.label)}</dt><dd><strong>${esc(z.value)}.</strong> ${esc(z.witness)}</dd></div>`
        )
        .join("")}</dl>`;
}

/* The facet figure. Static markup, no script, no data — a diagram of the
   format using the spec's own predicate names. */
const FACET = `<div class="facet">
<div class="sentence">the memory loop <span class="span">closes on every outcome</span> <span class="pred">supports</span> <span class="arrow">&rarr;</span> <span class="uri">bend:bafy&hellip;#blk-4.spn-1</span></div>
<p class="note">The underlined run of text is a <strong>span</strong>. The pill is the <strong>predicate</strong>. The tail is a <code>bend:</code> URI that resolves to a span inside another document. On parse, that mark expands into an edge &mdash; deterministically and idempotently, so expanding twice adds nothing. A link mark with no predicate expands into no edge at all, which is how an ordinary hyperlink stays an ordinary hyperlink.</p>
</div>`;

/* ==========================================================================
   THE RETRACTION
   Both sentences below stood on this page until this revision and neither had
   a witness. They are listed in launch-gate.mjs's blocklist, so they cannot
   come back by an edit — only by a measurement.
   ========================================================================== */
const RETRACTION = `<div class="retract"><h3>Retraction &mdash; this page claimed the LLM round-trip works</h3>
<p>Until this revision the subtitle of this site read <code>deterministic JSON &middot; LLM-round-trippable</code>, and the comparison against Markdown ended with the sentence <code>Round-trip a doc through an LLM and the graph survives.</code> Both state §8.1.2 as an established property. <strong>It has never been run against a language model.</strong></p>
<p>What exists is the machinery: the drift metric with its five components, the median and P95 aggregation, the threshold verdict, and four mock models named identity, small-edit, lossy and garbage that exercise each failure mode. The mocks prove the harness measures something. They cannot prove what it would measure. The spec itself is careful here &mdash; §8.1.1 is a hard MUST and §8.1.2 is explicitly &ldquo;a measured property, not a guarantee&rdquo; &mdash; and the landing page had quietly collapsed the two into one.</p>
<p>The fix is structural rather than careful. Those two strings are now in the publication gate's blocklist and any page that reinstates one is refused, except inside this paragraph, because naming the wrong claim is what a retraction is. The claim comes back when a run comes back, and not before.</p></div>`;

/* ==========================================================================
   EMIT
   ========================================================================== */
/* The stylesheet ships stripped of comments and indentation. The source stays
   commented and readable; only the artifact is dense. SHELL.md §5. */
const CSS = read("./src/shell.css")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\n\s*/g, "")
    .replace(/;\}/g, "}")
    .trim();

/* The identifying animation is emitted as its own artifact rather than
   inlined, for two reasons and the second is the point: the landing page's
   markup stays content-only, so "the content is complete with JavaScript off"
   is something a reader verifies by deleting one line; and the animation
   becomes a file the publication gate can read constants out of and compare
   against the page. NEWLINES ARE KEPT — joining JavaScript lines the way the
   CSS is joined is a semicolon-insertion bug waiting to happen. */
const ANIM = read("./src/graph.js")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
    .replace(/^[ \t]+/gm, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

/* The correction form's inline reply (SHELL.md r9). Emitted as its own artifact
   for the same reason the animation is: the landing markup stays content-only,
   and "the form still posts with JavaScript off" is verifiable by deleting one
   line. NEWLINES ARE KEPT — joining JavaScript lines the way the CSS is joined
   is a semicolon-insertion bug waiting to happen. */
const CONTACT = read("./src/contact.js")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
    .replace(/^[ \t]+/gm, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

const YEAR = new Date(surface.verified_at).getUTCFullYear();

const landing = fill(read("./src/landing.html"), {
    CSS,
    BAND: band(),
    STAMP,
    APP_PATH,
    ORIGIN: surface.origin,
    REPO: surface.repo,
    SPEC_URL,
    CONTACT: surface.contact.url,
    FORM_ENDPOINT: surface.contact.endpoint,
    QUESTION: esc(surface.question),
    YEAR: String(YEAR),
    PLATE: plate(),
    FACET,
    ARTIFACTS: artifactCards(),
    OPEN_CARDS: openCards(),
    CORPUS_TABLE: corpusTable(),
    METHOD_NOTE,
    STATUS: statusBlock(),
    ZEROS: zeros(),
    RETRACTION,
    CTA:
        cta("live_deployed", "answers on this domain, checked in a browser", [
            {
                verb: "Use the deployed artifact",
                href: APP_PATH,
                what: "The playground. Paste a document and watch it parse, validate, expand its link marks and content-address itself. No account, no key, and nothing leaves your browser.",
            },
        ]) +
        cta("in_tree", "a package with a test suite, not a running service", [
            {
                verb: "Inspect the source",
                href: surface.repo,
                what: "The parser, validator, canonicaliser, mark expander, hash and drift harness are about a thousand lines of TypeScript with two runtime dependencies.",
            },
            {
                verb: "Run the tests",
                href: surface.repo,
                what: "<code>npm install &amp;&amp; npm test</code>. The corpus is checked in; the ids in the table above are what your machine should produce.",
            },
        ]) +
        cta("spec", "a draft document, and three open gates", [
            {
                verb: "Read",
                href: SPEC_URL,
                what: "v0.1 draft. §8.1 is the section worth arguing with &mdash; it is where the format says which of its two claims is a guarantee and which is not.",
            },
            {
                verb: "Challenge",
                href: surface.contact.url,
                what: "Find a document this parser gets wrong, or an id it computes differently from yours. An input and an expected value is the most useful thing anyone can send.",
            },
            {
                verb: "Implement",
                href: surface.repo,
                what: "A second processor in any language. The table above is the fixture: same file in, same CIDv1 out, or the spec's identity claim is wrong.",
            },
        ]),
});

function fill(tpl, vars) {
    return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => {
        if (!(k in vars)) throw new Error(`template token {{${k}}} has no value`);
        return vars[k];
    });
}

writeFileSync("./index.html", landing);
writeFileSync("./graph.js", ANIM + "\n");
writeFileSync("./contact.js", CONTACT + "\n");

console.log(`wrote index.html   ${landing.length.toLocaleString()} bytes`);
console.log(`wrote graph.js     ${ANIM.length.toLocaleString()} bytes  (decoration; the page's content does not depend on it)`);
console.log(`wrote contact.js    ${CONTACT.length.toLocaleString()} bytes  (progressive enhancement; the form posts without it)`);
