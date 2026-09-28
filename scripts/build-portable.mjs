import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {access, chmod, copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as tar from 'tar';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const platforms = {linux: 'linux', darwin: 'macos', win32: 'windows'};
const platform = platforms[process.platform];
if (!platform || !['x64', 'arm64'].includes(process.arch)) {
  throw new Error(`Unsupported portable target: ${process.platform}/${process.arch}`);
}
if (process.argv.length !== 2 && (process.argv.length !== 4 || process.argv[2] !== '--out')) {
  throw new Error('Usage: node scripts/build-portable.mjs [--out DIRECTORY]');
}

const out = path.resolve(process.argv[3] ?? path.join(root, 'release'));
const name = `loddi-v${manifest.version}-${platform}-${process.arch}`;
const archive = path.join(out, `${name}.tar.gz`);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this through npm run portable:build.');
await access(path.join(root, 'dist', 'cli.js'));

const temporary = await mkdtemp(path.join(os.tmpdir(), 'loddi-portable-'));
try {
  const bundle = path.join(temporary, name);
  const app = path.join(bundle, 'app');
  const runtime = path.join(bundle, 'runtime');
  await mkdir(app, {recursive: true});
  await mkdir(runtime);
  await copyFile(path.join(root, 'package.json'), path.join(app, 'package.json'));
  await copyFile(path.join(root, 'package-lock.json'), path.join(app, 'package-lock.json'));
  await copyFile(path.join(root, 'LICENSE'), path.join(bundle, 'LICENSE'));
  await cp(path.join(root, 'dist'), path.join(app, 'dist'), {recursive: true});

  const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';
  const nodeBinary = path.join(runtime, nodeName);
  const licenseCandidates = [
    path.join(path.dirname(process.execPath), 'LICENSE'),
    path.resolve(path.dirname(process.execPath), '..', 'LICENSE'),
  ];
  let nodeLicense;
  for (const candidate of licenseCandidates) {
    try { await access(candidate); nodeLicense = candidate; break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!nodeLicense) throw new Error('Could not find the Node.js LICENSE beside the runtime.');
  await copyFile(process.execPath, nodeBinary);
  await copyFile(nodeLicense, path.join(runtime, 'NODE-LICENSE'));
  if (process.platform !== 'win32') await chmod(nodeBinary, 0o755);

  const installed = spawnSync(process.execPath, [npmCli, 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: app,
    stdio: 'inherit',
    env: {...process.env, NODE_ENV: 'production'},
    windowsHide: true,
  });
  if (installed.error) throw installed.error;
  if (installed.status !== 0) throw new Error(`Production dependency install failed (${installed.status}).`);

  const launcher = process.platform === 'win32' ? 'loddi.cmd' : 'loddi';
  const launcherContent = process.platform === 'win32'
    ? '@echo off\r\n"%~dp0runtime\\node.exe" "%~dp0app\\dist\\cli.js" %*\r\n'
    : '#!/bin/sh\nbase=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$base/runtime/node" "$base/app/dist/cli.js" "$@"\n';
  await writeFile(path.join(bundle, launcher), launcherContent, 'utf8');
  if (process.platform !== 'win32') await chmod(path.join(bundle, launcher), 0o755);
  await writeFile(path.join(bundle, 'README.txt'),
    `Loddi ${manifest.version} portable (${platform}/${process.arch})\n\nRun ${process.platform === 'win32' ? '.\\loddi.cmd' : './loddi'} --help from this folder.\nThe runtime is bundled; Node.js and npm are not needed on the destination machine.\nPandoc and Typst remain optional for EPUB/PDF export.\nKeep this folder together when moving the app.\n`, 'utf8');

  await mkdir(out, {recursive: true});
  try { await access(archive); throw new Error(`Refusing to overwrite existing archive: ${archive}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { await access(`${archive}.sha256`); throw new Error(`Refusing to overwrite existing checksum: ${archive}.sha256`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await tar.c({gzip: true, file: archive, cwd: temporary, portable: true}, [name]);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(archive)) hash.update(chunk);
  await writeFile(`${archive}.sha256`, `${hash.digest('hex')}  ${path.basename(archive)}\n`, 'utf8');
  process.stdout.write(`Created ${archive}\n`);
} finally {
  await rm(temporary, {recursive: true, force: true});
}
