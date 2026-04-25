(() => {
  if (!location.pathname.startsWith("/web/")) return;

  const HIDDEN_CLASS = "gmw-sidebar-hidden";
  const TARGET_CLASS = "gmw-sidebar-target";
  const BUTTON_CLASS = "gmw-toggle-btn";
  const STORAGE_KEY = "hidden";

  // Defensive selector chain — Google Messages' DOM is not a public API and may shift.
  // The first match wins. If none match, the script no-ops cleanly.
  const SIDEBAR_SELECTORS = [
    "mws-conversations-list",
    "mws-conversation-list",
    "mws-main-nav",
    "nav[role=\"navigation\"]",
  ];

  let hidden = true;
  let initialized = false;

  const findSidebar = () => {
    for (const sel of SIDEBAR_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  };

  const tagSidebar = () => {
    const el = findSidebar();
    if (el && !el.classList.contains(TARGET_CLASS)) {
      el.classList.add(TARGET_CLASS);
    }
    return el;
  };

  const applyState = () => {
    document.documentElement.classList.toggle(HIDDEN_CLASS, hidden);
    const btn = document.querySelector("." + BUTTON_CLASS);
    if (btn) btn.setAttribute("aria-pressed", String(hidden));
  };

  const ICON_SVG =
    "<svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\">" +
    "<path fill=\"currentColor\" d=\"M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm2 0v14h5V5H5Zm7 0v14h7V5h-7Z\"/>" +
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
    btn.addEventListener("click", async () => {
      hidden = !hidden;
      applyState();
      try {
        await browser.storage.local.set({ [STORAGE_KEY]: hidden });
      } catch (_) {
        // storage failures are non-fatal — the toggle still works for this session
      }
    });
    document.body.appendChild(btn);
  };

  const sync = () => {
    try {
      tagSidebar();
      ensureButton();
      applyState();
    } catch (err) {
      console.warn("[gmw-hide-sidebar] sync failed", err);
    }
  };

  const init = async () => {
    if (initialized) return;
    initialized = true;
    try {
      const stored = await browser.storage.local.get({ [STORAGE_KEY]: true });
      hidden = !!stored[STORAGE_KEY];
    } catch (_) {
      hidden = true;
    }
    sync();
  };

  init();

  // SPA-safe: re-tag the sidebar and re-inject the button after route changes
  // or re-renders. Debounced via requestAnimationFrame so we don't run on
  // every keystroke in the message composer.
  let pending = false;
  const obs = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      sync();
    });
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
