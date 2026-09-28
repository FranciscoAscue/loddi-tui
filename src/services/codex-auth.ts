import {spawn} from 'node:child_process';

export type CodexAuthStatus =
  | {kind: 'ready'; detail: string}
  | {kind: 'signed-out'; detail: string}
  | {kind: 'missing'; detail: string}
  | {kind: 'error'; detail: string};

export function cleanCodexOutput(value: string): string {
  return value
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\r/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
}

function codexExecutable(): string {
  return process.platform === 'win32' ? 'codex.cmd' : 'codex';
}

async function runCodexAuthCommand(
  args: string[],
  signal?: AbortSignal,
  onOutput?: (message: string) => void,
): Promise<{code: number | null; output: string}> {
  return new Promise((resolve, reject) => {
    const child = spawn(codexExecutable(), args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      signal,
      windowsHide: true,
    });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, args.includes('--device-auth') ? 600_000 : 15_000);
    const receive = (chunk: Buffer | string) => {
      output = (output + cleanCodexOutput(String(chunk))).slice(-4000);
      onOutput?.(output.trim());
    };
    child.stdout.on('data', receive);
    child.stderr.on('data', receive);
    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut) reject(new Error('Codex authentication timed out.'));
      else if (signal?.aborted) reject(new Error('Codex authentication cancelled.'));
      else resolve({code, output: output.trim()});
    });
  });
}

export async function getCodexAuthStatus(signal?: AbortSignal): Promise<CodexAuthStatus> {
  try {
    const result = await runCodexAuthCommand(['login', 'status'], signal);
    if (result.code === 0) return {kind: 'ready', detail: result.output || 'Signed in to Codex.'};
    return {kind: 'signed-out', detail: result.output || 'Codex is not signed in.'};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {kind: 'missing', detail: 'Codex CLI is not installed.'};
    }
    if (signal?.aborted) throw error;
    return {kind: 'error', detail: error instanceof Error ? error.message : String(error)};
  }
}

export async function loginCodexWithDevice(
  onOutput: (message: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const result = await runCodexAuthCommand(['login', '--device-auth'], signal, onOutput);
  if (result.code !== 0) throw new Error(result.output || 'Codex sign-in did not complete.');
}
