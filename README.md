# Google Messages Web — Hide Sidebar

A small Firefox addon that hides the conversation sidebar on [Google Messages Web](https://messages.google.com/web/) and replaces it with a slim edge-attached toggle button.

## What it does

- Hides the entire left sidebar (conversation list **and** the *Start chat* button) on every page load — frees the full window width for the active conversation.
- Adds a small drawer-handle button on the left edge of the viewport. Click to show the sidebar, click again to hide.
- Remembers the last conversation you viewed and re-opens it when you return to the app, so the hidden sidebar doesn't drop you back at an empty welcome screen.
- Works inside Firefox **Taskbar Tabs** / site-windows.

## Install

### From AMO

Coming soon — see [Mozilla Add-ons](https://addons.mozilla.org/) once the listing is live.

### Temporary install (development)

1. Open Firefox → `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and pick `manifest.json` from this repo.
3. The addon will run on `https://messages.google.com/web/*`. Reload Google Messages if it was already open.

## Privacy

This addon stores exactly one piece of data: the id of your most recently viewed conversation, kept in
[`browser.storage.local`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local).
That data lives on your device, is scoped to the addon, and is **never transmitted anywhere** — there is no network code in the addon at all.

If a stored conversation id later points to a deleted or inaccessible conversation, the addon detects the bounce and clears the stored id automatically.

## Build

The project ships as plain HTML/CSS/JS — no build step is required to run it. To lint and produce a release zip:

```
npx web-ext lint
npx web-ext build
```

`web-ext build` writes a signed-ready zip to `web-ext-artifacts/`.

## How it works

A single content script runs at `document_start` on `https://messages.google.com/web/*`:

1. Adds a `gmw-sidebar-hidden` class to `<html>`. CSS rules in [`content/hide-sidebar.css`](content/hide-sidebar.css) hide `mw-main-nav` (the left sidebar container) when that class is present.
2. Injects a fixed-position toggle button into `<body>` and listens for click to flip the class.
3. Hooks `history.pushState` / `replaceState` to capture the current conversation id whenever the SPA navigates to `/web/conversations/<id>`.
4. On load, if the URL is the bare `/web/conversations`, swaps in the stored conversation id via `history.replaceState` and synthesises a `popstate` event so Angular's Router picks up the change. A second `popstate` is dispatched once `<mw-main-nav>` appears, to handle cold loads where Angular's listener wasn't yet attached when the first one fired.

Source layout:

- [`manifest.json`](manifest.json) — MV3 manifest, Firefox 109+.
- [`content/hide-sidebar.js`](content/hide-sidebar.js) — content script.
- [`content/hide-sidebar.css`](content/hide-sidebar.css) — sidebar hide rule + toggle button styles.
- [`icons/`](icons/) — addon icons.

## License

[MIT](LICENSE).
