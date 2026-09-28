import {EditorBuffer, insertText} from './editor-buffer.js';
import {highlightCodeLine, normalizeCodeLanguage, type HighlightSpan} from './code-highlighting.js';
export type {HighlightSpan} from './code-highlighting.js';

export type InsertTemplate = 'heading' | 'bold' | 'list' | 'code' | 'mermaid' | 'math' | 'image';

const templates: Record<InsertTemplate, {text: string; cursorBack: number}> = {
  heading: {text: '# Heading', cursorBack: 0},
  bold: {text: '****', cursorBack: 2},
  list: {text: '- Item', cursorBack: 0},
  code: {text: '```text\n\n```', cursorBack: 4},
  mermaid: {text: '```mermaid\ngraph LR\n  A --> B\n```', cursorBack: 4},
  math: {text: '$$\n\n$$', cursorBack: 3},
  image: {text: '![alt](../assets/images/figure.png)', cursorBack: 1},
};

export function insertTemplate(buffer: EditorBuffer, template: InsertTemplate): EditorBuffer {
  const {text, cursorBack} = templates[template];
  const isBlock = template !== 'bold' && template !== 'image';
  const current = buffer.lines[buffer.cursor.row] ?? '';
  const prefix = isBlock && buffer.cursor.column > 0 ? '\n' : '';
  const suffix = isBlock && buffer.cursor.column < current.length ? '\n' : '';
  let result = insertText(buffer, `${prefix}${text}${suffix}`);
  for (let index = 0; index < cursorBack + suffix.length; index += 1) {
    const {row, column} = result.cursor;
    result = column > 0
      ? {...result, cursor: {row, column: column - 1}}
      : row > 0
        ? {...result, cursor: {row: row - 1, column: result.lines[row - 1]?.length ?? 0}}
        : result;
  }
  return result;
}

export type HighlightKind = 'plain' | 'heading' | 'quote' | 'list' | 'code' | 'fence' | 'math' | 'table';

function inlineSpans(line: string): HighlightSpan[] {
  const spans: HighlightSpan[] = [];
  const pattern = /!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\)|\[@[^\]]+\]|(?<![\w@])@[A-Za-z0-9_:./+-]+|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|(?<!\*)\*[^*\n]+\*(?!\*)|(?<!_)_[^_\n]+_(?!_)|\$[^$\n]+\$|https?:\/\/[^\s)]+/g;
  let end = 0;
  for (const match of line.matchAll(pattern)) {
    const start = match.index;
    if (start > end) spans.push({text: line.slice(end, start)});
    const value = match[0];
    const color = value.startsWith('![') ? 'blue'
      : value.startsWith('[@') || value.startsWith('@') ? 'yellow'
        : value.startsWith('[') || value.startsWith('http') ? 'cyan'
          : value.startsWith('`') ? 'green'
            : value.startsWith('$') ? 'magenta' : 'white';
    spans.push({text: value, color, ...(color === 'white' ? {bold: true} : {})});
    end = start + value.length;
  }
  if (end < line.length) spans.push({text: line.slice(end)});
  return spans;
}

