import {describe, expect, it} from 'vitest';
import {applyAiEdit, blockText, validateAiEdit} from '../src/domain/ai-edit.js';
import {createBuffer, serializeBuffer} from '../src/domain/editor-buffer.js';
import {findMarkdownBlock} from '../src/domain/markdown-editing.js';
import {buildCodexPrompt} from '../src/services/codex.js';

describe('AI proposals', () => {
  it('replaces only the selected Mermaid block', () => {
    const buffer = createBuffer('Before\n```mermaid\ngraph LR\nA-->B\n```\nAfter');
    const selected = {...buffer, cursor: {row: 2, column: 2}};
    const block = findMarkdownBlock(selected)!;
    expect(blockText(selected, block)).toContain('graph LR');
    const proposal = '```mermaid\ngraph TD\nA-->C\n```';
    expect(validateAiEdit(proposal, block)).toBeUndefined();
    expect(serializeBuffer(applyAiEdit(selected, proposal, block))).toBe('Before\n```mermaid\ngraph TD\nA-->C\n```\nAfter');
  });

  it('rejects incomplete math and code replacements', () => {
    const math = createBuffer('$$\nx = 1\n$$');
    const mathBlock = findMarkdownBlock({...math, cursor: {row: 1, column: 0}})!;
    expect(validateAiEdit('x = 2', mathBlock)).toContain('LaTeX');
    const code = createBuffer('```python\nprint(1)\n```');
    const codeBlock = findMarkdownBlock({...code, cursor: {row: 1, column: 0}})!;
    expect(validateAiEdit('print(2)', codeBlock)).toContain('code');
  });

  it('inserts generated blocks on separate lines when the cursor is inside prose', () => {
    const buffer = {...createBuffer('before after'), cursor: {row: 0, column: 6}};
    const result = applyAiEdit(buffer, '```python\nprint(1)\n```');
    expect(serializeBuffer(result)).toBe('before\n```python\nprint(1)\n```\n after');
  });

  it('builds a scoped prompt without filesystem access instructions', () => {
    const prompt = buildCodexPrompt({mode: 'insert', instruction: 'Add a diagram', context: 'one line', label: 'current line'});
    expect(prompt).toContain('Do not run commands, inspect files, or edit files.');
    expect(prompt).toContain('Task: Add a diagram');
  });
});
