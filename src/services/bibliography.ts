export interface BibEntry {
  key: string;
  type: string;
  title: string;
  raw: string;
}

export function parseBibtex(source: string): BibEntry[] {
  const entries: BibEntry[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const at = source.indexOf('@', cursor);
    if (at < 0) break;
    let position = at + 1;
    while (/\s/u.test(source[position] ?? '')) position += 1;
    const typeStart = position;
    while (/[\p{L}\p{N}_-]/u.test(source[position] ?? '')) position += 1;
    const type = source.slice(typeStart, position);
    while (/\s/u.test(source[position] ?? '')) position += 1;
    const open = source[position];
    if (!type || (open !== '{' && open !== '(')) {
      cursor = at + 1;
      continue;
    }

    const close = open === '{' ? '}' : ')';
    position += 1;
    while (/\s/u.test(source[position] ?? '')) position += 1;
    const keyStart = position;
    while (position < source.length && source[position] !== ',' && source[position] !== close) position += 1;
    const key = source.slice(keyStart, position).trim();
    if (source[position] !== ',') {
      cursor = position + 1;
      continue;
    }

    const bodyStart = position + 1;
    position = bodyStart;
    let braceDepth = open === '{' ? 1 : 0;
    let parenDepth = open === '(' ? 1 : 0;
    let inQuote = false;
    let escaped = false;
    let ended = false;

    while (position < source.length) {
      const character = source[position]!;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inQuote = !inQuote;
      else if (!inQuote && character === '{') braceDepth += 1;
      else if (!inQuote && character === '}') {
        braceDepth -= 1;
        if (open === '{' && braceDepth === 0) {
          position += 1;
          ended = true;
          break;
        }
      } else if (!inQuote && open === '(' && character === '(') parenDepth += 1;
      else if (!inQuote && open === '(' && character === ')') {
        parenDepth -= 1;
        if (parenDepth === 0) {
          position += 1;
          ended = true;
          break;
        }
      }
      position += 1;
    }

    if (ended && key && !['comment', 'preamble'].includes(type.toLowerCase())) {
      const raw = source.slice(at, position).trim();
      const title = raw.match(/\btitle\s*=\s*(?:\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}|"([^"]*)")/iu);
      entries.push({key, type, title: (title?.[1] ?? title?.[2] ?? '').replace(/\s+/gu, ' ').trim(), raw});
    }
    cursor = Math.max(position, at + 1);
  }

  return entries;
}

export function appendMissingBibtex(existing: string, imported: string): {contents: string; added: number; skipped: number} {
  const currentEntries = parseBibtex(existing);
  const importedEntries = parseBibtex(imported);
  const keys = new Set(currentEntries.map(entry => entry.key.toLocaleLowerCase()));
  const additions: BibEntry[] = [];
  for (const entry of importedEntries) {
    const normalizedKey = entry.key.toLocaleLowerCase();
    if (keys.has(normalizedKey)) continue;
    keys.add(normalizedKey);
    additions.push(entry);
  }

  const separator = existing.length === 0 ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  const contents = additions.length === 0
    ? existing
    : `${existing}${separator}${additions.map(entry => entry.raw).join('\n\n')}\n`;
  return {contents, added: additions.length, skipped: importedEntries.length - additions.length};
}

/**
 * Remove a single entry from a BibTeX source string by citation key.
 * Returns the updated source with the entry removed.
 */
export function deleteEntryByKey(source: string, key: string): string {
  const entries = parseBibtex(source);
  const target = entries.find(entry => entry.key.toLocaleLowerCase() === key.toLocaleLowerCase());
  if (!target) return source;
  const result = source.replace(target.raw, '');
  // Collapse multiple blank lines left by the removal into at most two newlines.
  return result.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').trimEnd() + (result.trimEnd().length > 0 ? '\n' : '');
}

export type EditableBibField = 'title' | 'author' | 'year';

function fieldValueRange(raw: string, field: EditableBibField): {start: number; end: number} | undefined {
  const header = raw.match(/^@\s*[\p{L}\p{N}_-]+\s*[{(]\s*[^,]+,/u);
  if (!header) return undefined;
  const last = raw.length - 1;
  let cursor = header[0].length;

  while (cursor < last) {
    while (cursor < last && /[\s,]/u.test(raw[cursor] ?? '')) cursor += 1;
    const name = raw.slice(cursor).match(/^([\p{L}\p{N}_-]+)\s*=/u);
    if (!name) break;
    cursor += name[0].length;
    while (cursor < last && /\s/u.test(raw[cursor] ?? '')) cursor += 1;
    const start = cursor;
    let braces = 0;
    let inQuote = false;
    let escaped = false;

    while (cursor < last) {
      const character = raw[cursor]!;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inQuote = !inQuote;
      else if (!inQuote && character === '{') braces += 1;
      else if (!inQuote && character === '}') braces -= 1;
      else if (!inQuote && braces === 0 && character === ',') break;
      cursor += 1;
    }

    let end = cursor;
    while (end > start && /\s/u.test(raw[end - 1] ?? '')) end -= 1;
    if (name[1]?.toLocaleLowerCase() === field) return {start, end};
    cursor += 1;
  }
  return undefined;
}

export function getBibtexField(raw: string, field: EditableBibField): string {
  const range = fieldValueRange(raw, field);
  if (!range) return '';
  const value = raw.slice(range.start, range.end).trim();
  if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1);
  }
  return value;
}

export function updateBibtexField(source: string, key: string, field: EditableBibField, value: string): string {
  const entry = parseBibtex(source).find(item => item.key.toLocaleLowerCase() === key.toLocaleLowerCase());
  if (!entry) throw new Error(`Reference not found: ${key}`);
  const clean = value.trim().replace(/[\r\n]+/gu, ' ');
  if (!clean) throw new Error(`${field} cannot be empty.`);
  let depth = 0;
  for (const character of clean) {
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth < 0) throw new Error('BibTeX braces must be balanced.');
  }
  if (depth !== 0) throw new Error('BibTeX braces must be balanced.');

  const range = fieldValueRange(entry.raw, field);
  let updated: string;
  if (range) {
    updated = `${entry.raw.slice(0, range.start)}{${clean}}${entry.raw.slice(range.end)}`;
  } else {
    const end = entry.raw.length - 1;
    const before = entry.raw.slice(0, end).trimEnd();
    updated = `${before}${before.endsWith(',') ? '' : ','}\n  ${field} = {${clean}}\n${entry.raw[end]}`;
  }
  const offset = source.indexOf(entry.raw);
  if (offset < 0) throw new Error(`Reference not found: ${key}`);
  return `${source.slice(0, offset)}${updated}${source.slice(offset + entry.raw.length)}`;
}
