# Loddi static website

`index.html` is the landing page; `documentation.html` is the guide. This branch contains the static website, ready for review. GitHub Pages remains disabled until explicitly configured. Press `/` for site navigation or `?` for shortcuts; these are website controls, not a browser-based TUI.

Preview from this branch root with `npx serve .` and open the local URL printed by the server. A web server is required for the `.cast` files; opening `index.html` directly as `file://` may block them.

The two asciicast v2 files contain short local CLI examples, not recordings of the interactive TUI. Replace them with real editor recordings after reviewing them for private paths, credentials and manuscript text. The player is loaded from a pinned jsDelivr URL; the page has a text fallback if the CDN is unavailable.
