# Portable downloads

Loddi can be bundled as one platform-specific `.tar.gz` that includes Node.js, the compiled application, and production dependencies. The user only needs to download and extract the archive; Node.js, npm, Git and an installer are **not** required on the destination machine. Pandoc (EPUB) and Typst (PDF) are still optional downloads when exporting.

This is a portable folder, **not a single binary**. Keep `loddi` or `loddi.cmd`, `runtime/`, and `app/` together. The archive includes the Loddi and Node.js license texts and a separate SHA-256 checksum file.

## Supported archives

| Target | Archive suffix | Run after extracting |
|---|---|---|
| Linux x64 | `linux-x64.tar.gz` | `./loddi --help` |
| Linux ARM64 | `linux-arm64.tar.gz` | `./loddi --help` |
| macOS Intel | `macos-x64.tar.gz` | `./loddi --help` |
| macOS Apple Silicon | `macos-arm64.tar.gz` | `./loddi --help` |
| Windows x64 | `windows-x64.tar.gz` | `.\loddi.cmd --help` in PowerShell |

When release assets are published, download the archive matching your system from the [GitHub Releases page](https://github.com/FranciscoAscue/loddi-tui/releases). **No portable release asset has been published yet.** Until then, use the [source installer](INSTALL.md) or build an archive locally. GitHub's archive of the repository source is not the portable application.

On Linux or macOS:

```bash
tar -xzf loddi-v0.1.0-linux-x64.tar.gz   # use your platform's filename
cd loddi-v0.1.0-linux-x64
./loddi --version
./loddi init ./my-book --title "My book"
```

On Windows PowerShell, Windows includes `tar` for `.tar.gz` extraction:

```powershell
tar -xf .\loddi-v0.1.0-windows-x64.tar.gz
cd .\loddi-v0.1.0-windows-x64
.\loddi.cmd --version
```

Before extracting, compare the downloaded archive with its adjacent `.sha256` file (`sha256sum -c FILE.sha256` on Linux, `shasum -a 256 FILE` on macOS, or `Get-FileHash FILE -Algorithm SHA256` on Windows). Run the command from the directory containing both files when using `sha256sum -c`.

## Building and testing an archive

On the target operating system and architecture, with Node.js 22.20+ and npm installed:

```bash
npm ci
npm run portable:build
npm run portable:smoke
```

The archive and checksum appear in `release/`. `portable:build` refuses to overwrite an existing archive; move or rename it before rebuilding. The smoke test extracts the archive and uses its bundled launcher to check `--version`, `--help`, project creation and project validation. The workflow `.github/workflows/portable.yml` can be started manually to build all five targets and retain them as workflow artifacts. Those artifacts are for validation; attaching approved archives and checksums to a GitHub Release is a separate, explicit publication step.

The Linux archive is built on a glibc-based runner and is not claimed to support musl-only systems. macOS users may need to approve an unsigned downloaded application in system security settings; code signing and notarization are not implemented. Native compression support and the launcher must pass the smoke test on each target before calling it a release.

## Updating later

After an official portable release is published, run `loddi update --check` to look for a new version, or `loddi update` to check and ask before downloading. For non-interactive scripts, use `loddi update --yes` to explicitly authorize installation. In the TUI, `/update` opens the same check. At startup, Loddi checks in the background (using a 24-hour cache) and, if a newer release is found, opens a confirmation panel before installing. Declining returns to the manuscript; nothing is downloaded automatically. Set `LODDI_NO_UPDATE_CHECK=1` to disable only the startup check and prompt.

An update is installed **beside** the current version under the Loddi user-data directory (`LODDI_HOME/versions` if `LODDI_HOME` is set). The command prints the exact launcher path for the new version. Restart by using that path; the old installation and all manuscript folders remain unchanged. Loddi requires the release asset's SHA-256 digest and refuses an archive for the wrong operating system or architecture. No release exists yet, so today `loddi update` reports that there is nothing to download.

## Why not one executable yet?

[Bun can compile standalone executables and embed N-API addons](https://bun.com/docs/bundler/executables), while [Node has single-executable tooling](https://nodejs.org/api/single-executable-applications.html). Loddi currently loads a native `@napi-rs/lzma` addon and uses Ink. A one-file build needs separate runtime, TUI and native-addon tests on every target before it can replace the portable folder. The bundled Node archive keeps the existing runtime behavior and is the conservative v0.1 distribution path.
