(() => {
  if (!location.pathname.startsWith("/web/")) return;

  const HIDDEN_CLASS = "gmw-sidebar-hidden";
  const BUTTON_CLASS = "gmw-toggle-btn";
  const STORAGE_KEY = "lastConversationId";
  const CONV_PATH_RE = /^\/web\/conversations\/([^/?#]+)/;
  const BARE_CONVERSATIONS_RE = /^\/web\/conversations\/?$/;
  const ANGULAR_READY_SEL = "mw-main-nav, mw-app[ng-version]";

  let hidden = true;

  // ---- conversation persistence ---------------------------------------------------

  let cachedRestoreId = null;
  let cacheLoaded = false;
  let urlReplaced = false;
  let postBootPing = false;
  let restoreTime = 0;
  // Window in which a navigation back to the bare URL is treated as evidence
  // that the stored conversation is invalid (deleted, no permission, etc.)
  // rather than a deliberate user action.
  const BOUNCE_WINDOW_MS = 5000;

  const currentConversationId = () => {
    const m = location.pathname.match(CONV_PATH_RE);
    if (!m) return null;
    const id = m[1];
    if (!id || id === "new") return null;
    return id;
  };

  const storeCurrent = () => {
    const id = currentConversationId();
    if (!id) return;
    try {
      browser.storage.local.set({ [STORAGE_KEY]: id });
    } catch (_) {
      // storage may be unavailable in private browsing — ignore
    }
  };

  const pingRouter = () => {
    // Tell Angular's Router to re-read location.pathname.
    window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
  };

  // If we're on the bare conversation list URL, swap the URL to the stored
  // conversation id and ping Angular's Router. Re-entrant: safe to call from
  // multiple init points; only the first valid call replaces the URL.
  const tryRestoreNow = () => {
    if (urlReplaced) return;
    if (!cacheLoaded || !cachedRestoreId) return;
    if (!BARE_CONVERSATIONS_RE.test(location.pathname)) return;
    const target = "/web/conversations/" + encodeURIComponent(cachedRestoreId);
    // SPA-internal navigation: avoids a full reload, which is important inside
    // Firefox Taskbar Tabs where the pinned start URL can get re-asserted on
    // hard navigations. Angular's Router listens for popstate and will route
    // to the new URL — but only once it's bootstrapped (see ensurePostBootPing).
    history.replaceState(history.state, "", target);
    urlReplaced = true;
    restoreTime = performance.now();
    pingRouter();
  };

  // If the SPA navigates back to the bare conversation URL shortly after we
  // restored, the stored id is dead — clear it so future loads don't loop.
  const detectBounce = () => {
    if (!urlReplaced) return;
    if (performance.now() - restoreTime > BOUNCE_WINDOW_MS) return;
    if (!BARE_CONVERSATIONS_RE.test(location.pathname)) return;
    try {
      browser.storage.local.remove(STORAGE_KEY);
    } catch (_) {
      // ignore
    }
    cachedRestoreId = null;
    urlReplaced = false;
  };

  // Cold-load rescue: on first cache-cold open, our early popstate may fire
  // before Angular has attached its popstate listener. Re-dispatch popstate
  // once Angular's bootstrap markers are visible in the DOM.
  const ensurePostBootPing = () => {
    if (postBootPing) return;
    if (!urlReplaced) return;
    if (!document.querySelector(ANGULAR_READY_SEL)) return;
    postBootPing = true;
    pingRouter();
  };

  const initRestore = async () => {
    try {
      const stored = await browser.storage.local.get({ [STORAGE_KEY]: null });
      cachedRestoreId = stored[STORAGE_KEY] || null;
    } catch (_) {
      // ignore
    }
    cacheLoaded = true;
    tryRestoreNow();
  };

  // Catch SPA navigations so the stored id stays current.
  const installHistoryHooks = () => {
    for (const name of ["pushState", "replaceState"]) {
      const orig = history[name];
      if (!orig || orig.__gmwHooked) continue;
      const wrapped = function (...args) {
        const ret = orig.apply(this, args);
        try { storeCurrent(); detectBounce(); } catch (_) {}
        return ret;
      };
      wrapped.__gmwHooked = true;
      history[name] = wrapped;
    }
    window.addEventListener("popstate", () => {
      storeCurrent();
      detectBounce();
    });
  };

  // ---- toggle button --------------------------------------------------------------

  const applyState = () => {
    document.documentElement.classList.toggle(HIDDEN_CLASS, hidden);
    const btn = document.querySelector("." + BUTTON_CLASS);
    if (btn) btn.setAttribute("aria-pressed", String(hidden));
  };

  const ICON_SVG =
    "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">" +
    "<path fill=\"currentColor\" d=\"M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.42 1.42l4.59-4.59a1 1 0 0 0 0-1.42L10.71 6.71a1 1 0 0 0-1.42 0Z\"/>" +
    "</svg>";

  const ensureButton = () => {
    if (!document.body) return;
    if (document.querySelector("." + BUTTON_CLASS)) return;
    const btn = document.createElement("button");
    btn.className = BUTTON_CLASS;
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle conversation sidebar");
    btn.setAttribute("aria-pressed", String(hidden));
    btn.innerHTML = ICON_SVG;
    btn.addEventListener("click", () => {
      hidden = !hidden;
      applyState();
    });
    document.body.appendChild(btn);
  };

  // ---- init -----------------------------------------------------------------------

  // Hide as early as possible to avoid a flash of the sidebar before CSS+class apply.
  applyState();

  installHistoryHooks();
  initRestore();
  storeCurrent();

  const onReady = () => {
    ensureButton();
    applyState();
    tryRestoreNow();
    ensurePostBootPing();

    let pending = false;
    const obs = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        try {
          ensureButton();
          applyState();
          tryRestoreNow();
          ensurePostBootPing();
        } catch (err) {
          console.warn("[gmw-hide-sidebar]", err);
        }
      });
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady, { once: true });
  } else {
    onReady();
  }
})();
