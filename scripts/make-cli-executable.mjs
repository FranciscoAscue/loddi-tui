import {chmod} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

if (process.platform !== 'win32') {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const cli = path.join(root, 'dist', 'cli.js');
  await chmod(cli, 0o755);
}
