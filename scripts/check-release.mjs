import {access, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const repository = manifest.repository?.url ?? '';
const homepage = manifest.homepage ?? '';
const bugs = manifest.bugs?.url ?? '';

if (!repository || /your-org|example\.com|<|>/i.test(repository)) {
  throw new Error('Set package.json repository.url to the real Loddi repository before publishing.');
}
if (!homepage || !bugs || /your-org|example\.com|<|>/i.test(`${homepage} ${bugs}`)) {
  throw new Error('Set package.json homepage and bugs.url to real project URLs before publishing.');
}
if (manifest.license === 'MIT') {
  try {
    await access(path.join(root, 'LICENSE'));
  } catch {
    throw new Error('Add a LICENSE file with the correct copyright holder before publishing.');
  }
}
process.stdout.write('Release metadata is ready.\n');
