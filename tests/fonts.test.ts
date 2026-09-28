import {describe, expect, it} from 'vitest';
import {bookSchema} from '../src/domain/book.js';
import {parseTypstFonts} from '../src/services/fonts.js';

describe('book typography', () => {
  it('parses, deduplicates, and sorts fonts reported by Typst', () => {
    expect(parseTypstFonts('Noto Serif\r\nDejaVu Sans\nNoto Serif\n')).toEqual([
      'DejaVu Sans',
      'Noto Serif',
    ]);
  });

  it('accepts a system font in the project manifest', () => {
    const book = bookSchema.parse({title: 'Multilingual', output: {mainFont: 'Noto Serif'}});
    expect(book.output.mainFont).toBe('Noto Serif');
  });
});
