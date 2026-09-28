import {spawnSync} from 'node:child_process';
import {access, mkdtemp, readFile, rm} from 'node:fs/promises';
import {constants} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check with npm run smoke:package.');

function run(executable, args, cwd) {
  const result = spawnSync(executable, args, {cwd, encoding: 'utf8', windowsHide: true});
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${executable} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

const temporary = await mkdtemp(path.join(os.tmpdir(), 'loddi-package-'));
try {
  if (process.platform !== 'win32') await access(path.join(root, 'dist', 'cli.js'), constants.X_OK);
  const packed = JSON.parse(run(process.execPath, [npmCli, 'pack', '--json', '--ignore-scripts', '--pack-destination', temporary], root));
  const filename = packed[0]?.filename;
  if (!filename || !filename.endsWith('.tgz')) throw new Error('npm pack did not produce a Loddi tarball.');
  const archive = path.join(temporary, filename);
  run(process.execPath, [npmCli, 'install', '--prefix', temporary, '--no-audit', '--no-fund', archive], temporary);

  const installed = path.join(temporary, 'node_modules', 'loddi-tui');
  const manifest = JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8'));
  if (manifest.bin?.loddi !== 'dist/cli.js') throw new Error('The package does not expose the loddi CLI.');
  if (manifest.license !== 'MIT') throw new Error('The package is missing its MIT license metadata.');
  if (!(await readFile(path.join(installed, 'LICENSE'), 'utf8')).startsWith('MIT License')) {
    throw new Error('The package is missing the MIT LICENSE file.');
  }
  const cli = path.join(installed, 'dist', 'cli.js');
  const book = path.join(temporary, 'sample-book');
  run(process.execPath, [cli, '--help'], temporary);
  run(process.execPath, [cli, 'init', book, '--title', 'Package smoke book'], temporary);
  run(process.execPath, [cli, 'check', book], temporary);
  const summary = await readFile(path.join(book, 'SUMMARY.md'), 'utf8');
  if (!summary.includes('Package smoke book')) throw new Error('The installed package did not create a valid project.');
  process.stdout.write(`Packaged CLI works: ${filename}\n`);
} finally {
  await rm(temporary, {recursive: true, force: true});
}
