import {describe, expect, it} from 'vitest';
import {createBuffer} from '../src/domain/editor-buffer.js';
import {cursorFromMouse, parseMouseInput} from '../src/domain/editor-mouse.js';

describe('editor mouse', () => {
  it('recognizes clicks and wheel events without treating them as text', () => {
    expect(parseMouseInput('[<0;8;3M')).toEqual({kind: 'click', x: 8, y: 3});
    expect(parseMouseInput('[<64;8;3M')).toEqual({kind: 'scroll', direction: 'up'});
    expect(parseMouseInput('[<65;8;3M')).toEqual({kind: 'scroll', direction: 'down'});
    expect(parseMouseInput('[<0;8;3m')).toBeUndefined();
  });

  it('maps a click to a visible source row and Unicode-aware column', () => {
    const buffer = createBuffer('a界b\nsecond');
    expect(cursorFromMouse(buffer, 11, 3, 8)?.cursor).toEqual({row: 0, column: 2});
    expect(cursorFromMouse(buffer, 8, 4, 8)?.cursor).toEqual({row: 1, column: 0});
    expect(cursorFromMouse(buffer, 8, 2, 8)).toBeUndefined();
  });
});
