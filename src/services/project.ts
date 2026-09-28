import {access, mkdir, readFile, readdir, rename, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import {Book, bookSchema, createDefaultBook} from '../domain/book.js';
import {resolveInProject, slugify} from '../domain/paths.js';

const MANIFEST = 'book.yaml';

export interface BookProject {
  root: string;
  book: Book;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function atomicWrite(filePath: string, contents: string): Promise<void> {
  const temporary = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporary, contents, 'utf8');
  await rename(temporary, filePath);
}

async function discoverMarkdown(root: string, directory = root): Promise<string[]> {
  const documents: string[] = [];
  const excluded = new Set(['.git', '.loddi', 'node_modules', 'dist', 'build', 'assets', 'bibliography']);
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if (entry.name.startsWith('.') || excluded.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) documents.push(...await discoverMarkdown(root, absolute));
    else if (entry.isFile() && /\.md$/i.test(entry.name) && !['README.MD', 'SUMMARY.MD'].includes(entry.name.toUpperCase())) {
      documents.push(path.relative(root, absolute).split(path.sep).join('/'));
    }
  }
  return documents.sort((a, b) => a.localeCompare(b, 'en'));
}

export async function initializeProject(root: string, title?: string, options: {adoptExisting?: boolean} = {}): Promise<BookProject> {
  const absoluteRoot = path.resolve(root);
  await mkdir(absoluteRoot, {recursive: true});
  const manifestPath = path.join(absoluteRoot, MANIFEST);
  if (await exists(manifestPath)) {
    throw new Error(`A Loddi project already exists at ${absoluteRoot}`);
  }
  if (await exists(path.join(absoluteRoot, 'SUMMARY.md'))) {
    throw new Error('SUMMARY.md already exists. Move or rename it before initializing so Loddi does not overwrite it.');
  }

  const book = createDefaultBook(title?.trim() || path.basename(absoluteRoot));
  if (options.adoptExisting) book.content = await discoverMarkdown(absoluteRoot);
  await Promise.all([
    mkdir(path.join(absoluteRoot, 'cover'), {recursive: true}),
    mkdir(path.join(absoluteRoot, 'frontmatter'), {recursive: true}),
    mkdir(path.join(absoluteRoot, 'chapters'), {recursive: true}),
    mkdir(path.join(absoluteRoot, 'backmatter'), {recursive: true}),
    mkdir(path.join(absoluteRoot, 'assets', 'images'), {recursive: true}),
    mkdir(path.join(absoluteRoot, 'assets', 'diagrams'), {recursive: true}),
    mkdir(path.join(absoluteRoot, 'bibliography'), {recursive: true}),
    mkdir(path.join(absoluteRoot, 'build'), {recursive: true}),
    mkdir(path.join(absoluteRoot, '.loddi', 'cache'), {recursive: true}),
  ]);
  await atomicWrite(manifestPath, YAML.stringify(book));
  const bibliography = path.join(absoluteRoot, 'bibliography', 'references.bib');
  if (!(await exists(bibliography))) await atomicWrite(bibliography, '');
  const ignore = path.join(absoluteRoot, '.gitignore');
  if (!(await exists(ignore))) await atomicWrite(ignore, 'build/\n.loddi/cache/\n');
  await regenerateSummary({root: absoluteRoot, book});
  return {root: absoluteRoot, book};
}

export async function loadProject(root: string): Promise<BookProject> {
  const absoluteRoot = path.resolve(root);
  const manifestPath = path.join(absoluteRoot, MANIFEST);
  let raw: string;
  try {
    raw = await readFile(manifestPath, 'utf8');
  } catch {
    throw new Error(`${MANIFEST} was not found in ${absoluteRoot}. Run: loddi init ${root}`);
  }
  const parsed: unknown = YAML.parse(raw);
  return {root: absoluteRoot, book: bookSchema.parse(parsed)};
}

export async function loadStandaloneDocument(filePath: string): Promise<{project: BookProject; relativePath: string}> {
  const absolute = path.resolve(filePath);
  if (!/\.md$/i.test(absolute) || !(await stat(absolute).catch(() => undefined))?.isFile()) {
    throw new Error(`Markdown file not found: ${absolute}`);
  }
  const relativePath = path.basename(absolute);
  const book = createDefaultBook(path.basename(absolute, path.extname(absolute)));
  book.content = [relativePath];
  return {project: {root: path.dirname(absolute), book}, relativePath};
}

export async function saveBook(project: BookProject): Promise<void> {
  const book = bookSchema.parse(project.book);
  await atomicWrite(path.join(project.root, MANIFEST), YAML.stringify(book));
}

export async function readDocument(project: BookProject, relativePath: string): Promise<string> {
  return readFile(resolveInProject(project.root, relativePath), 'utf8');
}

