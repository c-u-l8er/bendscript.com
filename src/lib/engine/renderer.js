/**
 * Extracted canvas renderer for BendScript migration.
 *
 * These functions are intentionally dependency-injected so runtime/state helpers
 * can remain owned by the caller during incremental extraction.
 */

function required(name, value) {
  if (value == null) {
    throw new Error(`renderer: missing required dependency "${name}"`);
  }
  return value;
}

export function drawBackground({ ctx, W, H }) {
  required("ctx", ctx);

  ctx.fillStyle = "#f4f6f8";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#e0e4e8";
  const spacing = 20;
  for (let x = 0; x < W; x += spacing) {
    for (let y = 0; y < H; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawEdges({ ctx, plane, W, H, t, state, deps = {} }) {
  required("ctx", ctx);
  required("plane", plane);
  required("state", state);

  const connectedNodes = required("connectedNodes", deps.connectedNodes);
  const findNode = required("findNode", deps.findNode);
  const edgeAnchorPair = required("edgeAnchorPair", deps.edgeAnchorPair);
  const projectToScreen = required("projectToScreen", deps.projectToScreen);
  const dist = required("dist", deps.dist);
  const normalizeEdgeProps = required(
    "normalizeEdgeProps",
    deps.normalizeEdgeProps,
  );
  const clamp = required("clamp", deps.clamp);

  const selectedNodeId = state.ui.selectedNodeId;
  const selectedEdgeId = state.ui.selectedEdgeId;
  const connected = selectedNodeId
    ? connectedNodes(plane, selectedNodeId)
    : null;

  const kindColor = (kind) => {
    if (kind === "causal") return [255, 109, 90];
    if (kind === "temporal") return [139, 92, 246];
    if (kind === "associative") return [16, 185, 129];
    if (kind === "user") return [245, 158, 11];
    return [163, 168, 176];
  };

  for (const e of plane.edges) {
    const a = findNode(plane, e.a);
    const b = findNode(plane, e.b);
    if (!a || !b) continue;

    const anchors = edgeAnchorPair(a, b);
    const A = projectToScreen(anchors.a.x, anchors.a.y, plane.camera, W, H);
    const B = projectToScreen(anchors.b.x, anchors.b.y, plane.camera, W, H);
    const edgeDist = dist(anchors.a.x, anchors.a.y, anchors.b.x, anchors.b.y);
    const props = normalizeEdgeProps(e.props);

    const nodeHighlight =
      selectedNodeId && (e.a === selectedNodeId || e.b === selectedNodeId);
    const nearSelectedNode =
      selectedNodeId && connected?.has(e.a) && connected?.has(e.b);
    const edgeSelected = selectedEdgeId === e.id;

    const [r, g, bCol] = kindColor(props.kind);

    let alpha = 0.4;
    if (nodeHighlight) alpha = 0.8;
    else if (nearSelectedNode) alpha = 0.6;
    if (edgeSelected) alpha = 1.0;

    const strength = clamp(Number(props.strength) || 1, 1, 5);
    const baseWidth = 1.1 + strength * 0.45;
    const width = edgeSelected
      ? baseWidth + 1.4
      : nodeHighlight
        ? baseWidth + 0.75
        : baseWidth;

    ctx.strokeStyle = `rgba(${r},${g},${bCol},${alpha})`;
    ctx.lineWidth = width;
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();

    // Directed arrowheads for causal/temporal edges
    if (props.kind === "causal" || props.kind === "temporal") {
      const angle = Math.atan2(B.y - A.y, B.x - A.x);
      const arrowLen = 10;
      const arrowAngle = Math.PI / 6;

      ctx.beginPath();
      ctx.moveTo(B.x, B.y);
      ctx.lineTo(
        B.x - arrowLen * Math.cos(angle - arrowAngle),
        B.y - arrowLen * Math.sin(angle - arrowAngle),
      );
      ctx.moveTo(B.x, B.y);
      ctx.lineTo(
        B.x - arrowLen * Math.cos(angle + arrowAngle),
        B.y - arrowLen * Math.sin(angle + arrowAngle),
      );
      ctx.stroke();
    }

    const flowCount = edgeSelected ? 5 : nodeHighlight ? 4 : 2;
    for (let i = 0; i < flowCount; i++) {
      const tt =
        (t * 0.00024 * (edgeSelected ? 1.85 : nodeHighlight ? 1.35 : 1.0) +
          e.flowOffset +
          i / flowCount) %
        1;

      const px = A.x + (B.x - A.x) * tt;
      const py = A.y + (B.y - A.y) * tt;
      const rad = edgeSelected ? 2.8 : nodeHighlight ? 2.2 : 1.55;

      ctx.fillStyle = `rgba(${r},${g},${bCol},1)`;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    const showLabel =
      (props.label && props.label.trim()) || plane.camera.zoom > 0.95;
    if (showLabel && edgeDist > 110) {
      const mx = (A.x + B.x) * 0.5;
      const my = (A.y + B.y) * 0.5;
      const label = props.label?.trim()
        ? props.label.trim()
        : `${props.kind} · ${props.strength}`;

      ctx.font = "11px ui-monospace, monospace";
      const tw = Math.ceil(ctx.measureText(label).width);
      const padX = 6;
      const boxW = tw + padX * 2;
      const boxH = 18;
      const bx = mx - boxW * 0.5;
      const by = my - boxH * 0.5 - 6;

      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#222222";
      ctx.lineWidth = edgeSelected ? 1.2 : 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = `rgba(${r},${g},${bCol},0.98)`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, mx, by + boxH * 0.55);
    }
  }

  ctx.shadowBlur = 0;
}

export function drawNodes({ ctx, plane, W, H, t, state, deps = {} }) {
  required("ctx", ctx);
  required("plane", plane);
  required("state", state);

  const connectedNodes = required("connectedNodes", deps.connectedNodes);
  const projectToScreen = required("projectToScreen", deps.projectToScreen);
  const nodeCardSize = required("nodeCardSize", deps.nodeCardSize);
  const dist = required("dist", deps.dist);
  const clamp = required("clamp", deps.clamp);
  const isEditMode = required("isEditMode", deps.isEditMode);
  const drawNodeText = required("drawNodeText", deps.drawNodeText);
  const syncNodeMdOverlayForSelection = required(
    "syncNodeMdOverlayForSelection",
    deps.syncNodeMdOverlayForSelection,
  );

  const NODE_BODY_TOP_PAD = deps.NODE_BODY_TOP_PAD ?? 10;
  const NODE_BODY_BOTTOM_PAD = deps.NODE_BODY_BOTTOM_PAD ?? 12;

  const selectedId = state.ui.selectedNodeId;
  const connected = selectedId ? connectedNodes(plane, selectedId) : null;

  for (const n of plane.nodes) {
    const P = projectToScreen(n.x, n.y, plane.camera, W, H);
    const size = nodeCardSize(n);
    const w = size.width * plane.camera.zoom;
    const h = size.height * plane.camera.zoom;
    const r = Math.max(10, size.corner * plane.camera.zoom);

    const x = P.x - w * 0.5;
    const y = P.y - h * 0.5;
    const headerH = clamp(h * 0.2, 24, 70);
    const pad = clamp(h * 0.09, 10, 28);

    const dFromCenter = dist(P.x, P.y, W * 0.5, H * 0.5);
    const far = dFromCenter / Math.max(W, H);
    const blur = clamp((far - 0.58) * 8, 0, 3);

    const selected = n.id === selectedId;
    const surrounding = !!selectedId && !selected && connected?.has(n.id);

    let cardTop = "#ffffff";
    let cardBottom = "#ffffff";
    let chrome = "#f4f6f8";
    let border = "#e0e4e8";
    let glow = "rgba(0,0,0,0.08)";
    let titleColor = "#222222";
    let bodyColor = "#666666";
    let badgeBg = "#f4f6f8";
    let badgeText = "#666666";

    if (n.type === "stargate") {
      cardTop = "#ffffff";
      cardBottom = "#ffffff";
      chrome = "#fff0ed";
      border = "#ff6d5a";
      glow = "rgba(255,109,90,0.2)";
      titleColor = "#222222";
      bodyColor = "#666666";
      badgeBg = "#fff0ed";
      badgeText = "#ff6d5a";
    }

    if (n.pinned) {
      border = "#10b981";
      glow = "rgba(16,185,129,0.2)";
    }

    if (selected) {
      border = "#ff6d5a";
      glow = "rgba(255,109,90,0.55)";
    } else if (surrounding) {
      glow = glow.replace(/[\d.]+\)$/, "0.34)");
    }

    const alpha = 1;
    const pulse = 1 + Math.sin(t * 0.0015 + n.pulse) * 0.012;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = blur > 0 ? `blur(${blur}px)` : "none";

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, cardTop);
    grad.addColorStop(1, cardBottom);

    ctx.shadowColor = glow;
    ctx.shadowBlur = selected ? 24 : surrounding ? 14 : 8;
    ctx.shadowOffsetY = selected ? 4 : surrounding ? 4 : 4;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(
      x - w * (pulse - 1) * 0.5,
      y - h * (pulse - 1) * 0.5,
      w * pulse,
      h * pulse,
      r,
    );
    ctx.fill();

    ctx.fillStyle = chrome;
    ctx.beginPath();
    ctx.roundRect(x, y, w, headerH, [r, r, 10, 10]);
    ctx.fill();

    ctx.strokeStyle = border;
    ctx.lineWidth = selected ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();

    const modeTag = isEditMode() ? "EDIT" : "PREVIEW";
    ctx.font = `${Math.max(10, h * 0.072)}px ui-monospace, monospace`;
    const modeW = ctx.measureText(modeTag).width + 14;
    const modeX = x + pad;
    const modeY = y + headerH * 0.5 - 8;
    ctx.fillStyle = isEditMode()
      ? "rgba(255,109,90,0.15)"
      : "rgba(224,228,232,0.5)";
    ctx.beginPath();
    ctx.roundRect(modeX, modeY, modeW, 16, 8);
    ctx.fill();
    ctx.fillStyle = isEditMode() ? "#ff6d5a" : "#666666";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(modeTag, modeX + modeW * 0.5, modeY + 8.4);

    const badge =
      n.type === "stargate" ? "STARGATE ⊛" : n.pinned ? "PINNED" : "NODE";
    ctx.font = `${clamp(h * 0.062, 9, 15)}px ui-monospace, monospace`;
    const badgeW = ctx.measureText(badge).width + 12;
    const bx = x + w - pad - badgeW;
    const by = y + headerH * 0.5 - 8;
    ctx.fillStyle = badgeBg;
    ctx.beginPath();
    ctx.roundRect(bx, by, badgeW, 16, 8);
    ctx.fill();
    ctx.fillStyle = badgeText;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(badge, bx + badgeW * 0.5, by + 8.5);

    if (n.type === "stargate") {
      const spin = t * 0.0017;
      const cx = x + w - pad - 14;
      const cy = y + h - pad - 14;
      const rr = clamp(h * 0.115, 11, 28);
      for (let k = 0; k < 2; k++) {
        ctx.strokeStyle =
          k === 0 ? "rgba(255,109,90,0.8)" : "rgba(139,92,246,0.8)";
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          rr + k * 4,
          spin + k * Math.PI * 0.65,
          spin + Math.PI + k * Math.PI * 0.65,
        );
        ctx.stroke();
      }
    }

    const bodySize = clamp(h * 0.072, 11, 20);
    const lineHeight = Math.round(bodySize * 1.28);
    const bodyX = x + pad;
    const bodyY = y + headerH + NODE_BODY_TOP_PAD;
    const bodyW = Math.max(28, w - pad * 2);
    const bodyH = Math.max(
      18,
      h - headerH - NODE_BODY_TOP_PAD - NODE_BODY_BOTTOM_PAD,
    );

    ctx.fillStyle = bodyColor;
    const content = drawNodeText(
      n,
      n.text,
      bodyX,
      bodyY,
      bodyW,
      bodyH,
      lineHeight,
      bodyColor,
      bodySize,
    );

    if (content.maxScroll > 0) {
      const trackW = 5;
      const tx = x + w - 9;
      const ty = bodyY;
      const th = bodyH;

      ctx.fillStyle = "rgba(163,168,176,0.25)";
      ctx.beginPath();
      ctx.roundRect(tx, ty, trackW, th, 3);
      ctx.fill();

      const thumbH = clamp((bodyH / (bodyH + content.maxScroll)) * th, 18, th);
      const ratio = content.maxScroll <= 0 ? 0 : n.scrollY / content.maxScroll;
      const thumbY = ty + (th - thumbH) * ratio;

      ctx.fillStyle = "rgba(255,109,90,0.72)";
      ctx.beginPath();
      ctx.roundRect(tx, thumbY, trackW, thumbH, 3);
      ctx.fill();
    }

    if (isEditMode()) {
      const hx = x + w - 12;
      const hy = y + h - 12;
      ctx.strokeStyle = "rgba(163,168,176,0.85)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx - 8, hy);
      ctx.lineTo(hx, hy - 8);
      ctx.moveTo(hx - 4, hy);
      ctx.lineTo(hx, hy - 4);
      ctx.stroke();
    }

    if (selected) {
      ctx.strokeStyle = "#ff6d5a";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.roundRect(x - 6, y - 6, w + 12, h + 12, r + 4);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Preserve color vars used for parity (titleColor currently reserved)
    void titleColor;

    ctx.restore();
  }

  syncNodeMdOverlayForSelection();
}
