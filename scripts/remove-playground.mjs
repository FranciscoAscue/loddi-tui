import path from 'node:path';
import {rm} from 'node:fs/promises';

const root = path.resolve(process.cwd(), 'playground');
if (path.dirname(root) !== process.cwd() || path.basename(root) !== 'playground') {
  throw new Error(`Refusing to remove an unexpected path: ${root}`);
}

await rm(root, {recursive: true, force: true});
process.stdout.write(`Removed ${root}\n`);
