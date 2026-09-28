import {createHash} from 'node:crypto';
import {createReadStream, createWriteStream} from 'node:fs';
import {
  access,
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import * as tar from 'tar';
import unzipper from 'unzipper';
import {createDecompressStream} from '@napi-rs/lzma/xz';
import {dataDirectory} from './user-paths.js';

const PANDOC_GITHUB_API = 'https://api.github.com/repos/jgm/pandoc/releases/latest';
const TYPST_GITHUB_API = 'https://api.github.com/repos/typst/typst/releases/latest';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  digest?: string;
  size: number;
}

interface GithubRelease {
  tag_name: string;
  assets: ReleaseAsset[];
}

interface ManagedToolManifest {
  version: string;
  executable: string;
  installedAt: string;
}

export interface ToolStatus {
  name: 'pandoc' | 'typst';
  label: string;
  installed: boolean;
  version?: string;
  executable?: string;
  managed: boolean;
  requiredFor: string;
  canInstall: boolean;
  installHint: string;
}

function toolDirectory(name: string): string {
  return path.join(dataDirectory(), 'tools', name);
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function versionOf(executable: string): Promise<string | undefined> {
  return new Promise(resolve => {
    const child = spawn(executable, ['--version'], {windowsHide: true});
    let output = '';
    child.stdout.on('data', chunk => { output += String(chunk); });
    child.once('error', () => resolve(undefined));
    child.once('exit', code => {
      if (code !== 0) return resolve(undefined);
      const firstLine = output.split(/\r?\n/, 1)[0]?.trim();
      resolve(firstLine || undefined);
    });
  });
}

async function managedExecutable(name: string): Promise<{path: string; version: string} | undefined> {
  try {
    const raw = await readFile(path.join(toolDirectory(name), 'current.json'), 'utf8');
    const manifest = JSON.parse(raw) as ManagedToolManifest;
    if (!(await isFile(manifest.executable))) return undefined;
    return {path: manifest.executable, version: manifest.version};
  } catch {
    return undefined;
  }
}

export async function resolveTool(name: 'pandoc' | 'typst'): Promise<string | undefined> {
  const systemVersion = await versionOf(name);
  if (systemVersion) return name;
  const managed = await managedExecutable(name);
  return managed?.path;
}

function installHint(name: 'pandoc' | 'typst'): string {
  return `Press I to install a private, official ${name === 'pandoc' ? 'Pandoc' : 'Typst'} binary managed by Loddi.`;
}

export async function inspectTool(name: 'pandoc' | 'typst'): Promise<ToolStatus> {
  const systemVersion = await versionOf(name);
  const managed = systemVersion ? undefined : await managedExecutable(name);
  const executable = systemVersion ? name : managed?.path;
  const detectedVersion = systemVersion || (managed ? await versionOf(managed.path) : undefined);
  return {
    name,
    label: name === 'pandoc' ? 'Pandoc' : 'Typst',
    installed: Boolean(detectedVersion),
    ...(detectedVersion ? {version: detectedVersion} : {}),
    ...(executable ? {executable} : {}),
    managed: Boolean(managed),
    requiredFor: name === 'pandoc' ? 'EPUB and PDF exports' : 'lightweight PDF exports',
    canInstall: true,
    installHint: installHint(name),
  };
}

export async function inspectTools(): Promise<ToolStatus[]> {
  return Promise.all([inspectTool('pandoc'), inspectTool('typst')]);
}

export function pandocAssetPattern(platform: NodeJS.Platform, arch: string): RegExp {
  if (platform === 'win32' && arch === 'x64') return /windows-x86_64\.zip$/;
  if (platform === 'darwin' && arch === 'x64') return /x86_64-macOS\.zip$/;
  if (platform === 'darwin' && arch === 'arm64') return /arm64-macOS\.zip$/;
  if (platform === 'linux' && arch === 'x64') return /linux-amd64\.tar\.gz$/;
  if (platform === 'linux' && arch === 'arm64') return /linux-arm64\.tar\.gz$/;
  throw new Error(`Managed Pandoc installation is not available for ${platform}/${arch}.`);
}

export function typstAssetPattern(platform: NodeJS.Platform, arch: string): RegExp {
  if (platform === 'win32' && arch === 'x64') return /x86_64-pc-windows-msvc\.zip$/;
  if (platform === 'win32' && arch === 'arm64') return /aarch64-pc-windows-msvc\.zip$/;
  if (platform === 'darwin' && arch === 'x64') return /x86_64-apple-darwin\.tar\.xz$/;
  if (platform === 'darwin' && arch === 'arm64') return /aarch64-apple-darwin\.tar\.xz$/;
  if (platform === 'linux' && arch === 'x64') return /x86_64-unknown-linux-musl\.tar\.xz$/;
  if (platform === 'linux' && arch === 'arm64') return /aarch64-unknown-linux-musl\.tar\.xz$/;
  throw new Error(`Managed Typst installation is not available for ${platform}/${arch}.`);
}

async function sha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
}