export async function saveDocument(
  project: BookProject,
  relativePath: string,
  contents: string,
): Promise<void> {
  const target = resolveInProject(project.root, relativePath);
  await mkdir(path.dirname(target), {recursive: true});
  await atomicWrite(target, contents);
}

export async function ensureCover(project: BookProject): Promise<string> {
  const relativePath = project.book.cover.document;
  const target = resolveInProject(project.root, relativePath);
  if (!(await exists(target))) {
    await saveDocument(project, relativePath, `# ${project.book.title}\n\n`);
  }
  return relativePath;
}

async function nextDocumentPath(project: BookProject, folder: 'chapters' | 'frontmatter', title: string): Promise<string> {
  const directory = path.join(project.root, folder);
  const names = await readdir(directory);
  const maxNumber = names.reduce((max, name) => Math.max(max, Number(name.match(/^(\d+)-/)?.[1] ?? 0)), 0);
  const relativePath = `${folder}/${String(maxNumber + 1).padStart(2, '0')}-${slugify(title)}.md`;
  if (await exists(resolveInProject(project.root, relativePath))) throw new Error(`Document already exists: ${relativePath}`);
  return relativePath;
}

export async function addChapter(project: BookProject, title: string): Promise<string> {
  const relativePath = await nextDocumentPath(project, 'chapters', title);
  await saveDocument(project, relativePath, `# ${title.trim()}\n\n`);
  project.book.content.push(relativePath);
  await saveBook(project);
  await regenerateSummary(project);
  return relativePath;
}

export async function addSection(project: BookProject, title: string): Promise<string> {
  const relativePath = await nextDocumentPath(project, 'frontmatter', title);
  await saveDocument(project, relativePath, `# ${title.trim()}\n\n`);
  project.book.content.unshift(relativePath);
  await saveBook(project);
  await regenerateSummary(project);
  return relativePath;
}

export async function regenerateSummary(project: BookProject): Promise<void> {
  const items: string[] = [];
  for (const relativePath of project.book.content) {
    let title = path.basename(relativePath, path.extname(relativePath));
    try {
      const contents = await readDocument(project, relativePath);
      const heading = contents.match(/^#\s+(.+)$/m);
      if (heading?.[1]) title = heading[1].trim();
    } catch {
      // Keep the filename in the generated summary so broken entries remain visible.
    }
    items.push(`- [${title}](${relativePath})`);
  }
  const output = [
    '<!-- Generated by Loddi. Do not edit manually. -->',
    '',
    `# ${project.book.title}`,
    '',
    ...items,
    '',
  ].join('\n');
  await atomicWrite(path.join(project.root, 'SUMMARY.md'), output);
}

/**
 * Renumber chapters and front-matter sections so their NN- filename prefix
 * always matches their position in the content array.  Files are renamed on
 * disk using a two-pass (temp → final) approach to avoid conflicts when two
 * adjacent items swap numbers.  The manifest and SUMMARY are updated as well.
 */
export async function renumberContent(project: BookProject): Promise<void> {
  async function renumberGroup(items: string[], groupPrefix: string): Promise<Map<string, string>> {
    const renames = new Map<string, string>(); // oldRelPath → newRelPath
    const tempPairs: Array<{from: string; to: string; tempAbs: string}> = [];

    for (let i = 0; i < items.length; i++) {
      const oldRel = items[i]!;
      const ext = path.extname(oldRel);
      const base = path.basename(oldRel, ext);
      // Strip any existing numeric prefix (e.g. "01-", "02-") before re-adding
      const slug = base.replace(/^\d+-/, '');
      const newNum = String(i + 1).padStart(2, '0');
      const newRel = `${groupPrefix}/${newNum}-${slug}${ext}`;

      if (oldRel !== newRel) {
        const oldAbs = resolveInProject(project.root, oldRel);
        const newAbs = resolveInProject(project.root, newRel);
        const tempAbs = `${oldAbs}.loddi-moving`;
        renames.set(oldRel, newRel);
        tempPairs.push({from: oldAbs, to: newAbs, tempAbs});
      }
    }

    // Never replace a file that was removed from the manifest but kept on disk.
    const sourcePaths = new Set(items.map(item => resolveInProject(project.root, item)));
    for (const {from, to, tempAbs} of tempPairs) {
      if (!(await exists(from))) throw new Error(`Cannot reorder missing document: ${from}`);
      if (!sourcePaths.has(to) && await exists(to)) throw new Error(`Cannot reorder: destination already exists: ${to}`);
      if (await exists(tempAbs)) throw new Error(`Cannot reorder: temporary path already exists: ${tempAbs}`);
    }
    // Pass 1: rename originals to temporary names (avoids same-number collisions)
    for (const {from, tempAbs} of tempPairs) {
      await rename(from, tempAbs);
    }
    // Pass 2: rename temporaries to final names
    for (const {to, tempAbs} of tempPairs) {
      await rename(tempAbs, to);
    }

    return renames;
  }

  const frontmatter = project.book.content.filter(p => p.startsWith('frontmatter/'));
  const chapters    = project.book.content.filter(p => p.startsWith('chapters/'));

  // Process the two groups independently (different directories → no conflicts)
  const [fmRenames, chRenames] = await Promise.all([
    renumberGroup(frontmatter, 'frontmatter'),
    renumberGroup(chapters,    'chapters'),
  ]);

  // Update the in-memory content array with new paths
  project.book.content = project.book.content.map(p =>
    fmRenames.get(p) ?? chRenames.get(p) ?? p,
  );

  await saveBook(project);
  await regenerateSummary(project);
}

/**
 * Move a content item up or down within project.book.content, then renumber
 * all files in the same group so the NN- prefix always matches the new order.
 */
export async function moveContentItem(
  project: BookProject,
  relativePath: string,
  direction: 'up' | 'down',
): Promise<void> {
  const index = project.book.content.indexOf(relativePath);
  if (index < 0) throw new Error(`Document not found in manifest: ${relativePath}`);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= project.book.content.length) return; // already at boundary
  const previous = [...project.book.content];
  // Swap positions in the array
  const tmp = project.book.content[index]!;
  project.book.content[index] = project.book.content[target]!;
  project.book.content[target] = tmp;
  // Rename files on disk so NN- prefix matches new order, then persist
  try {
    await renumberContent(project);
  } catch (error) {
    project.book.content = previous;
    throw error;
  }
}

