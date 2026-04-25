(() => {
  if (!location.pathname.startsWith("/web/")) return;

  const HIDDEN_CLASS = "gmw-sidebar-hidden";
  const BUTTON_CLASS = "gmw-toggle-btn";
  const STORAGE_KEY = "lastConversationId";
  const CONV_PATH_RE = /^\/web\/conversations\/([^/?#]+)/;
  const BARE_CONVERSATIONS_RE = /^\/web\/conversations\/?$/;

  let hidden = true;

  // ---- conversation persistence ---------------------------------------------------

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

  // If we landed on the bare conversation list URL, redirect to the most-recently
  // viewed conversation. Async — the redirect fires after a microtask, but at
  // document_start that's still before any meaningful render.
  const tryRestoreConversation = async () => {
    if (!BARE_CONVERSATIONS_RE.test(location.pathname)) return;
    let stored;
    try {
      stored = await browser.storage.local.get({ [STORAGE_KEY]: null });
    } catch (_) {
      return;
    }
    const id = stored[STORAGE_KEY];
    if (!id) return;
    const target = "/web/conversations/" + encodeURIComponent(id);
    // SPA-internal navigation: avoids a full reload, which is important inside
    // Firefox Taskbar Tabs where the pinned start URL can get re-asserted on
    // hard navigations. Angular's Router listens for popstate and will route
    // to the new URL.
    history.replaceState(history.state, "", target);
    window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
  };

  // Catch SPA navigations so the stored id stays current.
  const installHistoryHooks = () => {
    for (const name of ["pushState", "replaceState"]) {
      const orig = history[name];
      if (!orig || orig.__gmwHooked) continue;
      const wrapped = function (...args) {
        const ret = orig.apply(this, args);
        try { storeCurrent(); } catch (_) {}
        return ret;
      };
      wrapped.__gmwHooked = true;
      history[name] = wrapped;
    }
    window.addEventListener("popstate", storeCurrent);
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

  tryRestoreConversation();
  installHistoryHooks();
  storeCurrent();

  const onReady = () => {
    ensureButton();
    applyState();

    let pending = false;
    const obs = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        try {
          ensureButton();
          applyState();
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
