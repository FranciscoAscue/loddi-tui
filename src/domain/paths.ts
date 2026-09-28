import path from 'node:path';

export function assertRelativeProjectPath(value: string): string {
  const normalized = value.replaceAll('\\', '/');
  if (
    normalized.length === 0
    || path.posix.isAbsolute(normalized)
    || normalized === '..'
    || normalized.startsWith('../')
    || normalized.includes('/../')
  ) {
    throw new Error(`Invalid project-relative path: ${value}`);
  }
  return normalized;
}

export function resolveInProject(root: string, relativePath: string): string {
  const safePath = assertRelativeProjectPath(relativePath);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, safePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Path escapes the project directory: ${relativePath}`);
  }
  return resolved;
}

export function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'untitled';
}