export function highlightMarkdownLine(line: string, kind: HighlightKind, language?: string): HighlightSpan[] {
  if (!line) return [];
  if (kind === 'code') return highlightCodeLine(line, language);
  if (kind === 'math') return [{text: line, color: 'magenta'}];
  if (kind === 'fence') {
    const marker = line.match(/^(\s*`{3,}|\s*~{3,})(.*)$/);
    return marker ? [
      {text: marker[1]!, color: 'magenta'},
      ...(marker[2] ? [{text: marker[2], color: 'cyan' as const}] : []),
    ] : [{text: line, color: 'magenta'}];
  }
  if (kind === 'heading') {
    const marker = line.match(/^(\s*#{1,6}\s+)(.*)$/);
    return marker ? [{text: marker[1]!, color: 'cyan', bold: true}, {text: marker[2]!, color: 'white', bold: true}] : [{text: line, color: 'cyan'}];
  }
  if (kind === 'table') {
    return line.split(/(\|)/).filter(Boolean).map(text => text === '|' ? {text, color: 'blue'} : {text});
  }
  const marker = kind === 'quote' ? line.match(/^(\s*>\s?)(.*)$/)
    : kind === 'list' ? line.match(/^(\s*(?:[-*+]\s|\d+[.)]\s))(.*)$/) : null;
  if (marker) return [{text: marker[1]!, color: kind === 'quote' ? 'gray' : 'yellow'}, ...inlineSpans(marker[2]!)];
  return inlineSpans(line);
}

export function fencedLanguagesForLines(lines: string[]): Array<string | undefined> {
  const languages: Array<string | undefined> = [];
  let fence: {character: string; size: number; language: string} | undefined;
  for (const [index, line] of lines.entries()) {
    const marker = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (marker && !fence) {
      fence = {character: marker[1]![0]!, size: marker[1]!.length, language: normalizeCodeLanguage(marker[2])};
    } else if (marker && fence && marker[1]![0] === fence.character
      && marker[1]!.length >= fence.size && marker[2]!.trim() === '') {
      fence = undefined;
    } else if (fence) languages[index] = fence.language;
  }
  return languages;
}

export function classifyMarkdownLines(lines: string[]): HighlightKind[] {
  let fence: {character: string; size: number} | undefined;
  let math = false;
  return lines.map(line => {
    const marker = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (marker && !fence) {
      fence = {character: marker[1]![0]!, size: marker[1]!.length};
      return 'fence';
    }
    if (marker && fence && marker[1]![0] === fence.character
      && marker[1]!.length >= fence.size && marker[2]!.trim() === '') {
      fence = undefined;
      return 'fence';
    }
    if (fence) return 'code';
    if (/^\s*\$\$\s*$/.test(line)) {
      math = !math;
      return 'math';
    }
    if (math) return 'math';
    if (/^\s{0,3}#{1,6}\s/.test(line)) return 'heading';
    if (/^\s*>/.test(line)) return 'quote';
    if (/^\s*(?:[-*+]\s|\d+[.)]\s)/.test(line)) return 'list';
    if (/^\s*\|.*\|\s*$/.test(line)) return 'table';
    return 'plain';
  });
}

export interface MarkdownBlock {
  kind: 'code' | 'math' | 'line' | 'inline';
  label: string;
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
  editRow: number;
  editColumn: number;
}

export function findMarkdownBlock(buffer: EditorBuffer): MarkdownBlock | undefined {
  const {lines, cursor} = buffer;
  for (let row = 0; row <= cursor.row; row += 1) {
    const opening = lines[row]?.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (opening) {
      const delimiter = opening[1]!;
      let end = row + 1;
      while (end < lines.length && !new RegExp(`^\\s*${delimiter[0]}{${delimiter.length},}\\s*$`).test(lines[end]!)) end += 1;
      end = Math.min(end, lines.length - 1);
      if (cursor.row >= row && cursor.row <= end) {
        return {kind: 'code', label: opening[2]?.trim() === 'mermaid' ? 'Mermaid diagram' : 'code block',
          startRow: row, endRow: end, startColumn: 0, endColumn: lines[end]!.length,
          editRow: Math.min(row + 1, end), editColumn: 0};
      }
      row = end;
      continue;
    }
    if (/^\s*\$\$\s*$/.test(lines[row] ?? '')) {
      let end = row + 1;
      while (end < lines.length && !/^\s*\$\$\s*$/.test(lines[end]!)) end += 1;
      end = Math.min(end, lines.length - 1);
      if (cursor.row >= row && cursor.row <= end) {
        return {kind: 'math', label: 'LaTeX math block', startRow: row, endRow: end,
          startColumn: 0, endColumn: lines[end]!.length, editRow: Math.min(row + 1, end), editColumn: 0};
      }
      row = end;
    }
  }

  const line = lines[cursor.row] ?? '';
  for (const match of line.matchAll(/!\[[^\]]*\]\([^)]*\)|\*\*[^*]*\*\*/g)) {
    if (cursor.column >= match.index && cursor.column <= match.index + match[0].length) {
      const inside = match[0].startsWith('![') ? 2 : 2;
      return {kind: 'inline', label: match[0].startsWith('![') ? 'image' : 'bold text',
        startRow: cursor.row, endRow: cursor.row, startColumn: match.index,
        endColumn: match.index + match[0].length, editRow: cursor.row, editColumn: match.index + inside};
    }
  }
  const kind = classifyMarkdownLines([line])[0];
  if (kind === 'heading' || kind === 'list') {
    const marker = kind === 'heading' ? line.match(/^\s*#{1,6}\s+/) : line.match(/^\s*(?:[-*+]\s|\d+[.)]\s)/);
    return {kind: 'line', label: kind === 'heading' ? 'heading' : 'list item', startRow: cursor.row,
      endRow: cursor.row, startColumn: 0, endColumn: line.length, editRow: cursor.row, editColumn: marker?.[0].length ?? 0};
  }
  return undefined;
}

export function focusMarkdownBlock(buffer: EditorBuffer, block: MarkdownBlock): EditorBuffer {
  return {...buffer, cursor: {row: block.editRow, column: block.editColumn}};
}

export function removeMarkdownBlock(buffer: EditorBuffer, block: MarkdownBlock): EditorBuffer {
  const lines = [...buffer.lines];
  if (block.kind === 'inline') {
    const line = lines[block.startRow] ?? '';
    lines[block.startRow] = line.slice(0, block.startColumn) + line.slice(block.endColumn);
    return {lines, cursor: {row: block.startRow, column: block.startColumn}};
  }
  lines.splice(block.startRow, block.endRow - block.startRow + 1);
  if (lines.length === 0) lines.push('');
  const row = Math.min(block.startRow, lines.length - 1);
  return {lines, cursor: {row, column: 0}};
}
