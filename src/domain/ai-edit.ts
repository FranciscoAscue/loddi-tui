import type {EditorBuffer} from './editor-buffer.js';
import {insertText} from './editor-buffer.js';
import type {MarkdownBlock} from './markdown-editing.js';

export function blockText(buffer: EditorBuffer, block: MarkdownBlock): string {
  const lines = buffer.lines.slice(block.startRow, block.endRow + 1);
  if (block.kind === 'inline') return (lines[0] ?? '').slice(block.startColumn, block.endColumn);
  return lines.join('\n');
}

export function validateAiEdit(proposal: string, block?: MarkdownBlock): string | undefined {
  if (!proposal.trim()) return 'Codex returned no Markdown.';
  if (proposal.length > 100_000) return 'The proposal is too large.';
  if (!block) return undefined;
  const text = proposal.trim();
  if (block.kind === 'inline' && text.includes('\n')) return 'An inline replacement must stay on one line.';
  if (block.label === 'Mermaid diagram' && !/^\x60{3,}mermaid\s*\n[\s\S]*\n\x60{3,}$/i.test(text)) {
    return 'A Mermaid replacement must be a complete fenced mermaid block.';
  }
  if (block.label === 'LaTeX math block' && !/^\$\$\s*\n[\s\S]*\n\$\$$/.test(text)) {
    return 'A LaTeX replacement must be a complete $$ block.';
  }
  if (block.label === 'code block' && !/^\x60{3,}[^\n]+\n[\s\S]*\n\x60{3,}$/.test(text)) {
    return 'A code replacement must be a complete fenced block with a language.';
  }
  return undefined;
}

export function applyAiEdit(buffer: EditorBuffer, proposal: string, block?: MarkdownBlock): EditorBuffer {
  if (!block) {
    const line = buffer.lines[buffer.cursor.row] ?? '';
    const multiline = proposal.includes('\n');
    const prefix = multiline && line.slice(0, buffer.cursor.column).trim() ? '\n' : '';
    const suffix = multiline && line.slice(buffer.cursor.column).trim() ? '\n' : '';
    return insertText(buffer, prefix + proposal + suffix);
  }
  const lines = [...buffer.lines];
  const replacement = proposal.trim().split('\n');
  if (block.kind === 'inline') {
    const original = lines[block.startRow] ?? '';
    lines[block.startRow] = original.slice(0, block.startColumn) + proposal.trim() + original.slice(block.endColumn);
    return {lines, cursor: {row: block.startRow, column: block.startColumn + proposal.trim().length}};
  }
  lines.splice(block.startRow, block.endRow - block.startRow + 1, ...replacement);
  return {lines, cursor: {row: block.startRow, column: 0}};
}
