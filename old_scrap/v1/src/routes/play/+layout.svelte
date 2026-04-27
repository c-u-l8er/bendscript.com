<amp-nav property="bendscript"></amp-nav>
<slot />

<style>
  :global(html),
  :global(body) {
    margin: 0 !important;
    height: 100% !important;
    overflow: hidden !important;
    scroll-snap-type: none !important;
    user-select: auto !important;
    -webkit-user-select: auto !important;
    box-sizing: border-box !important;
  }

  /* Reserve space for the 56px portfolio nav at the top. amp-nav
     v0.3.x injects body padding-top via JS, but this layout's
     own !important body overflow/height rules would fight it,
     so pin it here explicitly and use box-sizing: border-box
     to keep total body height at 100% of viewport. */
  :global(body) {
    padding-top: 56px !important;
  }
</style>
