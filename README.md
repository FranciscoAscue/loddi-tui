# Loddi static website

`index.html` is the landing page; `documentation.html` is the guide. This `site/` directory is the source of the [published website](https://franciscoascue.github.io/loddi-tui/). Copy its contents to the root of `gh-pages` when publishing changes. GitHub Pages serves that branch from its root. Press `/` for site navigation or `?` for shortcuts; these are website controls, not a browser-based TUI.

Preview from the repository root with `npx serve site` and open the local URL printed by the server. A web server is required for the `.cast` files; opening `index.html` directly as `file://` may block them.

The two asciicast v2 files contain short local CLI examples, not recordings of the interactive TUI. Replace them with real editor recordings after reviewing them for private paths, credentials and manuscript text. The player is loaded from a pinned jsDelivr URL; the page has a text fallback if the CDN is unavailable.
