import os from 'node:os';
import path from 'node:path';

export function dataDirectory(): string {
  if (process.env['LODDI_HOME']) return path.resolve(process.env['LODDI_HOME']);
  if (process.platform === 'win32') return path.join(process.env['LOCALAPPDATA'] || os.homedir(), 'Loddi');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Loddi');
  return path.join(process.env['XDG_DATA_HOME'] || path.join(os.homedir(), '.local', 'share'), 'loddi');
}
