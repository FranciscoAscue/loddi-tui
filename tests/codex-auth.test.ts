import {EventEmitter} from 'node:events';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanCodexOutput, getCodexAuthStatus, loginCodexWithDevice} from '../src/services/codex-auth.js';

const spawnMock = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({spawn: spawnMock}));

function fakeCodex(code: number, output: string) {
  const child = new EventEmitter() as EventEmitter & {stdout: EventEmitter; stderr: EventEmitter; kill: () => void};
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  spawnMock.mockReturnValue(child);
  queueMicrotask(() => {
    child.stdout.emit('data', output);
    child.emit('close', code);
  });
  return child;
}

beforeEach(() => spawnMock.mockReset());

describe('Codex auth output', () => {
  it('removes terminal controls while preserving the sign-in URL and code', () => {
    expect(cleanCodexOutput('\x1b[36mhttps://auth.openai.com/codex/device\x1b[0m\r\nABC-123\x07'))
      .toBe('https://auth.openai.com/codex/device\nABC-123');
  });

  it('recognizes an unauthenticated Codex CLI', async () => {
    fakeCodex(1, 'Not logged in\n');
    expect(await getCodexAuthStatus()).toEqual({kind: 'signed-out', detail: 'Not logged in'});
    expect(spawnMock.mock.calls[0]?.[1]).toEqual(['login', 'status']);
  });

  it('streams device-code instructions and lets Codex own the login', async () => {
    fakeCodex(0, 'Open https://auth.openai.com/codex/device\nCode: ABC-123\n');
    const updates: string[] = [];
    await loginCodexWithDevice(value => updates.push(value));
    expect(spawnMock.mock.calls[0]?.[1]).toEqual(['login', '--device-auth']);
    expect(updates.at(-1)).toContain('Code: ABC-123');
  });
});
