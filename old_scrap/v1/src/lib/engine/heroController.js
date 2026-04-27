export function initHeroController() {
  if (typeof window === "undefined") return;

  (() => {
    const hero = document.getElementById("heroSection");
    const app = document.getElementById("appSection");
    const backBtn = document.getElementById("backToTop");
    const body = document.body;
    let hasEnteredApp = false;
    let lockTimer = null;

    function lockIntoAppView() {
      body.style.overflow = "hidden";
      backBtn.classList.add("visible");
    }

    function enterApp(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      hasEnteredApp = true;

      // Ensure page can move before trying to jump to app section.
      body.style.overflow = "auto";
      body.style.overflowX = "hidden";

      const targetY = app.offsetTop || window.innerHeight;

      // Primary path: smooth jump to app section.
      window.scrollTo({ top: targetY, behavior: "smooth" });

      // Fallback for browsers that ignore smooth scroll in this layout.
      requestAnimationFrame(() => {
        const y = body.scrollTop || document.documentElement.scrollTop;
        if (y < targetY * 0.5) {
          body.scrollTop = targetY;
          document.documentElement.scrollTop = targetY;
          window.scrollTo(0, targetY);
        }
      });

      // Lock scroll after navigation settles.
      if (lockTimer) clearTimeout(lockTimer);
      lockTimer = setTimeout(lockIntoAppView, 380);
    }

    function exitToHero() {
      // Unlock scroll, reset to full height, jump to top
      if (lockTimer) clearTimeout(lockTimer);
      body.style.overflow = "auto";
      body.style.overflowX = "hidden";
      backBtn.classList.remove("visible");
      // Jump immediately then smooth-scroll to top for a polished feel
      body.scrollTop = 1;
      document.documentElement.scrollTop = 1;
      requestAnimationFrame(() => {
        hero.scrollIntoView({ behavior: "smooth" });
      });
    }

    // CTA buttons → enter app
    document.getElementById("heroCta").addEventListener("click", enterApp);
    document
      .getElementById("heroScrollBtn")
      .addEventListener("click", enterApp);

    // HOME button → exit to hero
    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      exitToHero();
    });

    // Also catch natural scroll past halfway (mouse wheel on hero)
    let scrollWatching = true;
    const onScroll = () => {
      if (!scrollWatching) return;
      const scrollY = body.scrollTop || document.documentElement.scrollTop;
      if (scrollY > window.innerHeight * 0.35) {
        scrollWatching = false;
        enterApp();
      }
    };
    body.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, {
      passive: true,
    });

    // Re-enable scroll watching after returning to hero
    const heroObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.8) {
            scrollWatching = true;
          }
        });
      },
      { threshold: [0.8] },
    );
    heroObserver.observe(hero);

    // Ensure we start at hero on load (unless user already entered app)
    window.addEventListener("load", () => {
      if (hasEnteredApp) return;
      body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    });
  })();
}
