import { gzipSync } from 'node:zlib';

export const INITIAL_JS_BUDGET = 180 * 1024;

/** Count each initial JS response once, including shared static imports, never lazy routes. */
export function checkInitialJsBudget(bundle, limit = INITIAL_JS_BUDGET) {
  const visited = new Set();
  const entries = Object.keys(bundle).filter((name) => {
    const chunk = bundle[name];
    return chunk.type === 'chunk' && chunk.isEntry;
  });
  let gzipBytes = 0;
  const visit = (name) => {
    if (visited.has(name)) return;
    visited.add(name);
    const chunk = bundle[name];
    if (!chunk) throw new Error(`Cannot measure initial JavaScript import: ${name}`);
    if (chunk.type !== 'chunk') return;
    gzipBytes += gzipSync(chunk.code).byteLength;
    chunk.imports.forEach(visit);
  };
  entries.forEach(visit);
  if (gzipBytes > limit) {
    throw new Error(`Initial JavaScript is ${(gzipBytes / 1024).toFixed(1)} KiB gzip; budget is ${(limit / 1024).toFixed(1)} KiB. Split unused routes or language dictionaries before release.`);
  }
  return { gzipBytes, files: Array.from(visited).sort() };
}
