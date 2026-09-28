# Loddi TUI

Loddi is a cross-platform terminal publishing environment for writing books in Markdown. Project files remain plain Markdown, YAML, BibTeX, images, and other portable assets.

## Current features

- project creation and validated `book.yaml` manifests;
- cover, chapter, section, image, and bibliography structure;
- automatically generated `SUMMARY.md`;
- centered manuscript search and command launcher;
- single-pane Markdown source editor with Markdown and language-aware code highlights, plus quick insertion of headings, code, diagrams, math, images, and citations;
- optional Codex assistant in the editor palette for insert, block edit, and chat, with a proposal preview before applying;
- project checks and optional dependency detection;
- EPUB and PDF export pipeline;
- user-local, on-demand Pandoc and Typst installation;
- inline slash commands and modal operational screens;
- publication page boundaries for cover, contents, front matter, and chapters;
- multilingual Unicode manuscripts and system-font selection for Typst PDF export;
- BibTeX bibliography management with import, search, deletion, and multi-citation insertion;
- manuscript structure management: reorder and remove chapters and sections from the launcher;
- document renaming with manifest, contents heading, summary, and ordinary Markdown links updated;
- highlighted Markdown source for images, Mermaid blocks, and LaTeX math; full publication rendering is handled by Pandoc.

## Supported platforms

- Windows 10/11, including Windows Terminal and PowerShell;
- current macOS releases on Intel and Apple Silicon;
- x64 and ARM64 Linux distributions.

Node.js 22.20 or newer is required. Pandoc and Typst are optional and only needed for publishing:

- EPUB requires Pandoc;
- PDF uses Pandoc and Typst by default;
- Loddi can download official Pandoc and Typst binaries without administrator permissions.

See [Installation](docs/INSTALL.md) for platform-specific instructions, update, and uninstall steps.

## Development

```bash
npm install
npm run check
npm run build
```

## Documentation site

The static landing page and documentation are in [`site/`](site/README.md), with local asciicast demos. Preview them with `npx serve site`. The `gh-pages` branch contains a copy ready for review, but GitHub Pages is not configured for deployment. On the website, `/` opens navigation commands and `?` shows shortcuts.

The package can be checked without a global install:

```bash
npm run smoke:package
npm run smoke:publishing # requires Pandoc and Typst
```

The GitHub Actions matrix is prepared for Linux x64/ARM64, Windows x64, and macOS Intel/Apple Silicon. Its publishing-tool job runs when started manually.

Create and open a book:

```bash
node dist/cli.js init ./my-book --title "My book"
node dist/cli.js ./my-book
```

Open a Markdown file directly, without a Loddi project or manuscript tree:

```bash
loddi ./notes.md
```

This opens only that file in the editor. Saving changes the Markdown file; it does not create `book.yaml`, `SUMMARY.md`, or a bibliography. To manage and export an existing folder of Markdown files, initialize it with `loddi init ./folder --adopt`. Loddi indexes existing `.md` files in place, including files outside `chapters/`; it does not move or rewrite them. Root `README.md` and `SUMMARY.md` are not adopted. If a `SUMMARY.md` already exists, initialization stops instead of overwriting it.

For a new empty book folder, use ordinary `loddi init ./folder`. Both modes create the normal Loddi project structure for future additions.

During development:

```bash
npm run dev -- init ./my-book --title "My book"
npm run dev -- ./my-book
```

## Publishing tools

From the launcher, type `/` to reveal publishing commands above the input.

Type `/` or press `Ctrl+P` to reveal commands. Direct commands include:

```text
/export pdf
/export epub
/install pandoc
/install typst
/dependencies
/fonts
/references
/review
/check
/help
/quit
```

The same operations are available without the TUI:

```bash
loddi tools status
loddi tools install pandoc
loddi tools install typst
loddi export epub ./my-book
loddi export pdf ./my-book
```

Managed tools are stored in user data, not in the project or system directories. Set `LODDI_HOME` to override the location.

## Languages and fonts

The Loddi interface remains in English, while manuscript files are UTF-8 and may contain any language supported by the active terminal font. The terminal application controls the font used while editing.

For PDF typography, run `/fonts`. Loddi asks Typst for the font families installed on Windows, macOS, or Linux, lets you search the list, and stores the selection in `book.yaml`:

```yaml
language: ja-JP
output:
  pdfEngine: typst
  mainFont: Noto Serif CJK JP
```

Leave the font on `Automatic` to use Typst's normal font fallback.

## Reference libraries

Run `/references` to search the project's BibTeX library, import a `.bib` file, delete entries, or edit a reference's title, author, and year. Press `Enter` on a reference, then `T`, `A`, or `Y` to edit that field.

In Zotero, export a collection or library in BibTeX format, then press `Ctrl+I` in the References screen and enter the exported file path. Loddi appends new entries and skips keys that already exist in the project.

In the editor, `Ctrl+I` opens the citation picker. Press `Tab` to add entries to the basket for multi-key citations, `Ctrl+T` to toggle between narrative (`@key`) and parenthetical (`[@key]`) forms, then `Enter` to insert.

## Markdown support

Loddi uses Pandoc for export. The TUI edits highlighted Markdown source rather than trying to render everything in a terminal. Fenced code blocks use the language after the opening fence (for example, `typescript` or `python`) to highlight keywords, strings, numbers, types, and comments. Built-in rules cover JavaScript/TypeScript, C/C++, Java/C#, Python, Ruby, Rust, Go, shell, JSON, YAML, CSS, HTML/XML, SQL, Mermaid, and LaTeX; unknown languages receive basic highlighting. This is editor coloring, not a parser or code validator.

