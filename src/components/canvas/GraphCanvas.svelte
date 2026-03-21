<script>
    import { onMount } from "svelte";

    let canvas;
    let ctx;

    function resize() {
        if (!canvas) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = window.innerWidth;
        const height = window.innerHeight;

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    onMount(() => {
        ctx = canvas?.getContext("2d") ?? null;
        resize();
    });
</script>

<svelte:window on:resize={resize} />
<canvas bind:this={canvas} id="graph"></canvas>

<style>
    #graph {
        position: absolute;
        inset: 0;
        display: block;
        width: 100%;
        height: 100%;
        touch-action: none;
    }
</style>
