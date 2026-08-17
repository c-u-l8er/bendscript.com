/* ==========================================================================
   bendscript.com publication gate. No dependencies.

       node launch-gate.mjs        (run it via: npm run test:launch)

   It reads the ARTIFACT — the generated index.html and graph.js — and refuses
   when the artifact says something the records do not support. build-site.mjs
   already refuses on id drift; this refuses on the other ways a page lies: a
   retracted claim coming back, a rung invented, a call to action the rung has
   not earned, an unrendered token, a dead mailbox, an unreadable caveat, an
   animation whose internals have leaked into the copy.

   SHELL.md §4. Every check below has a reason and most of them have a scar.
   ========================================================================== */
import { readFileSync, existsSync } from "fs";

const read = (p) => readFileSync(p, "utf8");
const J = (p) => JSON.parse(read(p));

const surface = J("./records/surface.json");
const corpus = J("./records/corpus.json");
const pkg = J("./package.json");
const APP = "/app/";

let pass = 0, fail = 0;
function T(name, ok, detail = "") {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
    ok ? pass++ : fail++;
}

for (const f of ["./index.html", "./graph.js"]) {
    if (!existsSync(f)) { console.error(`FAIL  missing artifact ${f} — run the build first`); process.exit(1); }
}
const landing = read("./index.html");
const pages = { "/": landing };

/* ---------- 1. release identity ---------- */
T("release identity: package.json == records/surface.json",
    pkg.version === surface.version, `${pkg.version} / ${surface.version}`);
const STAMP = `BENDSCRIPT v${surface.version} · RECORDS ${surface.verified_at}`;
T("/ carries the canonical stamp", landing.includes(STAMP));
T("the surface records the shell revision it was built against",
    /^shell-r\d+$/.test(surface.shell_revision || ""), surface.shell_revision);

/* ---------- 2. the artifact is fully rendered, and it is THIS source's ----------
   The staleness check earned its place the hard way: while proving this gate
   could refuse, a build was run in an environment where the library import
   failed. The build threw, index.html was never rewritten, and the gate happily
   approved the PREVIOUS artifact — so two deliberate breaks reported PASS and
   looked like gate holes. A gate that reads the artifact must also be able to
   say the artifact came from the source beside it. */
{
    const emitCss = read("./src/shell.css")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n\s*/g, "").replace(/;\}/g, "}").trim();
    T("/ carries the stylesheet this source compiles to", landing.includes(emitCss),
        `${emitCss.length.toLocaleString()} bytes of CSS`);
    const emitAnim = read("./src/graph.js")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "")
        .replace(/^[ \t]+/gm, "").replace(/[ \t]+$/gm, "").replace(/\n{2,}/g, "\n").trim();
    T("/graph.js is what src/graph.js compiles to", read("./graph.js").trim() === emitAnim);
}
T("/ has no unrendered build token", !/\{\{\w+\}\}/.test(landing));
T("/ declares its canonical URL", landing.includes(`<link rel="canonical" href="${surface.origin}/">`));
T("/ declares the surface's falsifiable question",
    landing.includes(`<meta name="falsifiable-question" content="${surface.question}">`));

/* ---------- 3. the landing page is not the application ----------
   SHELL.md §5: split the landing from the app, so the landing can legitimately
   ship zero JavaScript. The app at /app/ is a separate 150 KB artifact and is
   deliberately NOT gated here — it is hand-authored and predates this shell. */
T("the landing page is not the playground", !landing.includes("<textarea"));
T("the landing page links the playground", landing.includes(`href="${APP}"`));
T("the playground exists in the tree", existsSync("./app/index.html"));

