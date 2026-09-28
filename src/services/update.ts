import {createHash} from 'node:crypto';
import {createReadStream, createWriteStream, readFileSync} from 'node:fs';
import {access, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Readable, Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import * as tar from 'tar';
import {dataDirectory} from './user-paths.js';

const RELEASE_API = 'https://api.github.com/repos/FranciscoAscue/loddi-tui/releases/latest';
const CACHE_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ARCHIVE_BYTES = 300 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 1024 * 1024 * 1024;

export const currentVersion: string = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;

export interface UpdateAsset {
  name: string;
  url: string;
  digest?: string;
  size: number;
}

export interface AvailableUpdate {
  kind: 'available';
  version: string;
  asset?: UpdateAsset;
}

export type UpdateStatus = AvailableUpdate | {kind: 'none'} | {kind: 'current'; version: string} | {kind: 'ahead'; version: string};

export function compareVersions(left: string, right: string): number {
  const parse = (value: string) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value);
    if (!match) throw new Error(`Unsupported release version: ${value}`);
    return match.slice(1).map(Number);
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

export function portableAssetName(version: string, platform = process.platform, arch = process.arch): string | undefined {
  const label = platform === 'darwin' ? 'macos' : platform === 'win32' ? 'windows' : platform === 'linux' ? 'linux' : undefined;
  if (!label || !['x64', 'arm64'].includes(arch) || (label === 'windows' && arch !== 'x64')) return undefined;
  return `loddi-v${version}-${label}-${arch}.tar.gz`;
}

type ReleaseResponse = {
  tag_name?: string;
  assets?: Array<{name?: string; browser_download_url?: string; digest?: string; size?: number}>;
};

export async function checkForUpdate(fetcher: typeof fetch = fetch, timeoutMs = 10000): Promise<UpdateStatus> {
  let response: Response;
  try {
    response = await fetcher(RELEASE_API, {
      headers: {'Accept': 'application/vnd.github+json', 'User-Agent': `loddi/${currentVersion}`},
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error('Could not reach GitHub to check for updates. Check your connection and try again.', {cause: error});
  }
  if (response.status === 404) return {kind: 'none'};
  if (!response.ok) throw new Error(`GitHub release check failed (HTTP ${response.status}).`);
  const release = await response.json() as ReleaseResponse;
  if (!release.tag_name) throw new Error('The latest release has no version tag.');
  const version = release.tag_name.replace(/^v/, '');
  const comparison = compareVersions(version, currentVersion);
  if (comparison < 0) return {kind: 'ahead', version};
  if (comparison === 0) return {kind: 'current', version};
  const expected = portableAssetName(version);
  const match = release.assets?.find(asset => asset.name === expected);
  const asset = match?.browser_download_url && match.name && typeof match.size === 'number'
    && match.digest && /^sha256:[a-f0-9]{64}$/i.test(match.digest) && assetUrlIsTrusted(match.browser_download_url)
    ? {name: match.name, url: match.browser_download_url, size: match.size, ...(match.digest ? {digest: match.digest} : {})}
    : undefined;
  return {kind: 'available', version, ...(asset ? {asset} : {})};
}

export async function startupUpdateNotice(): Promise<string | undefined> {
  if (process.env['LODDI_NO_UPDATE_CHECK'] === '1') return undefined;
  const cache = path.join(dataDirectory(), 'update-check.json');
  try {
    const saved = JSON.parse(await readFile(cache, 'utf8')) as {checkedAt?: number; version?: string};
    if (typeof saved.checkedAt === 'number' && Date.now() - saved.checkedAt < CACHE_AGE_MS) {
      return saved.version && compareVersions(saved.version, currentVersion) > 0
        ? `Update v${saved.version} available · /update`
        : undefined;
    }
  } catch { /* A missing or invalid cache should never interrupt writing. */ }
  try {
    const status = await checkForUpdate(fetch, 3500);
    const version = status.kind === 'available' ? status.version : undefined;
    await mkdir(path.dirname(cache), {recursive: true});
    await writeFile(cache, JSON.stringify({checkedAt: Date.now(), version}), 'utf8');
    return version ? `Update v${version} available · /update` : undefined;
  } catch {
    return undefined;
  }
}

function assetUrlIsTrusted(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com'
      && url.pathname.startsWith('/FranciscoAscue/loddi-tui/releases/download/');
  } catch { return false; }
}

export async function installPortableUpdate(update: AvailableUpdate, onProgress: (message: string) => void = () => {}, fetcher: typeof fetch = fetch): Promise<string> {
  const expectedName = portableAssetName(update.version);
  const asset = update.asset;
  if (!expectedName || !asset || asset.name !== expectedName) throw new Error('No portable archive is available for this platform.');
  if (!assetUrlIsTrusted(asset.url)) throw new Error('The release asset URL is not trusted.');
  if (!asset.digest || !/^sha256:[a-f0-9]{64}$/i.test(asset.digest)) throw new Error('The release asset needs a SHA-256 digest before installation.');
  if (!Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > MAX_ARCHIVE_BYTES) throw new Error('The release archive size is invalid.');

  const versions = path.join(dataDirectory(), 'versions');
  const folder = expectedName.slice(0, -'.tar.gz'.length);
  const destination = path.join(versions, folder);
  const launcher = path.join(destination, process.platform === 'win32' ? 'loddi.cmd' : 'loddi');
  let alreadyExists = false;
  try {
    const existing = await lstat(destination);
    if (!existing.isDirectory() || existing.isSymbolicLink()) throw new Error(`Refusing an unsafe version directory: ${destination}`);
    alreadyExists = true;
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (alreadyExists) {
    const installed = JSON.parse(await readFile(path.join(destination, 'app', 'package.json'), 'utf8')) as {version?: string};
    if (installed.version === update.version) return launcher;
    throw new Error(`Refusing to replace an existing version directory: ${destination}`);
  }

  await mkdir(versions, {recursive: true});
  const temporary = await mkdtemp(path.join(versions, '.update-'));
  try {
    onProgress(`Downloading Loddi v${update.version}…`);
    const archive = path.join(temporary, expectedName);
    const response = await fetcher(asset.url, {
      headers: {'User-Agent': `loddi/${currentVersion}`},
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });
    if (!response.ok || !response.body) throw new Error(`Could not download release archive (HTTP ${response.status}).`);
    let downloaded = 0;
    const limit = new Transform({transform(chunk: Buffer, _encoding, callback) {
      downloaded += chunk.length;
      callback(downloaded > MAX_ARCHIVE_BYTES ? new Error('Release archive exceeds the size limit.') : null, chunk);
    }});
    await pipeline(Readable.fromWeb(response.body as never), limit, createWriteStream(archive, {flags: 'wx'}));
    if (downloaded !== asset.size) throw new Error('The downloaded archive size does not match the release metadata.');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(archive)) hash.update(chunk);
    if (`sha256:${hash.digest('hex')}`.toLowerCase() !== asset.digest.toLowerCase()) throw new Error('The downloaded archive failed SHA-256 verification.');

    onProgress('Extracting verified archive…');
    let extractedBytes = 0;
    const expectedPrefix = `${folder}/`;
    await tar.x({file: archive, cwd: temporary, strict: true, filter(entryPath, entry) {
      const normalized = entryPath.replaceAll('\\', '/');
      if (normalized !== folder && !normalized.startsWith(expectedPrefix)) throw new Error('Archive contains a path outside its version folder.');
      if (normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error('Archive contains an unsafe path.');
      if ('type' in entry && (entry.type === 'SymbolicLink' || entry.type === 'Link')) return false;
      extractedBytes += entry.size || 0;
      if (extractedBytes > MAX_EXTRACTED_BYTES) throw new Error('Extracted release exceeds the size limit.');
      return true;
    }},);
    const staged = path.join(temporary, folder);
    const installed = JSON.parse(await readFile(path.join(staged, 'app', 'package.json'), 'utf8')) as {version?: string};
    if (installed.version !== update.version) throw new Error('The archive contains a different Loddi version.');
    await Promise.all([
      access(path.join(staged, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node')),
      access(path.join(staged, 'app', 'dist', 'cli.js')),
      access(path.join(staged, process.platform === 'win32' ? 'loddi.cmd' : 'loddi')),
    ]);
    await rename(staged, destination);
    onProgress(`Installed at ${launcher}`);
    return launcher;
  } finally {
    await rm(temporary, {recursive: true, force: true});
  }
}
