import {describe, expect, it} from 'vitest';
import {pandocAssetPattern, typstAssetPattern} from '../src/services/tools.js';

describe('managed Pandoc archive selection', () => {
  it.each([
    ['win32', 'x64', 'pandoc-3.11-windows-x86_64.zip'],
    ['darwin', 'x64', 'pandoc-3.11-x86_64-macOS.zip'],
    ['darwin', 'arm64', 'pandoc-3.11-arm64-macOS.zip'],
    ['linux', 'x64', 'pandoc-3.11-linux-amd64.tar.gz'],
    ['linux', 'arm64', 'pandoc-3.11-linux-arm64.tar.gz'],
  ] as const)('supports %s/%s', (platform, arch, archive) => {
    expect(pandocAssetPattern(platform, arch).test(archive)).toBe(true);
  });

  it('rejects unsupported combinations', () => {
    expect(() => pandocAssetPattern('win32', 'arm64')).toThrow(/not available/);
  });
});

describe('managed Typst archive selection', () => {
  it.each([
    ['win32', 'x64', 'typst-x86_64-pc-windows-msvc.zip'],
    ['win32', 'arm64', 'typst-aarch64-pc-windows-msvc.zip'],
    ['darwin', 'x64', 'typst-x86_64-apple-darwin.tar.xz'],
    ['darwin', 'arm64', 'typst-aarch64-apple-darwin.tar.xz'],
    ['linux', 'x64', 'typst-x86_64-unknown-linux-musl.tar.xz'],
    ['linux', 'arm64', 'typst-aarch64-unknown-linux-musl.tar.xz'],
  ] as const)('supports %s/%s', (platform, arch, archive) => {
    expect(typstAssetPattern(platform, arch).test(archive)).toBe(true);
  });
});
