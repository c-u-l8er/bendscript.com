export function createBreadcrumbController({
  breadcrumbsEl,
  state,
  breadcrumbList,
  triggerWarp,
  activePlane,
  setSelected,
  saveSoon,
}) {
  if (!breadcrumbsEl) {
    return {
      bind() {},
      update() {},
      cleanup() {},
    };
  }

  if (!state || typeof breadcrumbList !== "function") {
    throw new Error(
      "createBreadcrumbController requires `state` and `breadcrumbList`.",
    );
  }

  if (typeof triggerWarp !== "function") {
    throw new Error("createBreadcrumbController requires `triggerWarp`.");
  }

  if (typeof activePlane !== "function") {
    throw new Error("createBreadcrumbController requires `activePlane`.");
  }

  if (typeof setSelected !== "function") {
    throw new Error("createBreadcrumbController requires `setSelected`.");
  }

  if (typeof saveSoon !== "function") {
    throw new Error("createBreadcrumbController requires `saveSoon`.");
  }

  let bound = false;
  let disposed = false;
  let signature = "";

  const onPointerDown = (e) => {
    if (disposed) return;

    const btn = e.target.closest(".crumb[data-plane-id]");
    if (!btn) return;
    if (btn.classList.contains("current")) return;

    e.preventDefault();

    const planeId = btn.getAttribute("data-plane-id");
    if (!planeId || !state.planes?.[planeId]) return;

    triggerWarp(() => {
      state.activePlaneId = planeId;
      const p = activePlane();
      setSelected(p?.nodes?.[0]?.id || null);
      saveSoon();
    });
  };

  function bind() {
    if (bound || disposed) return;
    breadcrumbsEl.addEventListener("pointerdown", onPointerDown);
    bound = true;
  }

  function update() {
    if (disposed) return;

    bind();

    const crumbs = breadcrumbList(state.activePlaneId) || [];
    const nextSignature = crumbs.map((p) => `${p.id}:${p.name}`).join(">");

    if (nextSignature === signature) return;
    signature = nextSignature;

    breadcrumbsEl.innerHTML = "";

    crumbs.forEach((plane, i) => {
      const btn = document.createElement("button");
      btn.className = `crumb${i === crumbs.length - 1 ? " current" : ""}`;
      btn.textContent = plane.name;
      btn.setAttribute("data-plane-id", plane.id);

      breadcrumbsEl.appendChild(btn);

      if (i < crumbs.length - 1) {
        const sep = document.createElement("span");
        sep.className = "crumb-sep";
        sep.textContent = "›";
        breadcrumbsEl.appendChild(sep);
      }
    });
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;

    if (bound) {
      breadcrumbsEl.removeEventListener("pointerdown", onPointerDown);
      bound = false;
    }
  }

  return {
    bind,
    update,
    cleanup,
  };
}
