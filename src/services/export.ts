import {access, mkdir, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {slugify, resolveInProject} from '../domain/paths.js';
import {BookProject} from './project.js';
import {resolveTool} from './tools.js';
import {checkProject} from './check.js';

export type ExportFormat = 'epub' | 'pdf';

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function nonEmpty(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).size > 0;
  } catch {
    return false;
  }
}

function run(executable: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {cwd, windowsHide: true});
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Pandoc exited with code ${code ?? 'unknown'}.`));
    });
  });
}

function intersperse(documents: string[], separator: string): string[] {
  return documents.flatMap((document, index) => index === 0 ? [document] : [separator, document]);
}

export async function exportBook(
  project: BookProject,
  format: ExportFormat,
  onProgress: (message: string) => void = () => {},
): Promise<string> {
  onProgress('Running publication preflight…');
  const diagnostics = await checkProject(project);
  const errors = diagnostics.filter(item => item.level === 'error');
  if (errors.length > 0) {
    const details = errors.map(item => `${item.file ? `${item.file}${item.line ? `:${item.line}` : ''}: ` : ''}${item.message}`);
    throw new Error(`Publication preflight failed:\n${details.join('\n')}`);
  }
  const pandoc = await resolveTool('pandoc');
  if (!pandoc) throw new Error('Pandoc is required. Open Dependencies and install it first.');

  const documents: string[] = [];
  const coverDocument = resolveInProject(project.root, project.book.cover.document);
  if (await exists(coverDocument)) documents.push(project.book.cover.document);
  for (const relativePath of project.book.content) {
    if (!(await exists(resolveInProject(project.root, relativePath)))) {
      throw new Error(`Missing document: ${relativePath}`);
    }
    documents.push(relativePath);
  }
  if (documents.length === 0) throw new Error('The book has no documents to export.');

  const outputDirectory = resolveInProject(project.root, project.book.output.directory);
  await mkdir(outputDirectory, {recursive: true});
  const cacheDirectory = resolveInProject(project.root, '.loddi/cache');
  await mkdir(cacheDirectory, {recursive: true});
  const outputPath = path.join(outputDirectory, `${slugify(project.book.title)}.${format}`);
  let inputs = documents;
  if (format === 'epub') {
    const separator = path.join(cacheDirectory, 'page-break-epub.md');
    await writeFile(separator, '```{=html}\n<div style="break-before: page; page-break-before: always"></div>\n```\n', 'utf8');
    inputs = intersperse(documents, separator);
  } else {
    const typst = project.book.output.pdfEngine === 'typst';
    const separator = path.join(cacheDirectory, 'page-break-pdf.md');
    const contents = path.join(cacheDirectory, 'contents-pdf.md');
    await writeFile(separator, typst ? '```{=typst}\n#pagebreak()\n```\n' : '```{=latex}\n\\newpage\n```\n', 'utf8');
    await writeFile(contents, typst ? '```{=typst}\n#outline(title: [Contents], depth: 3)\n```\n' : '```{=latex}\n\\tableofcontents\n```\n', 'utf8');
    const coverIncluded = documents[0] === project.book.cover.document;
    const body = coverIncluded ? documents.slice(1) : documents;
    if (project.book.output.tableOfContents) {
      inputs = coverIncluded
        ? [documents[0]!, separator, contents, ...body.flatMap(document => [separator, document])]
        : [contents, ...body.flatMap(document => [separator, document])];
    } else {
      inputs = intersperse(documents, separator);
    }
  }
  const args = [
    ...inputs,
    '--standalone',
    '--metadata', `title=${project.book.title}`,
    '--metadata', `lang=${project.book.language}`,
    '--output', outputPath,
  ];
  for (const author of project.book.author) args.push('--metadata', `author=${author}`);
  if (project.book.output.tableOfContents && format === 'epub') args.push('--table-of-contents', '--split-level', '1');
  if (project.book.output.numberedSections) args.push('--number-sections');

  const bibliography = resolveInProject(project.root, project.book.bibliography);
  if (await nonEmpty(bibliography)) args.push('--bibliography', bibliography, '--citeproc');
  if (project.book.citationStyle) {
    const citationStyle = resolveInProject(project.root, project.book.citationStyle);
    if (await exists(citationStyle)) args.push('--csl', citationStyle);
  }

  if (format === 'epub' && project.book.cover.image) {
    const coverImage = resolveInProject(project.root, project.book.cover.image);
    if (await exists(coverImage)) args.push('--epub-cover-image', coverImage);
  }

  if (format === 'pdf') {
    const configuredEngine = project.book.output.pdfEngine || 'typst';
    let engine = configuredEngine;
    if (configuredEngine === 'typst') {
      const typst = await resolveTool('typst');
      if (!typst) throw new Error('Typst is required for PDF export. Open Dependencies for installation instructions.');
      engine = typst;
      args.push('--to', 'typst');
      if (project.book.output.mainFont) args.push('--variable', `mainfont=${project.book.output.mainFont}`);
    }
    args.push('--pdf-engine', engine);
  }

  onProgress(`Exporting ${format.toUpperCase()}…`);
  await run(pandoc, args, project.root);
  onProgress(`Created ${outputPath}`);
  return outputPath;
}
