export interface Cursor {
  row: number;
  column: number;
}

export interface EditorBuffer {
  lines: string[];
  cursor: Cursor;
}

export function createBuffer(contents: string): EditorBuffer {
  return {
    lines: contents.replaceAll('\r\n', '\n').split('\n'),
    cursor: {row: 0, column: 0},
  };
}

export function serializeBuffer(buffer: EditorBuffer): string {
  return buffer.lines.join('\n');
}

function clampedCursor(lines: string[], cursor: Cursor): Cursor {
  const row = Math.max(0, Math.min(cursor.row, lines.length - 1));
  const line = lines[row] ?? '';
  return {row, column: Math.max(0, Math.min(cursor.column, line.length))};
}

export function insertText(buffer: EditorBuffer, input: string): EditorBuffer {
  if (input.length === 0) return buffer;
  const lines = [...buffer.lines];
  const current = lines[buffer.cursor.row] ?? '';
  const before = current.slice(0, buffer.cursor.column);
  const after = current.slice(buffer.cursor.column);
  const inserted = input.replaceAll('\r\n', '\n').split('\n');

  if (inserted.length === 1) {
    lines[buffer.cursor.row] = before + inserted[0] + after;
    return {
      lines,
      cursor: {row: buffer.cursor.row, column: buffer.cursor.column + (inserted[0]?.length ?? 0)},
    };
  }

  const first = before + (inserted[0] ?? '');
  const lastText = inserted.at(-1) ?? '';
  const middle = inserted.slice(1, -1);
  lines.splice(buffer.cursor.row, 1, first, ...middle, lastText + after);
  return {
    lines,
    cursor: {row: buffer.cursor.row + inserted.length - 1, column: lastText.length},
  };
}

export function insertNewline(buffer: EditorBuffer): EditorBuffer {
  return insertText(buffer, '\n');
}

export function indentAtCursor(buffer: EditorBuffer): EditorBuffer {
  return insertText(buffer, '  ');
}

export function backspace(buffer: EditorBuffer): EditorBuffer {
  const {row, column} = buffer.cursor;
  const lines = [...buffer.lines];
  if (column > 0) {
    const line = lines[row] ?? '';
    lines[row] = line.slice(0, column - 1) + line.slice(column);
    return {lines, cursor: {row, column: column - 1}};
  }
  if (row === 0) return buffer;
  const previous = lines[row - 1] ?? '';
  const current = lines[row] ?? '';
  lines.splice(row - 1, 2, previous + current);
  return {lines, cursor: {row: row - 1, column: previous.length}};
}

export function deleteForward(buffer: EditorBuffer): EditorBuffer {
  const {row, column} = buffer.cursor;
  const line = buffer.lines[row] ?? '';
  const lines = [...buffer.lines];
  if (column < line.length) {
    lines[row] = line.slice(0, column) + line.slice(column + 1);
    return {lines, cursor: {row, column}};
  }
  if (row === lines.length - 1) return buffer;
  lines.splice(row, 2, line + (lines[row + 1] ?? ''));
  return {lines, cursor: {row, column}};
}

export function deleteWordForward(buffer: EditorBuffer): EditorBuffer {
  const {row, column} = buffer.cursor;
  const line = buffer.lines[row] ?? '';
  if (column === line.length) return deleteForward(buffer);
  const remaining = line.slice(column);
  const length = (remaining.match(/^\s*\S+/u)?.[0] ?? remaining).length;
  const lines = [...buffer.lines];
  lines[row] = line.slice(0, column) + remaining.slice(length);
  return {lines, cursor: {row, column}};
}

export function deleteCurrentLine(buffer: EditorBuffer): EditorBuffer {
  const lines = [...buffer.lines];
  if (lines.length === 1) return {lines: [''], cursor: {row: 0, column: 0}};
  lines.splice(buffer.cursor.row, 1);
  return {lines, cursor: clampedCursor(lines, buffer.cursor)};
}

export function moveCursor(
  buffer: EditorBuffer,
  direction: 'left' | 'right' | 'up' | 'down' | 'home' | 'end' | 'wordLeft' | 'wordRight',
): EditorBuffer {
  const {row, column} = buffer.cursor;
  const line = buffer.lines[row] ?? '';
  let next: Cursor = {row, column};

  if (direction === 'left') {
    next = column > 0
      ? {row, column: column - 1}
      : row > 0 ? {row: row - 1, column: (buffer.lines[row - 1] ?? '').length} : next;
  } else if (direction === 'right') {
    next = column < line.length
      ? {row, column: column + 1}
      : row < buffer.lines.length - 1 ? {row: row + 1, column: 0} : next;
  } else if (direction === 'up') {
    next = {row: row - 1, column};
  } else if (direction === 'down') {
    next = {row: row + 1, column};
  } else if (direction === 'home') {
    next = {row, column: 0};
  } else if (direction === 'end') {
    next = {row, column: line.length};
  } else if (direction === 'wordLeft') {
    const before = line.slice(0, column);
    const match = before.match(/\S+\s*$/);
    next = {row, column: match ? column - match[0].length : 0};
  } else if (direction === 'wordRight') {
    const after = line.slice(column);
    const match = after.match(/^\s*\S+/);
    next = {row, column: match ? column + match[0].length : line.length};
  }
  return {...buffer, cursor: clampedCursor(buffer.lines, next)};
}

export function moveCursorByPage(buffer: EditorBuffer, direction: 'up' | 'down', pageSize: number): EditorBuffer {
  const offset = Math.max(1, Math.floor(pageSize) - 1) * (direction === 'up' ? -1 : 1);
  return {...buffer, cursor: clampedCursor(buffer.lines, {
    row: buffer.cursor.row + offset,
    column: buffer.cursor.column,
  })};
}

export function visibleStart(buffer: EditorBuffer, height: number): number {
  const rows = Math.max(1, Math.floor(height));
  return Math.max(0, Math.min(buffer.cursor.row - Math.floor(rows / 2), buffer.lines.length - rows));
}

export function findFrom(buffer: EditorBuffer, query: string): Cursor | undefined {
  if (!query) return undefined;
  const needle = query.toLocaleLowerCase();
  for (let offset = 0; offset < buffer.lines.length; offset += 1) {
    const row = (buffer.cursor.row + offset) % buffer.lines.length;
    const line = buffer.lines[row] ?? '';
    const start = offset === 0 ? buffer.cursor.column + 1 : 0;
    const column = line.toLocaleLowerCase().indexOf(needle, start);
    if (column >= 0) return {row, column};
  }
  return undefined;
}
