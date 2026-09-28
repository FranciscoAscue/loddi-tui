import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {access, mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as tar from 'tar';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv.length !== 2 && (process.argv.length !== 4 || process.argv[2] !== '--dir')) {
  throw new Error('Usage: node scripts/smoke-portable.mjs [--dir DIRECTORY]');
}
const directory = path.resolve(process.argv[3] ?? path.join(root, 'release'));
const archives = (await readdir(directory)).filter(name => name.endsWith('.tar.gz'));
if (archives.length !== 1) throw new Error(`Expected one portable archive in ${directory}, found ${archives.length}.`);
const archive = path.join(directory, archives[0]);
const recorded = (await readFile(`${archive}.sha256`, 'utf8')).trim().split(/\s+/)[0];
const hash = createHash('sha256');
for await (const chunk of createReadStream(archive)) hash.update(chunk);
if (hash.digest('hex') !== recorded) throw new Error('Portable archive SHA-256 mismatch.');

const temporary = await mkdtemp(path.join(directory, '.smoke-'));
try {
  await tar.x({file: archive, cwd: temporary});
  const folder = archives[0].slice(0, -'.tar.gz'.length);
  const bundle = path.join(temporary, folder);
  const launcher = path.join(bundle, process.platform === 'win32' ? 'loddi.cmd' : 'loddi');
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (process.platform !== 'win32') {
    await access(launcher, constants.X_OK);
    await access(path.join(bundle, 'runtime', 'node'), constants.X_OK);
  }
  function run(args) {
    const executable = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : launcher;
    const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', `"${launcher}"`, ...args] : args;
    const result = spawnSync(executable, commandArgs, {cwd: temporary, encoding: 'utf8', windowsHide: true});
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
    return result.stdout;
  }

  if (run(['--version']).trim() !== manifest.version) throw new Error('Portable CLI version mismatch.');
  run(['--help']);
  const book = path.join(temporary, 'sample-book');
  run(['init', book, '--title', 'Portable smoke book']);
  run(['check', book]);
  process.stdout.write(`Portable archive works: ${archives[0]}\n`);
} finally {
  await rm(temporary, {recursive: true, force: true});
}
