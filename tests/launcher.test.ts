import {describe, expect, it} from 'vitest';
import {filterDocuments, getListWindow} from '../src/domain/launcher.js';

const documents = Array.from({length: 12}, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    label: `${number}-chapter`,
    path: `chapters/${number}-chapter.md`,
  };
});

describe('manuscript launcher', () => {
  it('searches across every chapter instead of truncating the collection', () => {
    expect(filterDocuments(documents, '10')).toEqual([
      {label: '10-chapter', path: 'chapters/10-chapter.md'},
    ]);
    expect(filterDocuments(documents, '')).toHaveLength(12);
  });

  it('keeps a small scrolling window around the selected chapter', () => {
    expect(getListWindow(12, 0, 6)).toEqual({start: 0, end: 6});
    expect(getListWindow(12, 7, 6)).toEqual({start: 4, end: 10});
    expect(getListWindow(12, 11, 6)).toEqual({start: 6, end: 12});
  });
});