Supported Markdown syntax includes:

| Feature | Editor | PDF / EPUB |
|---|---|---|
| Headings `#`–`######` | highlighted source | ✓ |
| Bold, italic, strikethrough | highlighted source | ✓ |
| Fenced code blocks | highlighted source | ✓ (with language label) |
| Tables (pipe syntax) | highlighted source | ✓ |
| Images `![alt](path)` | highlighted source | ✓ embedded |
| Mermaid diagrams | highlighted source | as code block (no auto-render) |
| Citations `[@key]` | highlighted source | ✓ resolved by citeproc |
| Links | highlighted source | ✓ |

**Mermaid diagrams** are preserved in the Markdown source and appear as fenced code blocks in the final document. To render them as images in PDF or EPUB, configure an external pre-processor such as `mermaid-filter` or `mmdc` and pass it to Pandoc using a custom export command. Run `/check` to see a warning for each Mermaid block in the project.

Images should be stored in `assets/images/` and referenced with a path relative to the document:

```markdown
![A descriptive caption](../assets/images/figure.png)
```

## Keyboard

Launcher:

- `?`: open the shortcut and Markdown help screen;
- `/`: reveal commands inline; `Ctrl+P` remains an alternative;
- type text to search the cover, chapters, and sections;
- `↑` / `↓`: navigate results;
- `Page Up` / `Page Down`: move through long result lists;
- `Enter`: edit the selected document or run the selected command;
- `Ctrl+N`: create a chapter;
- `Ctrl+T`: create a front-matter section;
- `Ctrl+O`: create or edit the cover;
- `Ctrl+X`: export;
- `Ctrl+D` or `Ctrl+Q`: quit;
- `Ctrl+R`: manuscript review;
- `Alt+↑` / `Alt+↓`: reorder the selected chapter or section;
- `Ctrl+E`: rename the selected manuscript document (the cover remains a fixed entry);
- `Ctrl+W`: remove the selected document from the manifest (the file on disk is kept);

Editor:

- `Tab`: insert a two-space indentation at the cursor;
- `Ctrl+Delete` / `Ctrl+Del`: delete the next word (or join the next line at the end of a line);
- `Ctrl+S`: save;
- `Ctrl+P`: open the Markdown panel. Use `↑` / `↓` and `Enter`, or press `H` heading, `B` bold, `L` list, `C` code, `D` Mermaid diagram, `M` LaTeX math, or `I` image;
- `A` in the `Ctrl+P` panel opens the optional Codex assistant. Insert is the default mode; press `Tab` to switch to Edit block or Chat. Enter sends the request, then Enter applies a reviewed proposal to the unsaved buffer. Chat answers do not edit the document;
- in that panel, `E` moves the cursor into the current Markdown block for editing and `X` removes the whole block after confirmation. This includes code, Mermaid, math, headings, lists, images and bold text;
- `Ctrl+F`: find;
- `Ctrl+I`: open the citation picker;
  - `↑` / `↓`: navigate matching entries;
  - `Tab`: add selected entry to the citation basket (multi-citation);
  - `Ctrl+T`: toggle narrative / parenthetical form;
  - `Enter`: insert the citation (or all basket entries);
  - `Esc`: cancel;
- `Ctrl+Left` / `Ctrl+Right`: move by word;
- `Page Up` / `Page Down`: move by one editor page; mouse click positions the cursor and the wheel scrolls;
- `Ctrl+D`: delete the current line;
- `Ctrl+Q`: return to the dashboard, with confirmation for unsaved changes.

The AI assistant requires the separately installed [Codex CLI](https://learn.chatgpt.com/docs/codex/cli) (`npm install -g @openai/codex`). Open `Ctrl+P` → `A`: Loddi checks `codex login status`, offers device-code sign-in with `Enter` when needed, and shows the browser URL and code in the TUI. Codex stores and refreshes its own credentials; Loddi never asks for a password or API key. Press `Esc` to cancel sign-in, or `R` to recheck the status. If device-code sign-in is unavailable for your account, run `codex login` in another terminal and press `R`.

After authentication, Loddi starts `codex exec` in an empty temporary directory with a read-only sandbox and passes only the current Markdown block or line as context, not the whole manuscript. It never grants Codex direct write access to the book. Review all generated Markdown before applying and saving it. This is optional; ordinary editing and export do not depend on Codex.

References screen (`/references`):

- `↑` / `↓` / `Page Up` / `Page Down`: scroll entries;
- `Enter`: show entry detail;
- `Ctrl+I`: import a `.bib` file;
- `Ctrl+D`: delete the selected reference (asks for confirmation);
- `Enter`, then `T` / `A` / `Y`: edit title, author, or year;
- `Esc`: go back.

Press `?` on the launcher for the same reference, plus a Markdown syntax guide. Commands are available with `/`.

## Project validation

```bash
loddi check ./my-book
```

Missing publishing tools are warnings rather than project errors, so writing remains available without installing the export toolchain. Mermaid blocks in the manuscript produce a warning explaining the export limitation.

## Local playground

Generate an isolated sample book containing code, a Mermaid diagram, an SVG image, and a BibTeX citation:

```bash
npm run playground:init
npm run playground:open
```

The directory is excluded from Git. It can be regenerated or removed safely:

```bash
npm run playground:reset
npm run playground:clean
```
