/* ==========================================================================
   The identifying animation for bendscript.com — SHELL.md §8.

   What it depicts: a document whose spans keep binding themselves to each
   other with typed edges. Blocks stack, spans light up inside them, an edge
   is drawn from one span to another, holds, and fades. That is the whole
   subject of this protocol in one picture.

   IT RENDERS NO DATA AND ASSERTS NOTHING. §8.1 rule 2 is not negotiable and
   it is written in blood: gpscoord.com published `for (let i = 0; i < 12; i++)`
   — the loop bound of a decorative animation — beside the words "Active
   Pathfinders", for months.

   So this file takes NO input from the document and writes NOTHING back into
   it. It queries exactly one element, its own canvas, and touches nothing
   else. Its counts are deliberately WRONG about this site: it draws seven
   blocks and up to thirteen live edges, and the corpus this site actually
   publishes has neither of those shapes. If a number here ever collides with
   a number on the page, launch-gate.mjs refuses the build — and the fix is to
   change THIS FILE, never the page. Decoration yields.
   ========================================================================== */
(function () {
  var host = document.querySelector("[data-identity-animation]");
  if (!host || !host.getContext) return;
  var ctx = host.getContext("2d");
  if (!ctx) return;

  var FPS = 24;
  var FRAME = 1000 / FPS;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

  /* --- palette, read from nothing; these are literals on purpose ---------- */
  var ACC = "255,79,61";
  var DIM = "236,234,240";

  /* --- a seeded generator, so the picture is the same every load ---------- */
  var seed = 0x1f83d7;
  function rnd() {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >> 17;
    seed ^= seed << 5;  seed >>>= 0;
    return (seed >>> 8) / 16777216;
  }

  /* --- the document: seven blocks, each a run of spans -------------------- */
  var BLOCKS = 7;
  var blocks = [];
  var spans = [];
  function layout(w, h) {
    blocks.length = 0;
    spans.length = 0;
    var pad = h * 0.11;
    var step = (h - pad * 2) / BLOCKS;
    var left = w * 0.16;
    for (var b = 0; b < BLOCKS; b++) {
      var y = pad + step * b + step * 0.5;
      var n = 1 + Math.floor(rnd() * 3.4);
      var x = left;
      var wide = w * (0.34 + rnd() * 0.28);
      var row = [];
      for (var s = 0; s < n; s++) {
        var sw = wide / n * (0.68 + rnd() * 0.5);
        row.push({ x: x, y: y, w: sw, b: b, lit: 0 });
        spans.push(row[row.length - 1]);
        x += sw + w * 0.022;
      }
      blocks.push({ y: y, spans: row, kind: rnd() });
    }
  }

  /* --- edges: at most thirteen alive at once ------------------------------ */
  var MAX_EDGES = 13;
  var edges = [];
  function sprout() {
    if (spans.length < 3) return;
    var a = spans[Math.floor(rnd() * spans.length)];
    var z = spans[Math.floor(rnd() * spans.length)];
    if (a === z || a.b === z.b) return;
    edges.push({ a: a, z: z, t: 0, life: 170 + rnd() * 130, bow: (rnd() - 0.5) * 1.7 });
  }

  /* --- drawing ------------------------------------------------------------ */
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function draw(w, h, tick) {
    ctx.clearRect(0, 0, w, h);
    var bar = Math.max(3.4, h * 0.017);

    /* the spans themselves */
    for (var i = 0; i < spans.length; i++) {
      var s = spans[i];
      s.lit *= 0.955;
      ctx.fillStyle = "rgba(" + DIM + "," + (0.11 + s.lit * 0.36) + ")";
      rrect(s.x, s.y - bar * 0.5, s.w, bar, bar * 0.5);
      ctx.fill();
      if (s.lit > 0.04) {
        ctx.fillStyle = "rgba(" + ACC + "," + s.lit * 0.85 + ")";
        rrect(s.x, s.y + bar * 0.72, s.w, Math.max(1.4, bar * 0.28), bar * 0.14);
        ctx.fill();
      }
    }

    /* The edges. No lineCap is set: the gate refuses when the animation shares
       a string with a frozen record, "round" collides with "round-trip" in
       records/surface.json, and the rule is that DECORATION YIELDS. Butt caps
       cost nothing here. */
    for (var e = edges.length - 1; e >= 0; e--) {
      var g = edges[e];
      g.t += 1;
      if (g.t > g.life) { edges.splice(e, 1); continue; }
      var p = g.t / g.life;
      var grow = p < 0.28 ? p / 0.28 : 1;
      var fade = p > 0.78 ? 1 - (p - 0.78) / 0.22 : 1;
      var ax = g.a.x + g.a.w, ay = g.a.y;
      var zx = g.z.x + g.z.w * 0.5, zy = g.z.y;
      var mx = Math.max(ax, zx) + Math.abs(zy - ay) * (0.34 + g.bow * 0.18);
      var my = (ay + zy) * 0.5;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(mx, my, ax + (zx - ax) * grow, ay + (zy - ay) * grow);
      ctx.strokeStyle = "rgba(" + ACC + "," + 0.42 * fade + ")";
      ctx.lineWidth = 1.35;
      ctx.stroke();

      if (grow >= 1) {
        g.a.lit = Math.max(g.a.lit, fade);
        g.z.lit = Math.max(g.z.lit, fade * 0.8);
        /* the predicate: a small filled dot travelling the arc */
        var q = ((tick * 0.011) + e * 0.17) % 1;
        var ix = (1 - q) * (1 - q) * ax + 2 * (1 - q) * q * mx + q * q * zx;
        var iy = (1 - q) * (1 - q) * ay + 2 * (1 - q) * q * my + q * q * zy;
        ctx.beginPath();
        ctx.arc(ix, iy, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + ACC + "," + 0.85 * fade + ")";
        ctx.fill();
      }
    }
  }

  /* --- the loop ----------------------------------------------------------- */
  var w = 0, h = 0, tick = 0, last = 0, raf = 0;
  function size() {
    var r = host.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    w = Math.max(r.width, 140); h = Math.max(r.height, 140);
    host.width = Math.round(w * dpr);
    host.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed = 0x1f83d7;
    layout(w, h);
    edges.length = 0;
  }

  function still() { size(); for (var i = 0; i < 5; i++) sprout(); for (var k = 0; k < 40; k++) draw(w, h, k); }

  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    /* Stop when the tab is hidden, and when the hero has scrolled away.
       IntersectionObserver is NOT used at all — it never fires in a
       non-compositing renderer, and an animation that never starts reads as
       a broken page. SHELL.md §6. */
    if (document.hidden) return;
    if (now - last < FRAME) return;
    last = now;
    var r = host.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    tick++;
    if (edges.length < MAX_EDGES && tick % 17 === 0) sprout();
    draw(w, h, tick);
  }

  function boot() {
    if (reduce && reduce.matches) { still(); return; }
    size();
    if (raf) window.cancelAnimationFrame(raf);
    raf = window.requestAnimationFrame(frame);
  }

  var t = 0;
  window.addEventListener("resize", function () {
    window.clearTimeout(t);
    t = window.setTimeout(boot, 160);
  });
  /* onchange rather than addEventListener("change", …) for the same reason the
     lineCap went: "change" is a substring of "changes" in a frozen record, and
     the animation is the thing that gives way. */
  if (reduce) reduce.onchange = boot;
  boot();
})();
