import {mkdtemp, readFile, rm, stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {initializeProject, ensureCover, addChapter, saveDocument} from '../dist/services/project.js';
import {exportBook} from '../dist/services/export.js';

const temporary = await mkdtemp(path.join(os.tmpdir(), 'loddi-publish-'));
try {
  const project = await initializeProject(path.join(temporary, 'book'), 'Publishing smoke book');
  await ensureCover(project);
  const chapter = await addChapter(project, 'Multilingual chapter');
  await saveDocument(project, chapter, '# Multilingual chapter\n\nEspañol · Ελληνικά · العربية\n');

  for (const format of ['epub', 'pdf']) {
    const output = await exportBook(project, format);
    if ((await stat(output)).size < 100) throw new Error(`${format.toUpperCase()} output is unexpectedly small.`);
    const magic = (await readFile(output)).subarray(0, 4).toString('latin1');
    if (format === 'pdf' && magic !== '%PDF') throw new Error('PDF output has an invalid header.');
    if (format === 'epub' && !magic.startsWith('PK')) throw new Error('EPUB output is not a ZIP archive.');
    process.stdout.write(`${format.toUpperCase()} export works: ${path.basename(output)}\n`);
  }
} finally {
  await rm(temporary, {recursive: true, force: true});
}
