import {describe, expect, it} from 'vitest';
import {appendMissingBibtex, deleteEntryByKey, getBibtexField, parseBibtex, updateBibtexField} from '../src/services/bibliography.js';

const SAMPLE = `@article{Smith2020,
  author = {Smith, John},
  title  = {A Great Paper},
  year   = {2020},
}

@book{Jones2019,
  author = {Jones, Alice},
  title  = {A Great Book},
  year   = {2019},
}

@misc{Web2021,
  title = {Some Website},
  year  = {2021},
}
`;

describe('parseBibtex', () => {
  it('parses all entry types', () => {
    const entries = parseBibtex(SAMPLE);
    expect(entries).toHaveLength(3);
    expect(entries.map(e => e.key)).toEqual(['Smith2020', 'Jones2019', 'Web2021']);
    expect(entries[0]?.type).toBe('article');
    expect(entries[1]?.title).toContain('Great Book');
  });

  it('extracts titles correctly', () => {
    const entries = parseBibtex(SAMPLE);
    expect(entries[0]?.title).toBe('A Great Paper');
    expect(entries[1]?.title).toBe('A Great Book');
  });

  it('returns empty array for empty input', () => {
    expect(parseBibtex('')).toEqual([]);
  });

  it('skips @comment and @preamble', () => {
    const source = '@comment{This is a comment}\n@preamble{"Some preamble"}\n' + SAMPLE;
    expect(parseBibtex(source)).toHaveLength(3);
  });
});

describe('appendMissingBibtex', () => {
  it('adds new entries and skips duplicates', () => {
    const existing = `@article{Smith2020,\n  title = {Existing},\n}\n`;
    const imported = `@article{Smith2020,\n  title = {Duplicate},\n}\n@book{New2022,\n  title = {New Book},\n}\n`;
    const result = appendMissingBibtex(existing, imported);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.contents).toContain('New2022');
    expect(result.contents).not.toContain('Duplicate');
  });

  it('is case-insensitive for duplicate detection', () => {
    const existing = `@article{smith2020,\n  title = {A},\n}\n`;
    const imported = `@article{Smith2020,\n  title = {B},\n}\n`;
    const result = appendMissingBibtex(existing, imported);
    expect(result.skipped).toBe(1);
    expect(result.added).toBe(0);
  });
});

describe('deleteEntryByKey', () => {
  it('removes the target entry and keeps the rest', () => {
    const result = deleteEntryByKey(SAMPLE, 'Jones2019');
    const remaining = parseBibtex(result);
    expect(remaining.map(e => e.key)).toEqual(['Smith2020', 'Web2021']);
    expect(result).not.toContain('Jones2019');
  });

  it('is case-insensitive', () => {
    const result = deleteEntryByKey(SAMPLE, 'SMITH2020');
    expect(parseBibtex(result).map(e => e.key)).toEqual(['Jones2019', 'Web2021']);
  });

  it('returns the original string unchanged when key is not found', () => {
    const result = deleteEntryByKey(SAMPLE, 'DoesNotExist');
    expect(result).toBe(SAMPLE);
  });

  it('deletes the only entry and returns an empty string', () => {
    const single = `@article{Only2023,\n  title = {Alone},\n}\n`;
    const result = deleteEntryByKey(single, 'Only2023');
    expect(result.trim()).toBe('');
    expect(parseBibtex(result)).toHaveLength(0);
  });

  it('does not leave excessive blank lines after deletion', () => {
    const result = deleteEntryByKey(SAMPLE, 'Jones2019');
    expect(result).not.toMatch(/\n{3,}/);
  });
});

describe('edit reference fields', () => {
  it('updates nested BibTeX values and preserves the other entries', () => {
    const source = '@article{Nested2026,\n  title = {A {Complex} Title},\n  author = {Original Author},\n}\n\n@book{Keep2025,\n  title = {Untouched},\n}\n';
    const result = updateBibtexField(source, 'Nested2026', 'title', 'A New {Complex} Title');
    expect(result).toContain('title = {A New {Complex} Title}');
    expect(result).toContain('author = {Original Author}');
    expect(result).toContain('@book{Keep2025,\n  title = {Untouched},\n}');
    expect(getBibtexField(parseBibtex(result)[0]!.raw, 'title')).toBe('A New {Complex} Title');
  });

  it('adds a missing field and rejects unbalanced braces', () => {
    const source = '@misc{Web2026,\n  title = {Example}\n}\n';
    const result = updateBibtexField(source, 'Web2026', 'year', '2026');
    expect(parseBibtex(result)).toHaveLength(1);
    expect(getBibtexField(parseBibtex(result)[0]!.raw, 'year')).toBe('2026');
    expect(() => updateBibtexField(source, 'Web2026', 'title', '{Broken')).toThrow(/balanced/);
  });
});
