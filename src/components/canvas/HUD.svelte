<script>
    import { createEventDispatcher } from "svelte";

    export let nodes = 0;
    export let edges = 0;
    export let depth = 0;
    export let zoom = "1.00x";
    export let mode = "EDIT";

    const dispatch = createEventDispatcher();

    function handleToggleMode() {
        dispatch("togglemode");
    }
</script>

<div class="hud">
    <div class="hud-row">
        <div class="brand">
            <b>BENDSCRIPT</b>
            <span>prompts become topology</span>
        </div>

        <div class="stats">
            <div class="pill">nodes <b id="statNodes">{nodes}</b></div>
            <div class="pill">edges <b id="statEdges">{edges}</b></div>
            <div class="pill">depth <b id="statDepth">{depth}</b></div>
            <div class="pill">zoom <b id="statZoom">{zoom}</b></div>
            <button
                class="pill pill-btn"
                id="nodeModeToggle"
                type="button"
                on:click={handleToggleMode}
            >
                mode: {mode}
            </button>
        </div>
    </div>

    <slot />
</div>
