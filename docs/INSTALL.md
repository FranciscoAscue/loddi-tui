# Installing Loddi

Loddi uses the same npm package on Windows, macOS, and Linux. Node.js 22.20 or newer is required. Until Loddi is published on npm, installation from GitHub also requires Git. Pandoc and Typst remain optional.

## Quick install from GitHub

On Linux or macOS, inspect [the installer](../scripts/install.sh) before running a remote script, then run:

```bash
curl -fsSL https://raw.githubusercontent.com/FranciscoAscue/loddi-tui/master/scripts/install.sh | bash
loddi --version
```

The script checks Node.js, npm and Git, installs Loddi globally through npm, and does not use `sudo`. It does not install Node.js or modify your shell configuration. If your npm global prefix is not writable, configure a user-owned Node/npm installation (for example with a Node version manager) and rerun it. A successful install needs npm's global bin directory on `PATH`.

On Windows, run this in PowerShell or Windows Terminal after installing Node.js and Git:

```powershell
npm install --global "github:FranciscoAscue/loddi-tui#master"
loddi --version
```

These GitHub commands track `master`, so updates may change the installed code. npm runs this repository's `prepare` build when installing from Git. For a reproducible install, replace `#master` in the npm command with a reviewed commit hash. The installer URL itself should likewise be reviewed before piping it to Bash.

## From npm (recommended once published)

```bash
npm install --global loddi-tui
loddi --help
```

After installation, `loddi ./notes.md` opens one Markdown file directly. Use `loddi init ./my-book` for a new empty project, or `loddi init ./existing-folder --adopt` to index Markdown files already in a folder without moving them. Then open the folder with `loddi ./existing-folder`.

> **Note:** The package has not been published to npm yet. Use the GitHub installer above or the source-checkout method below until the first public release.

The project uses the MIT license. Run `npm run release:check` before any eventual publication; this validates repository links and the license file. Publication is not planned yet.

### Update

For the current GitHub installation, rerun the installer (Linux/macOS) or the Windows `npm install --global "github:FranciscoAscue/loddi-tui#master"` command. After a registry release, use `npm update --global loddi-tui`.

### Uninstall

```bash
npm uninstall --global loddi-tui
```

---

## From a source checkout

This method works on all supported systems and is useful for development:

```bash
git clone https://github.com/FranciscoAscue/loddi-tui.git
cd loddi-tui
npm ci
npm run check        # typecheck + tests + build
npm install --global .
loddi --help
```

To uninstall any global Loddi installation:

```bash
npm uninstall --global loddi-tui
```

---

## Optional publishing tools

Loddi works without Pandoc or Typst for writing. They are only needed for exporting to EPUB or PDF.

Install them from inside the TUI (`/` → `/install pandoc`, `/install typst`) or from the command line:

```bash
loddi tools install pandoc
loddi tools install typst
```

Check installed tools and their versions:

```bash
loddi tools status
```

### Managed tool locations

| Platform | Directory |
|---|---|
| Windows | `%LOCALAPPDATA%\Loddi\tools` |
| macOS | `~/Library/Application Support/Loddi/tools` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/loddi/tools` |

Set `LODDI_HOME` to override all of the above.

To remove managed tools without uninstalling Loddi, delete the tool directory:

```bash
# Linux / macOS
rm -rf ~/.local/share/loddi/tools

# macOS alternate
rm -rf ~/Library/Application\ Support/Loddi/tools
```

### Update managed tools

Re-run the same install command — Loddi downloads and verifies the latest release, then switches the active binary after it starts successfully. Previous version directories remain available until you remove them:

```bash
loddi tools install pandoc
loddi tools install typst
```

---

## Windows

Run the npm or checkout commands above in PowerShell or Windows Terminal. npm creates the `loddi.cmd` launcher automatically. Installing from GitHub requires Git for Windows. If PowerShell cannot find `loddi` after installation, restart the terminal and check that npm's global prefix is on `PATH`.

Recommended: **Windows Terminal** with a font that includes Unicode block characters (Cascadia Code, JetBrains Mono, Fira Code, etc.) for the best TUI experience.

---

## macOS

Run the commands in Terminal, iTerm2, or any modern terminal emulator.

---

## Linux

Supported architectures: **x64** and **ARM64** (for managed Pandoc and Typst).

```bash
loddi tools install pandoc   # downloads linux-amd64 or linux-arm64
loddi tools install typst    # downloads musl-linked binary
```

---

## Why tools are optional

The editor, project manager, and bibliography tools only require Node.js. Pandoc is downloaded only when EPUB or PDF publishing is needed. PDF uses Typst by default because it is substantially smaller than a full TeX distribution and is supported as a Pandoc PDF engine.

Loddi detects system installations first and falls back to its managed tools. It never changes the system `PATH` or requires administrator permissions.
