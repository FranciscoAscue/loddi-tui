import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {BookProject} from './project.js';
import {resolveInProject} from '../domain/paths.js';
import {checkProject} from './check.js';

export interface DocumentReview {
  path: string;
  label: string;
  kind: 'cover' | 'contents' | 'frontmatter' | 'chapter';
  words: number;
  headings: number;
  bytes: number;
  issues: number;
  generated: boolean;
}

export async function reviewManuscript(project: BookProject): Promise<DocumentReview[]> {
  const diagnostics = await checkProject(project);
  const entries: Array<Pick<DocumentReview, 'path' | 'label' | 'kind' | 'generated'>> = [
    {path: project.book.cover.document, label: 'Cover', kind: 'cover', generated: false},
    {path: 'SUMMARY.md', label: 'Table of contents', kind: 'contents', generated: true},
    ...project.book.content.map(relativePath => ({
      path: relativePath,
      label: path.basename(relativePath, path.extname(relativePath)),
      kind: relativePath.startsWith('frontmatter/') ? 'frontmatter' as const : 'chapter' as const,
      generated: false,
    })),
  ];

  const reviews: DocumentReview[] = [];
  for (const entry of entries) {
    try {
      const absolute = resolveInProject(project.root, entry.path);
      const [contents, metadata] = await Promise.all([readFile(absolute, 'utf8'), stat(absolute)]);
      const heading = contents.match(/^#\s+(.+)$/m)?.[1]?.trim();
      reviews.push({
        ...entry,
        label: heading || entry.label,
        words: contents.trim() ? contents.trim().split(/\s+/u).length : 0,
        headings: [...contents.matchAll(/^#{1,6}\s+/gm)].length,
        bytes: metadata.size,
        issues: diagnostics.filter(item => item.file === entry.path).length,
      });
    } catch {
      reviews.push({...entry, words: 0, headings: 0, bytes: 0, issues: 1});
    }
  }
  return reviews;
}
