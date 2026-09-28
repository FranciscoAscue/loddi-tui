import stringWidth from 'string-width';
import type {EditorBuffer} from './editor-buffer.js';
import {visibleStart} from './editor-buffer.js';

export type MouseEvent =
  | {kind: 'click'; x: number; y: number}
  | {kind: 'scroll'; direction: 'up' | 'down'};

// SGR 1006 mouse sequences arrive through Ink's useInput as "[<...M".
export function parseMouseInput(input: string): MouseEvent | undefined {
  const match = input.match(/^\[<([0-9]+);([0-9]+);([0-9]+)([Mm])$/);
  if (!match) return undefined;
  const button = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  if (button === 64 && match[4] === 'M') return {kind: 'scroll', direction: 'up'};
  if (button === 65 && match[4] === 'M') return {kind: 'scroll', direction: 'down'};
  if (button === 0 && match[4] === 'M') return {kind: 'click', x, y};
  return undefined;
}

function columnAtDisplayCell(line: string, target: number): number {
  let column = 0;
  let cells = 0;
  const segments = new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(line);
  for (const {segment} of segments) {
    const width = stringWidth(segment);
    if (cells + width > target) break;
    cells += width;
    column += segment.length;
  }
  return column;
}

export function cursorFromMouse(
  buffer: EditorBuffer,
  x: number,
  y: number,
  height: number,
): EditorBuffer | undefined {
  // Editor layout: header on row 1, border on row 2, source starts on row 3.
  if (y < 3 || y >= height + 3) return undefined;
  const row = visibleStart(buffer, height) + y - 3;
  if (row >= buffer.lines.length) return undefined;
  const gutterWidth = String(buffer.lines.length).length + 3;
  const sourceColumn = Math.max(0, x - (4 + gutterWidth));
  const column = columnAtDisplayCell(buffer.lines[row] ?? '', sourceColumn);
  return {...buffer, cursor: {row, column}};
}
