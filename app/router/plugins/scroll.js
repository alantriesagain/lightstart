const RESTORE_MS = 1000;
const READER_INPUT = ["wheel", "touchstart", "pointerdown", "keydown"];

/**
 * Scroll behavior for client-side navigation: scroll to top on push
 * navigation, restore the saved position on back/forward, honor the URL
 * hash. MPA navigation gets all of this from the browser for free; a
 * soft-navigating router must provide it or every navigation lands
 * mid-page.
 *
 * What scrolls is the window, unless the page marks its own scroll container
 * with `data-scroll-root` (a column that scrolls under fixed chrome), and
 * then it is that element. A replace that stays on the same path, a filter
 * written into the query, keeps where the reader is. Back puts the saved
 * position back from the first frame the page draws, without waiting for it
 * to settle, and holds it until a moment after it has: through a page still
 * growing into it or a render that resets it. It lets go as soon as the
 * reader touches, wheels, clicks or types, or goes somewhere else.
 *
 * @param {import("../types.js").RouterCore} router
 * @param {{ settle?: { whenIdle: (opts?: object) => Promise<unknown> } }} [app]
 */
export function installScrollBehavior(router, app) {
  if (typeof window === "undefined" || router.adapter?.type !== "browser") return;
  if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";

  const settled = () => app?.settle?.whenIdle({ timeout: 3000 })?.catch?.(() => {}) ?? Promise.resolve();
  const root = () => document.querySelector("[data-scroll-root]");
  const read = () => root()?.scrollTop ?? window.scrollY;
  /** @param {number} y */
  const write = (y) => {
    const el = root();
    if (el) el.scrollTop = y;
    else window.scrollTo(0, y);
  };

  let release = () => {};
  /** @param {number} y */
  const restore = (y) => {
    let until = Infinity;
    let held = true;
    const letGo = () => { held = false; };
    for (const type of READER_INPUT) window.addEventListener(type, letGo, { capture: true, passive: true });
    release = letGo;
    settled().then(() => { until = performance.now() + RESTORE_MS; });
    const step = () => {
      if (!held || performance.now() > until) {
        for (const type of READER_INPUT) window.removeEventListener(type, letGo, { capture: true });
        return;
      }
      if (Math.abs(read() - y) > 1) write(y);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /** @type {"" | "push" | "history"} */
  let pending = "";
  /** @type {string | null} */
  let lastPath = null;

  const originalPushState = router._pushState.bind(router);
  router._pushState = (path, state) => {
    window.history.replaceState({ ...window.history.state, __scrollY: read() }, "", window.location.href);
    pending = "push";
    originalPushState(path, state);
  };

  const originalHistoryNav = router.handleHistoryNavigation.bind(router);
  router.handleHistoryNavigation = () => {
    pending = "history";
    originalHistoryNav();
  };

  router.subscribe("currentRoute", async (route) => {
    const nav = pending;
    pending = "";
    release();
    const path = route?.path ?? null;
    const moved = path !== lastPath;
    lastPath = path;
    if (!nav && !moved) return;
    const saved = nav === "history" ? window.history.state?.__scrollY : null;
    if (saved != null) return void restore(saved);
    const hash = /** @type {{ hash?: string }} */ (route)?.hash;
    if (nav === "push" && !hash) return void write(0);
    await settled();
    if (hash) {
      let target = document.getElementById(hash.slice(1));
      if (!target) try { target = document.querySelector(hash); } catch {}
      if (target) return void target.scrollIntoView();
    }
    write(0);
  });
}

export default installScrollBehavior;
