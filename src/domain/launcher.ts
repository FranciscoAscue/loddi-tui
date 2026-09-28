export interface SearchableDocument {
  label: string;
  path: string;
}

export function filterDocuments<T extends SearchableDocument>(entries: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  return entries.filter(entry =>
    !needle
    || entry.label.toLowerCase().includes(needle)
    || entry.path.toLowerCase().includes(needle),
  );
}

export function getListWindow(total: number, selected: number, visibleLimit: number) {
  const limit = Math.max(1, visibleLimit);
  const safeSelected = Math.min(Math.max(0, total - 1), Math.max(0, selected));
  const start = Math.min(
    Math.max(0, total - limit),
    Math.max(0, safeSelected - Math.floor(limit / 2)),
  );
  return {start, end: Math.min(total, start + limit)};
}
