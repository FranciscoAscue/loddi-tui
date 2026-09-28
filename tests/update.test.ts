import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import * as tar from 'tar';
import {checkForUpdate, compareVersions, currentVersion, installPortableUpdate, portableAssetName} from '../src/services/update.js';

const temporary: string[] = [];
const previousHome = process.env['LODDI_HOME'];
afterEach(async () => {
  for (const directory of temporary.splice(0)) await rm(directory, {recursive: true, force: true});
  if (previousHome === undefined) delete process.env['LODDI_HOME'];
  else process.env['LODDI_HOME'] = previousHome;
});

describe('updates', () => {
  it('compares stable semantic versions numerically', () => {
    expect(compareVersions('v0.10.0', '0.9.9')).toBe(1);
    expect(compareVersions('0.1.0', 'v0.1.0')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(() => compareVersions('nightly', '1.0.0')).toThrow();
  });

  it('treats an absent published release as normal', async () => {
    const fetcher = (async () => new Response(null, {status: 404})) as typeof fetch;
    expect(await checkForUpdate(fetcher)).toEqual({kind: 'none'});
  });

  it('selects only the verified archive for this platform', async () => {
    const name = portableAssetName('0.2.0');
    expect(name).toBeTruthy();
    const fetcher = (async () => new Response(JSON.stringify({
      tag_name: 'v0.2.0',
      assets: [{name, size: 123, digest: `sha256:${'a'.repeat(64)}`, browser_download_url: `https://github.com/FranciscoAscue/loddi-tui/releases/download/v0.2.0/${name}`}],
    }), {status: 200})) as typeof fetch;
    const result = await checkForUpdate(fetcher);
    expect(result.kind).toBe('available');
    if (result.kind === 'available') expect(result.asset?.name).toBe(name);
  });

  it('installs a verified portable release beside the current version', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'loddi-update-test-'));
    temporary.push(directory);
    process.env['LODDI_HOME'] = path.join(directory, 'loddi-home');
    const version = '0.2.0';
    const name = portableAssetName(version);
    if (!name) throw new Error('This test needs a supported platform.');
    const folder = name.slice(0, -'.tar.gz'.length);
    const source = path.join(directory, folder);
    await mkdir(path.join(source, 'app', 'dist'), {recursive: true});
    await mkdir(path.join(source, 'runtime'));
    await writeFile(path.join(source, 'app', 'package.json'), JSON.stringify({version}));
    await writeFile(path.join(source, 'app', 'dist', 'cli.js'), 'console.log("test")');
    await writeFile(path.join(source, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node'), 'test');
    await writeFile(path.join(source, process.platform === 'win32' ? 'loddi.cmd' : 'loddi'), 'test');
    const archive = path.join(directory, name);
    await tar.c({gzip: true, file: archive, cwd: directory}, [folder]);
    const bytes = await readFile(archive);
    const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    const update = {kind: 'available' as const, version, asset: {
      name, size: bytes.length, digest,
      url: `https://github.com/FranciscoAscue/loddi-tui/releases/download/v${version}/${name}`,
    }};
    const fetcher = (async () => new Response(new Uint8Array(bytes), {status: 200})) as typeof fetch;
    await expect(installPortableUpdate({...update, asset: {...update.asset, digest: `sha256:${'0'.repeat(64)}`}}, () => {}, fetcher)).rejects.toThrow('SHA-256');
    const launcher = await installPortableUpdate(update, () => {}, fetcher);
    expect(launcher).toContain(path.join('versions', folder));
    expect(await readFile(path.join(path.dirname(launcher), 'app', 'package.json'), 'utf8')).toContain(version);
    expect(await installPortableUpdate(update, () => {}, fetcher)).toBe(launcher);
    expect(currentVersion).toBe('0.1.0');
  });
});
