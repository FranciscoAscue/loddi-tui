import {access, readFile} from 'node:fs/promises';
import path from 'node:path';
import {BookProject, readDocument} from './project.js';
import {resolveInProject} from '../domain/paths.js';
import {inspectTool} from './tools.js';

export interface Diagnostic {
  level: 'error' | 'warning';
  message: string;
  file?: string;
  line?: number;
}

function lineNumberAt(contents: string, offset: number): number {
  return contents.slice(0, offset).split('\n').length;
}

function bibliographyKeys(contents: string): Set<string> {
  return new Set([...contents.matchAll(/@[A-Za-z]+\s*\{\s*([^,\s]+)/g)].map(match => match[1] ?? ''));
}

async function documentDiagnostics(project: BookProject): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  let keys = new Set<string>();
  try {
    keys = bibliographyKeys(await readFile(resolveInProject(project.root, project.book.bibliography), 'utf8'));
  } catch {
    // The missing bibliography is reported separately.
  }

  const documents = [project.book.cover.document, ...project.book.content];
  for (const relativePath of documents) {
    let contents: string;
    try {
      contents = await readDocument(project, relativePath);
    } catch {
      continue;
    }

    for (const match of contents.matchAll(/!\[([^\]]*)\]\((?:<([^>]+)>|([^\s)]+))(?:\s+['"][^'"]*['"])?\)/g)) {
      const alt = match[1]?.trim() ?? '';
      const target = match[2] || match[3] || '';
      const line = lineNumberAt(contents, match.index);
      if (!alt) diagnostics.push({level: 'warning', message: 'Image has no alternative text.', file: relativePath, line});
      if (/^(?:https?:|data:|#)/i.test(target)) continue;
      let decoded: string;
      try {
        decoded = decodeURIComponent(target);
      } catch {
        diagnostics.push({level: 'error', message: `Invalid image path: ${target}`, file: relativePath, line});
        continue;
      }
      const absolute = path.resolve(path.dirname(resolveInProject(project.root, relativePath)), decoded);
      const projectRoot = path.resolve(project.root);
      if (absolute !== projectRoot && !absolute.startsWith(`${projectRoot}${path.sep}`)) {
        diagnostics.push({level: 'error', message: `Image path escapes the project: ${target}`, file: relativePath, line});
        continue;
      }
      try {
        await access(absolute);
      } catch {
        diagnostics.push({level: 'error', message: `Missing image: ${target}`, file: relativePath, line});
      }
    }

    for (const match of contents.matchAll(/(?:\[|;\s*)@([\w:./+-]+)/g)) {
      const key = match[1] ?? '';
      if (key && !keys.has(key)) {
        diagnostics.push({
          level: 'error',
          message: `Unknown citation key: ${key}`,
          file: relativePath,
          line: lineNumberAt(contents, match.index),
        });
      }
    }

    const fences = [...contents.matchAll(/^[ \t]*(```+|~~~+)/gm)];
    if (fences.length % 2 !== 0) {
      const last = fences.at(-1);
      diagnostics.push({
        level: 'error',
        message: 'Unclosed fenced code block.',
        file: relativePath,
        line: lineNumberAt(contents, last?.index ?? 0),
      });
    }

    // Mermaid blocks are valid Markdown but cannot be auto-rendered in the PDF/EPUB
    // pipeline without an external pre-processor.  Warn so the author is aware.
    for (const match of contents.matchAll(/^[ \t]*(```+|~~~+)\s*mermaid\s*$/gim)) {
      diagnostics.push({
        level: 'warning',
        message: 'Mermaid diagram detected. It will appear as a fenced code block in PDF/EPUB unless a Mermaid pre-processor is configured.',
        file: relativePath,
        line: lineNumberAt(contents, match.index),
      });
    }
  }
  return diagnostics;
}

export async function checkProject(project: BookProject): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  for (const relativePath of project.book.content) {
    try {
      await access(resolveInProject(project.root, relativePath));
    } catch {
      diagnostics.push({level: 'error', message: `Missing document: ${relativePath}`});
    }
  }
  try {
    await access(resolveInProject(project.root, project.book.bibliography));
  } catch {
    diagnostics.push({level: 'warning', message: `Missing bibliography: ${project.book.bibliography}`});
  }
  if (!(await inspectTool('pandoc')).installed) {
    diagnostics.push({level: 'warning', message: 'Pandoc is not installed; PDF and EPUB exports are unavailable.'});
  }
  if (project.book.output.pdfEngine === 'typst' && !(await inspectTool('typst')).installed) {
    diagnostics.push({level: 'warning', message: 'Typst is not installed; PDF export is unavailable.'});
  }
  diagnostics.push(...await documentDiagnostics(project));
  return diagnostics;
}
