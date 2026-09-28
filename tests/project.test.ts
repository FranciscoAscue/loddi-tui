import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {addChapter, addSection, ensureCover, initializeProject, loadProject, loadStandaloneDocument, moveContentItem, readDocument, removeContentItem, renameContentItem, saveDocument} from '../src/services/project.js';
import {checkProject} from '../src/services/check.js';

describe('book project', () => {
  it('opens a Markdown file directly without creating a book manifest', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'loddi-standalone-'));
    const file = path.join(root, 'notes.md');
    await writeFile(file, '# Notes\n', 'utf8');
    const opened = await loadStandaloneDocument(file);
    expect(opened.relativePath).toBe('notes.md');
    expect(await readDocument(opened.project, opened.relativePath)).toBe('# Notes\n');
    await saveDocument(opened.project, opened.relativePath, '# Updated\n');
    expect(await readFile(file, 'utf8')).toBe('# Updated\n');
    await expect(readFile(path.join(root, 'book.yaml'), 'utf8')).rejects.toThrow();
    await expect(readFile(path.join(root, 'SUMMARY.md'), 'utf8')).rejects.toThrow();
  });

  it('adopts existing Markdown files without moving files or replacing user settings', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'loddi-adopt-'));
    await mkdir(path.join(root, 'notes'));
    await mkdir(path.join(root, 'bibliography'));
    await writeFile(path.join(root, 'draft.md'), '# Draft\n', 'utf8');
    await writeFile(path.join(root, 'notes', 'idea.md'), '# Idea\n', 'utf8');
    await writeFile(path.join(root, 'README.md'), '# Project\n', 'utf8');
    await writeFile(path.join(root, '.gitignore'), 'custom/\n', 'utf8');
    await writeFile(path.join(root, 'bibliography', 'references.bib'), '@book{saved, title={Saved}}\n', 'utf8');
    const project = await initializeProject(root, 'Adopted', {adoptExisting: true});
    expect(project.book.content).toEqual(['draft.md', 'notes/idea.md']);
    expect(await readFile(path.join(root, '.gitignore'), 'utf8')).toBe('custom/\n');
    expect(await readFile(path.join(root, 'bibliography', 'references.bib'), 'utf8')).toContain('saved');
    expect(await readFile(path.join(root, 'draft.md'), 'utf8')).toBe('# Draft\n');
  });

  it('inicializa, persiste y genera el índice', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'loddi-test-'));
    const project = await initializeProject(root, 'Libro de prueba');
    const chapter = await addChapter(project, 'Primer capítulo');
    const loaded = await loadProject(root);
    const summary = await readFile(path.join(root, 'SUMMARY.md'), 'utf8');

    expect(chapter).toBe('chapters/01-primer-capitulo.md');
    expect(loaded.book.content).toEqual([chapter]);
    expect(loaded.book.output.pdfEngine).toBe('typst');
    expect(summary).toContain('[Primer capítulo](chapters/01-primer-capitulo.md)');
  });

  it('reports broken images and citation keys with source locations', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'loddi-check-'));
    const project = await initializeProject(root, 'Broken book');
    const chapter = await addChapter(project, 'Problems');
    await saveDocument(project, chapter, '# Problems\n\n![Missing](../assets/images/nope.png)\n\nSee [@unknown].\n\n```ts\nconst open = true;\n');

    const diagnostics = await checkProject(project);
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({level: 'error', file: chapter, line: 3, message: expect.stringContaining('Missing image')}),
      expect.objectContaining({level: 'error', file: chapter, line: 5, message: expect.stringContaining('Unknown citation')}),
      expect.objectContaining({level: 'error', file: chapter, line: 7, message: expect.stringContaining('Unclosed fenced')}),
    ]));
  });

  it('preserves multilingual Unicode manuscripts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'loddi-unicode-'));
    const project = await initializeProject(root, 'Libro multilingüe');
    const chapter = await addChapter(project, 'Idiomas');
    const text = '# Idiomas\n\nEspañol · 日本語 · العربية · Ελληνικά · हिन्दी\n';
    await saveDocument(project, chapter, text);
    expect(await readDocument(project, chapter)).toBe(text);
  });

  it('reorders chapters, renames files, and updates SUMMARY', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'loddi-reorder-'));
    const project = await initializeProject(root, 'Reorder test');
    await addChapter(project, 'First');
    await addChapter(project, 'Second');
    await addChapter(project, 'Third');

    expect(project.book.content).toEqual([
      'chapters/01-first.md',
      'chapters/02-second.md',
      'chapters/03-third.md',
    ]);

    // Move "Second" (index 1) up — it swaps with "First" and both are renumbered
    expect(await moveContentItem(project, 'chapters/02-second.md', 'up')).toBe('chapters/01-second.md');
    expect(project.book.content).toEqual([
      'chapters/01-second.md',
      'chapters/02-first.md',
      'chapters/03-third.md',
    ]);

    // Files on disk: old names gone, new names present
    const {access: fsAccess} = await import('node:fs/promises');
    await expect(fsAccess(path.join(root, 'chapters/01-second.md'))).resolves.toBeUndefined();
    await expect(fsAccess(path.join(root, 'chapters/02-first.md'))).resolves.toBeUndefined();
    await expect(fsAccess(path.join(root, 'chapters/01-first.md'))).rejects.toThrow();

    // Move "First" (now at 02-first.md) down — swaps with "Third"
    await moveContentItem(project, 'chapters/02-first.md', 'down');
    expect(project.book.content).toEqual([
      'chapters/01-second.md',
      'chapters/02-third.md',
      'chapters/03-first.md',
    ]);

    // SUMMARY reflects final order: second < third < first
    const summary = await readFile(path.join(root, 'SUMMARY.md'), 'utf8');
    expect(summary.indexOf('second')).toBeLessThan(summary.indexOf('third'));
    expect(summary.indexOf('third')).toBeLessThan(summary.indexOf('first'));

    // book.yaml persisted correctly
    const loaded = await loadProject(root);
    expect(loaded.book.content).toEqual([
      'chapters/01-second.md',
      'chapters/02-third.md',
      'chapters/03-first.md',
    ]);
  });

  it('reorders adopted Markdown without renaming files, even when they have numeric names', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'loddi-adopt-order-'));
    await mkdir(path.join(root, 'chapters'));
    await writeFile(path.join(root, '01-draft.md'), '# Draft\n', 'utf8');
    await writeFile(path.join(root, '02-notes.md'), '# Notes\n', 'utf8');
    await writeFile(path.join(root, 'chapters', 'loose.md'), '# Loose\n', 'utf8');
    const project = await initializeProject(root, 'Adopted', {adoptExisting: true});
    expect(await moveContentItem(project, '02-notes.md', 'up')).toBe('02-notes.md');
    expect(await moveContentItem(project, 'chapters/loose.md', 'up')).toBe('chapters/loose.md');
    expect(project.book.content).toEqual(['02-notes.md', 'chapters/loose.md', '01-draft.md']);
    expect(await readFile(path.join(root, '01-draft.md'), 'utf8')).toBe('# Draft\n');
    expect(await readFile(path.join(root, '02-notes.md'), 'utf8')).toBe('# Notes\n');
    expect(await readFile(path.join(root, 'chapters', 'loose.md'), 'utf8')).toBe('# Loose\n');
    expect((await loadProject(root)).book.content).toEqual(project.book.content);
  });

  it('only renumbers numbered chapters in a mixed manuscript', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'loddi-mixed-order-'));
    const project = await initializeProject(root, 'Mixed');
    const section = await addSection(project, 'Preface');
    const first = await addChapter(project, 'First');
    const second = await addChapter(project, 'Second');
    expect(await moveContentItem(project, second, 'up')).toBe('chapters/01-second.md');
    expect(project.book.content).toEqual([section, 'chapters/01-second.md', 'chapters/02-first.md']);
    expect(await readDocument(project, section)).toContain('Preface');
    expect(await moveContentItem(project, section, 'down')).toBe(section);
    expect(project.book.content).toEqual(['chapters/01-second.md', section, 'chapters/02-first.md']);
    expect(await readDocument(project, section)).toContain('Preface');
    await expect(readDocument(project, first)).rejects.toThrow();
  });

  it('does not move the first item up or the last item down', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'loddi-boundary-'));
    const project = await initializeProject(root, 'Boundary test');
    await addChapter(project, 'Only chapter');

    expect(project.book.content).toEqual(['chapters/01-only-chapter.md']);

    await moveContentItem(project, 'chapters/01-only-chapter.md', 'up');   // noop
    await moveContentItem(project, 'chapters/01-only-chapter.md', 'down'); // noop

    // Path and file are unchanged
    expect(project.book.content).toEqual(['chapters/01-only-chapter.md']);
    const {access: fsAccess} = await import('node:fs/promises');
    await expect(fsAccess(path.join(root, 'chapters/01-only-chapter.md'))).resolves.toBeUndefined();
  });

  it('renames a chapter and updates manifest, heading, summary, and Markdown links', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'loddi-rename-'));
    const project = await initializeProject(root, 'Rename test');
    const first = await addChapter(project, 'Old title');
    const second = await addChapter(project, 'Links');
    const cover = await ensureCover(project);
    await saveDocument(project, cover, '# Cover\n\n[Start](../chapters/01-old-title.md)\n');
    await saveDocument(project, second, '# Links\n\nRead [old](01-old-title.md#part).\n');
    const renamed = await renameContentItem(project, first, 'New title');
    expect(renamed).toBe('chapters/01-new-title.md');
    expect(project.book.content[0]).toBe(renamed);
    expect(await readDocument(project, renamed)).toMatch(/^# New title/);
    expect(await readDocument(project, second)).toContain('[old](01-new-title.md#part)');
    expect(await readDocument(project, cover)).toContain('[Start](../chapters/01-new-title.md)');
    expect(await readFile(path.join(root, 'SUMMARY.md'), 'utf8')).toContain('[New title](chapters/01-new-title.md)');
    expect((await loadProject(root)).book.content[0]).toBe(renamed);
    await expect(readDocument(project, first)).rejects.toThrow();
  });

  it('refuses a rename that would replace another manuscript file', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'loddi-rename-conflict-'));
    const project = await initializeProject(root, 'Rename conflict');
    const first = await addChapter(project, 'First');
    const second = await addChapter(project, 'Second');
    await writeFile(path.join(root, 'chapters', '01-second.md'), 'Important draft\n', 'utf8');
    await expect(renameContentItem(project, first, 'Second')).rejects.toThrow(/already exists/);
    expect(await readDocument(project, first)).toContain('# First');
    expect(project.book.content).toEqual([first, second]);
  });

  it('removes a chapter from the manifest and SUMMARY without deleting the file', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'loddi-remove-'));
    const project = await initializeProject(root, 'Remove test');
    const ch1 = await addChapter(project, 'Keep this');
    const ch2 = await addChapter(project, 'Remove this');

    await removeContentItem(project, ch2);

    expect(project.book.content).toEqual([ch1]);
    expect(project.book.content).not.toContain(ch2);

    // File on disk should still exist
    const {access} = await import('node:fs/promises');
    await expect(access(path.join(root, ch2))).resolves.toBeUndefined();

    // SUMMARY should not mention ch2
    const summary = await readFile(path.join(root, 'SUMMARY.md'), 'utf8');
    expect(summary).not.toContain(ch2);

    // book.yaml should not contain ch2
    const loaded = await loadProject(root);
    expect(loaded.book.content).toEqual([ch1]);
  });

  it('never overwrites a chapter that was removed from the manifest', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'loddi-orphan-'));
    const project = await initializeProject(root, 'Orphan test');
    const first = await addChapter(project, 'Second');
    const removed = await addChapter(project, 'Second');
    await saveDocument(project, removed, '# Second\n\nKeep this draft.\n');
    await removeContentItem(project, removed);
    const added = await addChapter(project, 'Second');
    expect(added).toBe('chapters/03-second.md');
    expect(await readDocument(project, removed)).toContain('Keep this draft.');
    expect(project.book.content).toEqual([first, added]);
    await expect(moveContentItem(project, added, 'up')).rejects.toThrow(/destination already exists/);
    expect(project.book.content).toEqual([first, added]);
  });

  it('detects Mermaid blocks and emits a warning diagnostic', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'loddi-mermaid-'));
    const project = await initializeProject(root, 'Mermaid test');
    const chapter = await addChapter(project, 'Diagrams');
    await saveDocument(project, chapter, '# Diagrams\n\n```mermaid\ngraph LR\n  A --> B\n```\n');

    const diagnostics = await checkProject(project);
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({level: 'warning', file: chapter, message: expect.stringContaining('Mermaid')}),
    ]));
  });
});
