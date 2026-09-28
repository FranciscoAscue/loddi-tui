import {describe, expect, it} from 'vitest';
import {
  backspace,
  createBuffer,
  deleteCurrentLine,
  deleteForward,
  deleteWordForward,
  findFrom,
  indentAtCursor,
  insertNewline,
  insertText,
  moveCursor,
  moveCursorByPage,
  serializeBuffer,
  visibleStart,
} from '../src/domain/editor-buffer.js';

describe('editor buffer', () => {
  it('inserta texto y saltos de línea en la posición del cursor', () => {
    let buffer = createBuffer('hola');
    buffer = moveCursor(buffer, 'end');
    buffer = insertText(buffer, ' mundo');
    buffer = insertNewline(buffer);
    buffer = insertText(buffer, 'segunda');
    expect(serializeBuffer(buffer)).toBe('hola mundo\nsegunda');
    expect(buffer.cursor).toEqual({row: 1, column: 7});
  });

  it('une líneas al borrar al inicio de una línea', () => {
    let buffer = createBuffer('uno\ndos');
    buffer = {...buffer, cursor: {row: 1, column: 0}};
    buffer = backspace(buffer);
    expect(serializeBuffer(buffer)).toBe('unodos');
    expect(buffer.cursor).toEqual({row: 0, column: 3});
  });

  it('borra hacia delante con Supr sin mover el cursor', () => {
    const buffer = deleteForward({...createBuffer('uno'), cursor: {row: 0, column: 1}});
    expect(serializeBuffer(buffer)).toBe('uo');
    expect(buffer.cursor).toEqual({row: 0, column: 1});
  });

  it('une la línea siguiente con Supr al final de una línea', () => {
    const buffer = deleteForward({...createBuffer('uno\ndos'), cursor: {row: 0, column: 3}});
    expect(serializeBuffer(buffer)).toBe('unodos');
    expect(buffer.cursor).toEqual({row: 0, column: 3});
  });

  it('deja intacto el documento con Supr al final', () => {
    const buffer = {...createBuffer('uno'), cursor: {row: 0, column: 3}};
    expect(deleteForward(buffer)).toBe(buffer);
  });

  it('inserta dos espacios con Tab en la posición del cursor', () => {
    const buffer = indentAtCursor({...createBuffer('texto'), cursor: {row: 0, column: 2}});
    expect(serializeBuffer(buffer)).toBe('te  xto');
    expect(buffer.cursor).toEqual({row: 0, column: 4});
  });

  it('borra el resto de una palabra con Ctrl+Supr', () => {
    const buffer = deleteWordForward({...createBuffer('primero segundo'), cursor: {row: 0, column: 3}});
    expect(serializeBuffer(buffer)).toBe('pri segundo');
    expect(buffer.cursor).toEqual({row: 0, column: 3});
  });

  it('borra espacios y la palabra siguiente con Ctrl+Supr', () => {
    const buffer = deleteWordForward({...createBuffer('uno   dos tres'), cursor: {row: 0, column: 3}});
    expect(serializeBuffer(buffer)).toBe('uno tres');
  });

  it('une líneas con Ctrl+Supr al final de la línea', () => {
    const buffer = deleteWordForward({...createBuffer('uno\ndos'), cursor: {row: 0, column: 3}});
    expect(serializeBuffer(buffer)).toBe('unodos');
  });

  it('borra la línea actual sin dejar un documento sin líneas', () => {
    const buffer = deleteCurrentLine({...createBuffer('uno\ndos'), cursor: {row: 1, column: 2}});
    expect(serializeBuffer(buffer)).toBe('uno');
    expect(deleteCurrentLine(createBuffer('única')).lines).toEqual(['']);
  });

  it('busca desde el cursor y continúa desde el inicio', () => {
    const buffer = {...createBuffer('uno\ndos\nUNO'), cursor: {row: 1, column: 3}};
    expect(findFrom(buffer, 'uno')).toEqual({row: 2, column: 0});
  });

  it('navega por páginas y respeta los extremos del documento', () => {
    const lines = Array.from({length: 30}, (_, index) => `line ${index}`).join('\n');
    let buffer = createBuffer(lines);
    buffer = moveCursorByPage(buffer, 'down', 10);
    expect(buffer.cursor).toEqual({row: 9, column: 0});
    expect(visibleStart(buffer, 10)).toBe(4);
    buffer = moveCursorByPage(buffer, 'up', 10);
    expect(buffer.cursor.row).toBe(0);
    buffer = moveCursorByPage(buffer, 'up', 10);
    expect(buffer.cursor.row).toBe(0);
    buffer = moveCursorByPage({...buffer, cursor: {row: 29, column: 0}}, 'down', 10);
    expect(buffer.cursor.row).toBe(29);
  });
});
