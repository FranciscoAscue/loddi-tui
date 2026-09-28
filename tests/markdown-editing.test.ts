import {describe, expect, it} from 'vitest';
import {createBuffer, serializeBuffer} from '../src/domain/editor-buffer.js';
import {classifyMarkdownLines, fencedLanguagesForLines, findMarkdownBlock, focusMarkdownBlock, highlightMarkdownLine, insertTemplate, removeMarkdownBlock} from '../src/domain/markdown-editing.js';

describe('Markdown editor helpers', () => {
  it.each([
    ['bold', '****', {row: 0, column: 2}],
    ['code', '```text\n\n```', {row: 1, column: 0}],
    ['mermaid', '```mermaid\ngraph LR\n  A --> B\n```', {row: 2, column: 9}],
    ['math', '$$\n\n$$', {row: 1, column: 0}],
  ] as const)('inserts %s with a useful cursor position', (template, contents, cursor) => {
    const result = insertTemplate(createBuffer(''), template);
    expect(serializeBuffer(result)).toBe(contents);
    expect(result.cursor).toEqual(cursor);
  });

  it('highlights block structure without treating code content as headings', () => {
    expect(classifyMarkdownLines([
      '# Title', '```mermaid', '# inside code', '```', '$$', 'x^2', '$$', '- item', '> quote', '| A | B |', 'plain',
    ])).toEqual(['heading', 'fence', 'code', 'fence', 'math', 'math', 'math', 'list', 'quote', 'table', 'plain']);
  });

  it('distinguishes Markdown blocks and inline constructs', () => {
    expect(highlightMarkdownLine('```mermaid', 'fence')).toEqual([
      {text: '```', color: 'magenta'}, {text: 'mermaid', color: 'cyan'},
    ]);
    expect(highlightMarkdownLine('# Title', 'heading')).toEqual([
      {text: '# ', color: 'cyan', bold: true}, {text: 'Title', color: 'white', bold: true},
    ]);
    const spans = highlightMarkdownLine('See [site](https://example.com), ![alt](fig.png), [@key], @other, `code` and $x^2$.', 'plain');
    expect(spans).toEqual(expect.arrayContaining([
      {text: '[site](https://example.com)', color: 'cyan'},
      {text: '![alt](fig.png)', color: 'blue'},
      {text: '[@key]', color: 'yellow'},
      {text: '@other', color: 'yellow'},
      {text: '`code`', color: 'green'},
      {text: '$x^2$', color: 'magenta'},
    ]));
  });

  it('uses the fenced language to distinguish code syntax', () => {
    const lines = ['```typescript', 'const total: number = 42; // count', '```', '```python', 'def greet(name): # hello', '```'];
    expect(fencedLanguagesForLines(lines)).toEqual([undefined, 'js', undefined, undefined, 'python']);
    expect(highlightMarkdownLine(lines[1]!, 'code', 'typescript')).toEqual(expect.arrayContaining([
      {text: 'const', color: 'magenta', bold: true},
      {text: 'number', color: 'cyan'},
      {text: '42', color: 'blue'},
      {text: '// count', color: 'gray'},
    ]));
    expect(highlightMarkdownLine(lines[4]!, 'code', 'python')).toEqual(expect.arrayContaining([
      {text: 'def', color: 'magenta', bold: true},
      {text: '# hello', color: 'gray'},
    ]));
  });

  it('handles structured data and does not treat comment markers inside strings as comments', () => {
    expect(highlightMarkdownLine('{"name": "http://example.com", "count": 2}', 'code', 'json')).toEqual(expect.arrayContaining([
      {text: '"name"', color: 'cyan'},
      {text: '"http://example.com"', color: 'green'},
      {text: '2', color: 'blue'},
    ]));
    expect(highlightMarkdownLine('SELECT id FROM books -- note', 'code', 'sql')).toEqual(expect.arrayContaining([
      {text: 'SELECT', color: 'magenta', bold: true},
      {text: '-- note', color: 'gray'},
    ]));
  });

  it.each([
    ['rust', 'fn main() { let x: i32 = 1; }', {text: 'fn', color: 'magenta', bold: true}],
    ['cpp', 'auto value = 1; // note', {text: 'auto', color: 'magenta', bold: true}],
    ['ruby', 'def greet # note', {text: 'def', color: 'magenta', bold: true}],
    ['go', 'func main() { return 1 }', {text: 'func', color: 'magenta', bold: true}],
    ['bash', 'export NAME="x" # note', {text: 'export', color: 'magenta', bold: true}],
    ['yaml', 'title: "Book" # note', {text: 'title', color: 'cyan'}],
    ['css', 'color: red;', {text: 'color', color: 'cyan'}],
    ['html', '<h1 class="title">', {text: '<h1', color: 'magenta', bold: true}],
    ['mermaid', 'graph LR', {text: 'graph', color: 'magenta', bold: true}],
    ['latex', '\\frac{1}{2}', {text: '\\frac', color: 'magenta', bold: true}],
  ] as const)('recognizes %s code', (language, line, token) => {
    expect(highlightMarkdownLine(line, 'code', language)).toEqual(expect.arrayContaining([token]));
  });

  it('focuses and removes a fenced block as one unit', () => {
    const buffer = {...createBuffer('# Start\n```mermaid\ngraph LR\n  A --> B\n```\nAfter'), cursor: {row: 2, column: 3}};
    const block = findMarkdownBlock(buffer);
    expect(block).toMatchObject({kind: 'code', label: 'Mermaid diagram', startRow: 1, endRow: 4});
    expect(focusMarkdownBlock(buffer, block!).cursor).toEqual({row: 2, column: 0});
    expect(serializeBuffer(removeMarkdownBlock(buffer, block!))).toBe('# Start\nAfter');
  });

  it('keeps inserted block boundaries separate from surrounding prose', () => {
    const buffer = insertTemplate(createBuffer('Existing prose'), 'code');
    expect(serializeBuffer(buffer)).toBe('```text\n\n```\nExisting prose');
    const block = findMarkdownBlock(buffer);
    expect(block).toMatchObject({kind: 'code', startRow: 0, endRow: 2});
    expect(serializeBuffer(removeMarkdownBlock(buffer, block!))).toBe('Existing prose');
  });

  it('removes math blocks and inline templates without touching surrounding text', () => {
    const math = {...createBuffer('Before\n$$\nx^2\n$$\nAfter'), cursor: {row: 2, column: 1}};
    expect(serializeBuffer(removeMarkdownBlock(math, findMarkdownBlock(math)!))).toBe('Before\nAfter');
    const image = {...createBuffer('See ![alt](figure.png) here'), cursor: {row: 0, column: 8}};
    expect(serializeBuffer(removeMarkdownBlock(image, findMarkdownBlock(image)!))).toBe('See  here');
  });
});
