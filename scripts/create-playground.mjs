import path from 'node:path';
import {access, mkdir, rm, writeFile} from 'node:fs/promises';
import {
  addChapter,
  addSection,
  ensureCover,
  initializeProject,
  saveBook,
  saveDocument,
} from '../dist/services/project.js';

const root = path.resolve(process.cwd(), 'playground');
const reset = process.argv.includes('--reset');

if (path.dirname(root) !== process.cwd() || path.basename(root) !== 'playground') {
  throw new Error(`Refusing to manage an unexpected playground path: ${root}`);
}

let present = false;
try {
  await access(root);
  present = true;
} catch {
  // The playground does not exist yet.
}

if (present && !reset) {
  throw new Error('playground/ already exists. Use npm run playground:reset to replace it.');
}
if (present) await rm(root, {recursive: true, force: true});

const project = await initializeProject(root, 'Loddi Playground');
project.book.author = ['Local Author'];
project.book.language = 'en-US';
project.book.cover.image = 'assets/images/cover.svg';
await saveBook(project);

const cover = await ensureCover(project);
await saveDocument(project, cover, [
  '# Loddi Playground',
  '',
  'A disposable local book for testing the terminal editor and export pipeline.',
  '',
].join('\n'));

const preface = await addSection(project, 'Preface');
await saveDocument(project, preface, [
  '# Preface',
  '',
  'This project is safe to modify. Regenerate it with `npm run playground:reset`.',
  '',
].join('\n'));

const chapter = await addChapter(project, 'Writing with Loddi');
await saveDocument(project, chapter, [
  '# Writing with Loddi',
  '',
  'Loddi keeps the manuscript in portable Markdown files [@doe2026].',
  '',
  '## Image',
  '',
  '![A small Loddi test illustration](../assets/images/sample.svg)',
  '',
  '## Code',
  '',
  '```ts',
  'export const greeting = "Hello from Loddi";',
  '```',
  '',
  '## Diagram',
  '',
  '```mermaid',
  'flowchart LR',
  '  Markdown --> Loddi',
  '  Loddi --> EPUB',
  '  Loddi --> PDF',
  '```',
  '',
].join('\n'));

await mkdir(path.join(root, 'assets', 'images'), {recursive: true});
await writeFile(path.join(root, 'assets', 'images', 'sample.svg'), `
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240">
  <rect width="640" height="240" rx="24" fill="#101827"/>
  <path d="M110 55h150v130H110z" fill="#22d3ee" opacity=".85"/>
  <path d="M135 80h100M135 110h100M135 140h70" stroke="#101827" stroke-width="10"/>
  <text x="300" y="135" font-family="sans-serif" font-size="44" fill="#f8fafc">Loddi Playground</text>
</svg>`.trimStart(), 'utf8');
await writeFile(path.join(root, 'assets', 'images', 'cover.svg'), `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
  <rect width="1200" height="1600" fill="#101827"/>
  <circle cx="600" cy="560" r="260" fill="#22d3ee"/>
  <text x="600" y="1040" text-anchor="middle" font-family="sans-serif" font-size="96" fill="#f8fafc">Loddi</text>
  <text x="600" y="1150" text-anchor="middle" font-family="sans-serif" font-size="48" fill="#94a3b8">Local Playground</text>
</svg>`.trimStart(), 'utf8');
await writeFile(path.join(root, 'bibliography', 'references.bib'), `
@book{doe2026,
  author = {Doe, Jane},
  title = {Portable Publishing Workflows},
  year = {2026},
  publisher = {Example Press}
}
`.trimStart(), 'utf8');

process.stdout.write(`Playground created at ${root}\n`);
process.stdout.write('Open it with: npm run playground:open\n');