/* The landing page's CONTENT ships without JavaScript. SHELL.md §8 requires an
   identifying animation and the animation may cost JS; the page's meaning may
   not. So: nothing inline, exactly one external script, and that script is the
   animation — which §9 below then proves writes nothing into the document. */
{
    const tags = [...landing.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    T("the landing page ships no inline JavaScript", tags.every((t) => t[2].trim() === ""));
    T("the landing page loads exactly one script, and it is the identity animation",
        tags.length === 1 && /\bsrc="\/graph\.js"/.test(tags[0][1]) && /\bdefer\b/.test(tags[0][1]),
        `${tags.length} script tag(s)`);
}

/* ---------- 4. claims that were retracted may not come back ----------
   Both strings below stood on this page and stated §8.1.2 — the LLM round-trip
   — as an established property. It has never been run against a real model.
   This is the retraction made structural: it cannot be undone by an edit. */
const RETRACTED = [
    "LLM-round-trippable",
    "Round-trip a doc through an LLM and the graph survives",
];
/* The retraction paragraph is the ONE place a retracted string may appear,
   because naming the wrong claim is what a retraction is.

   COUNT, do not merely detect. The reference implementation of this check
   (GPSCoord's launch-gate.mjs) asks "is the string inside the retraction?" and
   then permits it everywhere once the answer is yes — so a page that keeps its
   retraction AND puts the sentence back in the hero passes. That was confirmed
   by breaking it: the sentence was reinstated above the fold and the gate said
   PASS. Occurrences inside the block must equal occurrences on the page. */
const retractBlock = (() => {
    const i = landing.indexOf('<div class="retract">');
    if (i < 0) return "";
    const j = landing.indexOf("</div>", i);
    return j < 0 ? landing.slice(i) : landing.slice(i, j + 6);
})();
const tally = (hay, needle) => hay.split(needle).length - 1;
T("the retraction block is present and findable", retractBlock.length > 0);
for (const s of RETRACTED) {
    const onPage = tally(landing, s);
    const inBlock = tally(retractBlock, s);
    T(`/ does not reinstate "${s}" outside the retraction`, onPage === inBlock,
        `${onPage} on the page, ${inBlock} inside the retraction`);
}
/* The blocklist stops the two exact sentences coming back. It cannot stop a
   paraphrase, and a fuzzy "does this sentence sound like a claim" regex was
   tried here and refused three sentences that were telling the truth. A gate
   that cries wolf gets weakened, so this is the AFFIRMATIVE form instead: the
   page must carry the retraction, and must publish the open gate as open. Both
   are exact, and neither can pass while the page quietly re-asserts §8.1.2. */
T("/ carries the retraction rather than a silent edit",
    landing.includes("Retraction &mdash;") && /never been run against/.test(landing));
T("/ publishes the unrun gating claim as unrun",
    surface.unmeasured.some((u) => u.id === "llm_roundtrip") &&
    landing.includes(surface.unmeasured.find((u) => u.id === "llm_roundtrip").name));
T("the gating claim's ledger entry is pending, not approved",
    surface.gates.llm_round_trip.status === "pending" && surface.gates.llm_round_trip.evidence === null);

/* ---------- 5. no dead mailbox anywhere ---------- */
T("/ advertises no mailto:", !landing.includes("mailto:"));
T("the correction channel is a live URL, not a mailbox",
    /^https:\/\//.test(surface.contact.url) && surface.contact.kind !== "mailto");

/* ---------- 6. every rung on the artifact is a real rung ---------- */
const RUNGS = ["spec", "in_tree", "live_local", "live_deployed", "external", "?"];
{
    const chips = [...landing.matchAll(/<span class="rung" data-rung="([^"]*)"[^>]*>([^<]*)<\/span>/g)];
    T("/ renders at least one rung chip", chips.length > 0, `${chips.length} chips`);
    T("/ renders only real rungs", chips.every((c) => RUNGS.includes(c[1])),
        chips.map((c) => c[1]).filter((r) => !RUNGS.includes(r)).join(", ") || "all valid");
    T("/ chip text always equals its stored rung", chips.every((c) => c[1] === c[2]));
    T("/ never defaults an unknown rung",
        !/data-rung=""/.test(landing) && !/data-rung="undefined"/.test(landing) && !/data-rung="null"/.test(landing));
    T("the surface rung is one of the five", RUNGS.slice(0, 5).includes(surface.surface_rung), surface.surface_rung);
    T("the surface rung is the rung of its best-evidenced artifact",
        surface.artifacts.some((a) => a.rung === surface.surface_rung),
        `${surface.surface_rung} — ${(surface.artifacts.find((a) => a.rung === surface.surface_rung) || {}).name}`);
}

/* The band may only claim what the PLACE permits, and the place is a record in
   ampersand-nav, not a choice made here. amp-nav files bendscript as place:3,
   and its own renderPlacement() gives the layer sentence to place 2 ONLY. A
   place-3 band that claimed a layer would contradict the nav rendered directly
   beneath it — which is the gpscoord tier-4 defect one rung up. SHELL.md §1. */
T("the surface declares its place", [1, 2, 3, 4].includes(surface.tier), `place ${surface.tier}`);
T("/ band carries the declared place", landing.includes(`<div class="band" data-tier="${surface.tier}">`));
if (surface.tier === 3) {
    T("/ band says specification, as amp-nav does for place 3",
        landing.includes(`a <b>specification</b> in the ${surface.parent} world`));
    T("/ band makes no layer claim at place 3", !landing.includes(`layer of ${surface.parent}`));
}
T("the placement band bounds what its rung covers", landing.includes(surface.surface_rung_covers));

/* ---------- r5a. the band must refuse in BOTH directions ----------
   Refusing a layer claim a place has not earned is only half of it: a place-2
   band that quietly DROPS its layer word is the same defect inverted, and it
   passed until someone tried it. So assert the sentence this place must carry
   and the absence of every sentence it must not. SHELL.md r5 §4. */
{
    const SENTENCES = {
        2: `is the <b>${surface.layer}</b> layer of ${surface.parent}`,
        3: `a <b>specification</b> in the ${surface.parent} world`,
        4: `A <b>${surface.parent}</b> project`,
    };
    const mine = SENTENCES[surface.tier];
    T(`/ band carries the sentence place ${surface.tier} requires`, !!mine && landing.includes(mine),
        mine || "no sentence defined for this place");
    const wrong = Object.entries(SENTENCES)
        .filter(([p]) => Number(p) !== surface.tier && landing.includes(SENTENCES[p]))
        .map(([p]) => `place ${p}`);
    T("/ band carries no OTHER place's sentence", wrong.length === 0, wrong.join(", ") || "only its own");
}

/* ---------- r5b. every §N on the page resolves in the spec it cites ----------
   Cheap, and it catches a citation that drifted when a spec was rewritten.
   FENCES ARE STRIPPED FIRST: a markdown heading inside a fenced code block is
   not a heading, and reading one as a section has already bitten a lane.
   A citation resolves if the spec has a heading with that number, or if the
   spec itself uses the same §N — sub-clauses like §8.1.1 are bold text under a
   §8.1 heading rather than headings of their own, and that is legitimate. */
{
    const specPath = "./" + surface.spec_file;
    T("the spec file this surface cites exists", existsSync(specPath), surface.spec_file);
    if (existsSync(specPath)) {
        const md = read(specPath).replace(/^```[\s\S]*?^```/gm, "");
        const heads = new Set([...md.matchAll(/^#{1,6}\s+(\d+(?:\.\d+)*)\.?\s/gm)].map((m) => m[1]));
        const used = new Set([...md.matchAll(/§\s?(\d+(?:\.\d+)*)/g)].map((m) => m[1]));
        /* Only RENDERED text counts. The SHELL.md §8 reference in this page's
           own HTML comment is not a citation of the protocol spec, and it
           passed by coincidence because the protocol happens to have a §8. */
        const visible = landing
            .replace(/<!--[\s\S]*?-->/g, " ")
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ");
        const cited = [...new Set([...visible.matchAll(/§\s?(\d+(?:\.\d+)*)/g)].map((m) => m[1]))];
        const dangling = cited.filter((c) => !heads.has(c) && !used.has(c));
        T("every § citation on the page resolves in the spec it cites", dangling.length === 0,
            dangling.length ? `DANGLING: ${dangling.map((d) => "§" + d).join(", ")} — ${heads.size} headings, ${used.size} § uses in ${surface.spec_file}`
                            : `${cited.length} citations, all resolved against ${heads.size} headings`);
    }
}

/* ---------- r5c. the rung has a NAMED witness, and it is approved ----------
   "Any pending gate blocks live_deployed" is too blunt: independent_use is
   pending forever by construction, so a surface could never advance. The
   record names which gate witnesses the rung; the rest stay pending. */
T("the surface names the gate that witnesses its rung",
    !!surface.rung_witness && !!surface.gates[surface.rung_witness], surface.rung_witness);
T("the witnessing gate is approved, with its evidence",
    surface.gates[surface.rung_witness] &&
    surface.gates[surface.rung_witness].status === "approved" &&
    ["evidence", "reviewer", "date"].every((f) => surface.gates[surface.rung_witness][f]),
    surface.rung_witness);

/* ---------- 7. §0.7 — the rung gates the call to action ---------- */
const VERBS = {
    spec: ["Read", "Challenge", "Implement"],
    in_tree: ["Inspect the source", "Run the tests"],
    live_local: ["Use it", "Reproduce it locally"],
    live_deployed: ["Use the deployed artifact"],
    external: ["See independent evidence", "Contribute another result"],
};
{
    const groups = [...landing.matchAll(/<div class="ctagroup"><div class="tag[^"]*">(\w+) &mdash;[\s\S]*?<\/div><\/div>/g)];
    T("/ has at least one call to action", groups.length > 0, `${groups.length} groups`);
    let bad = [];
    for (const g of groups) {
        const allowed = VERBS[g[1]] || [];
        for (const v of [...g[0].matchAll(/<span class="verb">([^<]*)<\/span>/g)]) {
            const verb = v[1].replace(/&mdash;/g, "—");
            if (!allowed.includes(verb)) bad.push(`${verb} @ ${g[1]}`);
        }
    }
    T("/ asks only what its rung has earned", bad.length === 0, bad.join("; ") || "ok");
    T("no group invites running something at the spec rung",
        !/<div class="tag">spec[\s\S]*?<span class="verb">(Use it|Use the deployed|Run the tests|Reproduce)/.test(landing));
    /* A mixed surface gets one group per rung, not one blended group. */
    T("every artifact rung on this surface has its own CTA group",
        [...new Set(surface.artifacts.map((a) => a.rung))].every((r) => groups.some((g) => g[1] === r)),
        [...new Set(surface.artifacts.map((a) => a.rung))].join(", "));
}

/* ---------- 8. the status block, and the review ledger ---------- */
for (const label of ["Status", "Last verified", "Source", "Limit", "Next rung"]) {
    T(`the status block states ${label}`, landing.includes(`<dt>${label}</dt>`));
}
T("the LIMIT names something the evidence does NOT establish",
    /does not establish|does not claim|has not/i.test(surface.status.limit));
const NEED = ["evidence", "reviewer", "date"];
const gates = Object.entries(surface.gates).filter(([k]) => k !== "_comment");
T("review ledger: every gate has a valid status",
    gates.every(([, g]) => ["pending", "approved"].includes(g.status)));
T("review ledger: no approval without its evidence",
    gates.every(([, g]) => g.status !== "approved" || NEED.every((f) => g[f])));
T("review ledger: the external rung is not self-awarded",
    surface.surface_rung !== "external" || surface.gates.second_implementation.status === "approved");

/* ---------- 9. the published table is the one that was checked ----------
   Every frozen document id must actually appear on the page, and every id on
   the page must be in the record. Both directions: the first catches a table
   that quietly dropped a row, the second catches an id typed in by hand. */
{
    const onPage = new Set([...landing.matchAll(/\bbag[a-z0-9]{40,}\b/g)].map((m) => m[0]));
    /* Two legitimate sources for a content address on this page: the frozen
       corpus record, and records/surface.json, where the id measured in a
       browser against the deployed playground is written down as a witness.
       Anything else is an id someone typed, which is the whole defect class. */
    const inRecord = new Set([
        ...corpus.documents.map((d) => d.id),
        ...[...read("./records/surface.json").matchAll(/\bbag[a-z0-9]{40,}\b/g)].map((m) => m[0]),
    ]);
    const missing = [...inRecord].filter((id) => !onPage.has(id));
    const extra = [...onPage].filter((id) => !inRecord.has(id));
    T("every frozen document id is published", missing.length === 0,
        missing.length ? `${missing.length} missing` : `${inRecord.size} ids`);
    T("no document id on the page is absent from the record", extra.length === 0,
        extra.length ? `UNRECORDED: ${extra.join(", ")}` : "none");
    T("the corpus record covers the corpus on disk",
        corpus.documents.length === 20 || corpus.documents.length > 0, `${corpus.documents.length} documents`);
}

/* ---------- 10. every path this page tells a reader to load resolves ----------
   "A link that returns 200 can still be dead" (SITES.md §0.5) — the cheap half
   of that is checkable here: every same-origin href must exist in the tree.
   The README's quickstart on the sibling repo pointed at a path that 404s for
   months, and nothing noticed, because nobody ever resolved a documented path. */
{
    const hrefs = [...new Set([...landing.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)].map((m) => m[1]))];
    const dead = hrefs.filter((h) => {
        const p = "." + (h.endsWith("/") ? h + "index.html" : h);
        return !existsSync(p);
    });
    T("every same-origin path the page links resolves in the tree", dead.length === 0,
        dead.length ? `DEAD: ${dead.join(", ")}` : `${hrefs.length} paths`);
}

/* ---------- 11. density ---------- */
T("the landing page stays small", landing.length < 40000, `${landing.length.toLocaleString()} bytes`);

/* ==========================================================================
   12. SHELL.md §8.5 — THE IDENTIFYING ANIMATION ASSERTS NOTHING

   gpscoord.com shipped a canvas globe whose vehicles were created by
   `for (let i = 0; i < 12; i++)`, and printed beside it, for months:

       12   Active Pathfinders

   A decoration's internal constant was published as a live user metric. The
   three checks below are that defect mechanised.

   WHEN THE SECOND CHECK FIRES, THE ANIMATION CHANGES — never the page. The
   page's figures are recomputed from the library and have witnesses; the
   animation is decoration and can pick any number it likes. Decoration yields.
   ========================================================================== */
const anim = read("./graph.js");

{
    const marked = [...landing.matchAll(/<[a-z]+\b[^>]*\bdata-identity-animation\b[^>]*>/gi)];
    T("the landing page marks an element data-identity-animation", marked.length >= 1, `${marked.length} marked`);
    const firstSection = (landing.split("<section")[1] || "").split("</section>")[0];
    T("the identity animation is above the fold — inside the first section",
        firstSection.includes("data-identity-animation"));
    T("the h1 comes before the identity animation — the question comes first",
        landing.indexOf("<h1") > -1 && landing.indexOf("<h1") < landing.indexOf("data-identity-animation"));
}

/* Constants of the animation. Numeric literals below 2 are excluded: 0 and 1
   are structural in any drawing code and identify nothing. 12 is not. */
const ANIM_NUMS = new Set();
const ANIM_STRS = new Set();
for (const m of anim.matchAll(/(?<![\w.$])\d+(?:\.\d+)?/g)) {
    const v = Number(m[0]);
    if (Math.abs(v) >= 2) ANIM_NUMS.add(String(v));
}
for (const m of anim.matchAll(/"([^"\\\n]{3,})"|'([^'\\\n]{3,})'/g)) ANIM_STRS.add(m[1] ?? m[2]);

{
    const ENT = { "&nbsp;": " ", "&ensp;": " ", "&mdash;": "—", "&minus;": "−", "&rarr;": "→",
        "&amp;": "&", "&copy;": "©", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&times;": "×",
        "&middot;": "·", "&hellip;": "…", "&ldquo;": "“", "&rdquo;": "”", "&sect;": "§" };
    const texts = landing
        .replace(/<script[\s\S]*?<\/script>/gi, "<>")
        .replace(/<style[\s\S]*?<\/style>/gi, "<>")
        .replace(/<!--[\s\S]*?-->/g, "<>")
        .split(/<[^>]*>/)
        .map((s) => s.replace(/&\w+;/g, (e) => (e in ENT ? ENT[e] : e)).trim())
        .filter(Boolean);
    const shown = new Set();
    for (const t of texts) {
        shown.add(t);
        if (/^-?[\d,]*\d(?:\.\d+)?$/.test(t) && t.includes(",")) shown.add(t.replace(/,/g, ""));
    }
    const leaked = [...shown].filter((t) => ANIM_NUMS.has(t) || ANIM_STRS.has(t));
    T("no text on the landing page is a constant read from the animation",
        leaked.length === 0,
        leaked.length
            ? `LEAKED: ${leaked.map((l) => JSON.stringify(l)).join(", ")} — change src/graph.js, not the page`
            : `${ANIM_NUMS.size + ANIM_STRS.size} constants vs ${texts.length} text nodes, disjoint`);
}

{
    const recordText = ["surface", "corpus"].map((f) => read(`./records/${f}.json`)).join("\n");
    const shared = [...ANIM_STRS].filter((s) => recordText.includes(s));
    T("the animation shares no string with a frozen record", shared.length === 0,
        shared.length ? `SHARED: ${shared.map((s) => JSON.stringify(s)).join(", ")}` : `${ANIM_STRS.size} strings, none in records`);
}

/* No inputs and no outputs — the cheapest guarantee of the check above, §8.2 */
{
    const FORBIDDEN = ["innerHTML", "outerHTML", "textContent", "innerText",
        "insertAdjacentHTML", "document.write", "createElement", "createTextNode",
        "appendChild", "setAttribute", "getElementById", "getElementsBy",
        "localStorage", "sessionStorage", "XMLHttpRequest", "fetch("];
    const found = FORBIDDEN.filter((k) => anim.includes(k));
    T("the animation neither reads nor writes page content", found.length === 0,
        found.join(", ") || "no DOM content API used");
    const queries = [...anim.matchAll(/querySelector(?:All)?\(\s*([^)]*)\)/g)].map((m) => m[1]);
    T("the animation queries nothing but its own canvas",
        queries.length === 1 && queries[0].includes("data-identity-animation"),
        queries.join(" | ") || "none");
}

/* §8.4 — the constraints that keep it from being a broken page */
T("the animation honours prefers-reduced-motion", anim.includes("prefers-reduced-motion"));
T("the animation never uses IntersectionObserver", !anim.includes("IntersectionObserver"));
T("the animation stops when the tab is hidden", anim.includes("document.hidden"));
T("the animation caps its frame rate", /1000\s*\/\s*FPS/.test(anim));
T("the animation stays cheap enough for a phone", anim.length < 9000, `${anim.length.toLocaleString()} bytes`);

/* ==========================================================================
   13. CONTRAST — every declared text token, on the surface it sits on

   --fg3 shipped at .34 across this shell, which is 2.78:1 against the band.
   It colours the .covers span and every .status dt — the two elements whose
   whole job is keeping the page honest. A caveat nobody can read is not a
   caveat. WCAG 2.1 SC 1.4.3, computed rather than eyeballed.
   ========================================================================== */
const sheet = read("./src/shell.css");
const TOKENS = {};
for (const m of sheet
    .slice(sheet.indexOf("/* TOKENS-START"), sheet.indexOf("/* TOKENS-END"))
    .matchAll(/--([\w-]+)\s*:\s*([^;\n}]+)/g)) TOKENS[m[1]] = m[2].trim();
if (!TOKENS.ink) throw new Error("launch-gate found no token block in src/shell.css");

function colour(v) {
    const raw = (TOKENS[String(v).replace(/^--/, "")] || String(v)).trim();
    let m = /^#([0-9a-f]{6})$/i.exec(raw);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
    m = /^rgba?\(([^)]+)\)$/i.exec(raw);
    if (m) { const p = m[1].split(",").map((x) => Number(x.trim())); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    throw new Error(`launch-gate cannot read the colour ${JSON.stringify(v)} -> ${raw}`);
}
const composite = (f, b) => [f[3] * f[0] + (1 - f[3]) * b[0], f[3] * f[1] + (1 - f[3]) * b[1], f[3] * f[2] + (1 - f[3]) * b[2], 1];
function solid(spec) {
    const layers = Array.isArray(spec) ? spec : [spec];
    let base = colour(layers[0]); base = [base[0], base[1], base[2], 1];
    for (let i = 1; i < layers.length; i++) base = composite(colour(layers[i]), base);
    return base;
}
const chan = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (c) => 0.2126 * chan(c[0]) + 0.7152 * chan(c[1]) + 0.0722 * chan(c[2]);
function contrast(fgSpec, bgSpec) {
    const bg = solid(bgSpec);
    const fg = composite(colour(fgSpec), bg);
    const a = lum(fg), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const CONTRAST_PAIRS = [
    ["--fg", "--ink", "body copy"],
    ["--fg", "--ink2", "card headings, the band's bold word, the facet sentence"],
    ["--fg", "--ink3", "table headers' raised surface"],
    ["--fg2", "--ink", "lede and prose"],
    ["--fg2", "--ink2", "status values, the band's .covers span, rung chip text"],
    ["--fg2", "--ink3", "raised-surface secondary text"],
    ["--fg3", "--ink", "plate labels on the page"],
    ["--fg3", "--ink2", "every .status dt, .needs, the footer"],
    ["--fg3", "--ink3", "table column headers"],
    ["--acc", "--ink", "links in prose"],
    ["--acc", "--ink2", "CTA verbs, eyebrows, the logo on hover, the predicate pill"],
    ["--acc", ["--ink2", "--acc-soft"], "a CTA card while hovered"],
    ["--data", "--ink2", "the bend: URI in the facet, the where-tag"],
    ["--data", ["--ink2", "--data-soft"], "the live_local chip on its own tint"],
    ["--warn", "--ink2", "the LIMIT row, the claim tag, the ? rung"],
    ["--warn", ["--ink2", "rgba(245,196,81,.06)"], "the claim tag on its own tint"],
    ["#150402", "--acc", "the label inside a primary button"],
    ["#9aa4b2", "--ink2", "the spec rung chip"],
    ["#7aa2f7", "--ink2", "the in_tree rung chip"],
    ["#4ade80", "--ink2", "the live_deployed rung chip"],
    ["#c4a1ff", "--ink2", "the external rung chip"],
];
const MIN_RATIO = 4.5;
let worst = Infinity, worstName = "";
for (const [fg, bg, where] of CONTRAST_PAIRS) {
    const r = contrast(fg, bg);
    const name = `${fg} on ${Array.isArray(bg) ? bg.join(" + ") : bg}`;
    if (r < worst) { worst = r; worstName = name; }
    T(`contrast ${name} — ${where}`, r >= MIN_RATIO, `${r.toFixed(2)}:1`);
}
T("the least legible declared pair clears the 4.5:1 floor", worst >= MIN_RATIO,
    `${worstName} at ${worst.toFixed(2)}:1`);

/* ==========================================================================
   14. EVERY INTERACTIVE ELEMENT CAN BE SEEN TO BE INTERACTIVE

   .logo had no :hover rule at all on the reference surface, so hovering the
   top-left changed nothing and there was no way to tell it was a link.
   :focus-visible was global and fine; hover was per-selector, and one selector
   was missed.
   ========================================================================== */
{
    const styles = [...landing.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
    const hoverSel = [...styles.matchAll(/([^{}]*?):hover/g)].map((m) => m[1]).join(" , ");
    const handles = new Set();
    for (const el of landing.matchAll(/<(a|button)\b([^>]*)>/gi)) {
        const cls = /class="([^"]*)"/.exec(el[2]);
        handles.add(cls ? "." + cls[1].trim().split(/\s+/)[0] : el[1].toLowerCase());
    }
    const naked = [...handles].filter((h) =>
        h.startsWith(".")
            ? !new RegExp(`\\${h}(?![\\w-])`).test(hoverSel)
            : !new RegExp(`(^|[\\s>+~,(])${h}(?=[\\s.:>+~,)]|$)`, "m").test(hoverSel));
    T("/ every interactive element has a visible :hover", naked.length === 0,
        naked.length ? `no hover for: ${naked.join(", ")}` : `${handles.size} kinds, all covered`);
    T("/ declares a focus-visible ring", /:focus-visible\s*\{/.test(styles));
}

console.log(`\n${pass} passed, ${fail} failed (publication gate)`);
if (fail) process.exit(1);