/**
 * Remove a document from the book manifest and SUMMARY.md.
 * The physical file is NOT deleted so the user can recover it manually.
 */
export async function removeContentItem(project: BookProject, relativePath: string): Promise<void> {
  const index = project.book.content.indexOf(relativePath);
  if (index < 0) throw new Error(`Document not found in manifest: ${relativePath}`);
  project.book.content.splice(index, 1);
  await saveBook(project);
  await regenerateSummary(project);
}

function rewriteDocumentLinks(contents: string, source: string, oldPath: string, newPath: string): string {
  return contents.replace(/(\]\()(<?[^\s)>]+>?)([^)]*\))/g, (match, open: string, target: string, close: string) => {
    const wrapped = target.startsWith('<') && target.endsWith('>');
    const raw = wrapped ? target.slice(1, -1) : target;
    const suffixIndex = raw.search(/[?#]/);
    const resource = suffixIndex < 0 ? raw : raw.slice(0, suffixIndex);
    const suffix = suffixIndex < 0 ? '' : raw.slice(suffixIndex);
    if (!resource || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(resource)) return match;
    let decoded: string;
    try { decoded = decodeURIComponent(resource); } catch { return match; }
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(source), decoded));
    if (resolved !== oldPath) return match;
    const replacement = path.posix.relative(path.posix.dirname(source), newPath);
    return `${open}${wrapped ? `<${replacement}${suffix}>` : `${replacement}${suffix}`}${close}`;
  });
}

/** Rename a manuscript document in place and keep its title and common Markdown links in sync. */
export async function renameContentItem(project: BookProject, relativePath: string, title: string): Promise<string> {
  const index = project.book.content.indexOf(relativePath);
  if (index < 0) throw new Error(`Document not found in manifest: ${relativePath}`);
  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error('Document title cannot be empty.');
  const extension = path.extname(relativePath);
  const oldBase = path.basename(relativePath, extension);
  const numericPrefix = oldBase.match(/^(\d+-)/)?.[1] ?? '';
  const newPath = path.posix.join(path.posix.dirname(relativePath), `${numericPrefix}${slugify(cleanTitle)}${extension}`);
  const oldAbsolute = resolveInProject(project.root, relativePath);
  const newAbsolute = resolveInProject(project.root, newPath);
  if (relativePath !== newPath && await exists(newAbsolute)) throw new Error(`Document already exists: ${newPath}`);

  const updates = new Map<string, string>();
  const sources = new Set(project.book.content);
  if (await exists(resolveInProject(project.root, project.book.cover.document))) sources.add(project.book.cover.document);
  for (const source of sources) {
    const original = await readDocument(project, source);
    let changed = rewriteDocumentLinks(original, source, relativePath, newPath);
    if (source === relativePath) {
      changed = /^#\s+.*$/m.test(changed)
        ? changed.replace(/^#\s+.*$/m, `# ${cleanTitle}`)
        : `# ${cleanTitle}\n\n${changed}`;
    }
    if (changed !== original) updates.set(source, changed);
  }

  if (relativePath !== newPath) await rename(oldAbsolute, newAbsolute);
  project.book.content[index] = newPath;
  for (const [source, contents] of updates) {
    await saveDocument(project, source === relativePath ? newPath : source, contents);
  }
  await saveBook(project);
  await regenerateSummary(project);
  return newPath;
}