async function findExecutable(root: string, filename: string): Promise<string | undefined> {
  for (const entry of await readdir(root, {withFileTypes: true})) {
    const candidate = path.join(root, entry.name);
    if (entry.isFile() && entry.name === filename) return candidate;
    if (entry.isDirectory()) {
      const nested = await findExecutable(candidate, filename);
      if (nested) return nested;
    }
  }
  return undefined;
}

interface InstallConfiguration {
  name: 'pandoc' | 'typst';
  label: string;
  api: string;
  pattern: RegExp;
}

async function installGithubTool(
  configuration: InstallConfiguration,
  onProgress: (message: string) => void,
): Promise<ToolStatus> {
  const {name, label, api, pattern} = configuration;
  onProgress(`Reading the latest official ${label} release…`);
  const releaseResponse = await fetch(api, {
    headers: {'Accept': 'application/vnd.github+json', 'User-Agent': 'loddi-tui'},
  });
  if (!releaseResponse.ok) throw new Error(`GitHub returned ${releaseResponse.status} while checking ${label}.`);
  const release = await releaseResponse.json() as GithubRelease;
  const asset = release.assets.find(item => pattern.test(item.name));
  if (!asset) throw new Error(`No official ${label} archive was found for ${process.platform}/${process.arch}.`);
  const digest = asset.digest;
  if (!digest || !/^sha256:[a-f0-9]{64}$/i.test(digest)) {
    throw new Error(`The official ${label} archive has no SHA-256 digest. Installation was cancelled.`);
  }

  const base = toolDirectory(name);
  await mkdir(base, {recursive: true});
  const temporary = await mkdtemp(path.join(base, '.install-'));
  const archive = path.join(temporary, asset.name);
  const extracted = path.join(temporary, 'extracted');
  await mkdir(extracted, {recursive: true});
  let installedDirectory: string | undefined;

  try {
    onProgress(`Downloading ${asset.name} (${Math.ceil(asset.size / 1024 / 1024)} MB)…`);
    const download = await fetch(asset.browser_download_url, {headers: {'User-Agent': 'loddi-tui'}});
    if (!download.ok || !download.body) throw new Error(`${label} download failed with HTTP ${download.status}.`);
    await pipeline(download.body, createWriteStream(archive));

    onProgress('Verifying SHA-256 checksum…');
    const actual = await sha256(archive);
    const expected = digest.slice('sha256:'.length).toLowerCase();
    if (actual !== expected) throw new Error(`${label} checksum verification failed. The archive was not installed.`);

    onProgress(`Extracting the ${label} archive…`);
    if (asset.name.endsWith('.zip')) {
      await createReadStream(archive).pipe(unzipper.Extract({path: extracted})).promise();
    } else if (asset.name.endsWith('.tar.gz')) {
      await tar.x({file: archive, cwd: extracted});
    } else if (asset.name.endsWith('.tar.xz')) {
      await pipeline(createReadStream(archive), createDecompressStream(), tar.x({cwd: extracted}));
    } else {
      throw new Error(`Unsupported archive format: ${asset.name}`);
    }

    const executableName = process.platform === 'win32' ? `${name}.exe` : name;
    const found = await findExecutable(extracted, executableName);
    if (!found) throw new Error(`The downloaded archive did not contain the ${label} executable.`);

    const safeTag = release.tag_name.replace(/[^a-zA-Z0-9._-]/g, '-');
    installedDirectory = await mkdtemp(path.join(base, `${safeTag}-`));
    const destination = path.join(installedDirectory, executableName);
    await copyFile(found, destination);
    if (process.platform !== 'win32') await chmod(destination, 0o755);
    if (!(await versionOf(destination))) throw new Error(`The extracted ${label} executable could not start.`);

    const manifest: ManagedToolManifest = {
      version: release.tag_name,
      executable: destination,
      installedAt: new Date().toISOString(),
    };
    const stagedManifest = path.join(temporary, 'current.json');
    await writeFile(stagedManifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await rename(stagedManifest, path.join(base, 'current.json'));
    installedDirectory = undefined;
    onProgress(`${label} ${release.tag_name} is ready.`);
  } finally {
    if (installedDirectory) await rm(installedDirectory, {recursive: true, force: true});
    await rm(temporary, {recursive: true, force: true});
  }
  return inspectTool(name);
}

export async function installPandoc(onProgress: (message: string) => void = () => {}): Promise<ToolStatus> {
  return installGithubTool({
    name: 'pandoc',
    label: 'Pandoc',
    api: PANDOC_GITHUB_API,
    pattern: pandocAssetPattern(process.platform, process.arch),
  }, onProgress);
}

export async function installTypst(onProgress: (message: string) => void = () => {}): Promise<ToolStatus> {
  return installGithubTool({
    name: 'typst',
    label: 'Typst',
    api: TYPST_GITHUB_API,
    pattern: typstAssetPattern(process.platform, process.arch),
  }, onProgress);
}

export function platformLabel(): string {
  const names: Record<string, string> = {win32: 'Windows', darwin: 'macOS', linux: 'Linux'};
  return `${names[process.platform] || process.platform} ${process.arch}`;
}
