import {spawn} from 'node:child_process';
import {resolveTool} from './tools.js';

export function parseTypstFonts(output: string): string[] {
  return [...new Set(
    output
      .split(/\r?\n/u)
      .map(line => line.trim())
      .filter(Boolean),
  )].sort((left, right) => left.localeCompare(right));
}

function capture(executable: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {windowsHide: true});
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `Typst exited with code ${code ?? 'unknown'}.`));
    });
  });
}

export async function listSystemFonts(): Promise<string[]> {
  const typst = await resolveTool('typst');
  if (!typst) throw new Error('Typst is required to inspect system fonts. Install it with /install typst.');
  return parseTypstFonts(await capture(typst, ['fonts']));
}
