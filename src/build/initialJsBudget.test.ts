import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { checkInitialJsBudget } from '../../build/initialJsBudget.mjs';

const chunk = (code: string, imports: string[] = [], isEntry = false) => ({ type: 'chunk' as const, code, imports, isEntry });
const size = (code: string) => gzipSync(code).byteLength;

describe('initial JavaScript budget', () => {
  it('includes transitive static imports once across entries and cycles, excluding dynamic chunks and assets', () => {
    const bundle = {
      'entry.js': { ...chunk('entry', ['vendor.js'], true), dynamicImports: ['ja.js'] },
      'second.js': chunk('second', ['vendor.js'], true),
      'vendor.js': chunk('vendor', ['shared.js']),
      'shared.js': chunk('shared', ['vendor.js']),
      'ja.js': chunk('unselected language', ['lazy-only.js']),
      'lazy-only.js': chunk('lazy dependency'),
      'style.css': { type: 'asset' as const },
    };
    const result = checkInitialJsBudget(bundle);
    expect(result.files).toEqual(['entry.js', 'second.js', 'shared.js', 'vendor.js']);
    expect(result.gzipBytes).toBe(size('entry') + size('second') + size('vendor') + size('shared'));
  });

  it('fails a deliberately low budget and passes the exact transfer size', () => {
    const bundle = { 'entry.js': chunk('initial application', [], true) };
    expect(() => checkInitialJsBudget(bundle, size('initial application') - 1)).toThrow('budget');
    expect(() => checkInitialJsBudget(bundle, size('initial application'))).not.toThrow();
  });

  it('refuses to silently exclude an unmeasured initial external import', () => {
    expect(() => checkInitialJsBudget({ 'entry.js': chunk('app', ['external.js'], true) })).toThrow('Cannot measure');
  });
});
