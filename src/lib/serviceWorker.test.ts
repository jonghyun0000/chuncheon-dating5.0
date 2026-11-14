// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function worker() {
  const stores = new Map<string, Map<string, Response>>();
  const events: Record<string, (event: any) => void> = {};
  const urlOf = (key: string | Request) => new URL(typeof key === 'string' ? key : key.url, 'https://example.test').href;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        keys: async () => [...store.keys()].map(url => new Request(url)),
        match: async (key: string | Request) => store.get(urlOf(key))?.clone(),
        put: async (key: string | Request, response: Response) => { store.set(urlOf(key), response.clone()); },
        delete: async (key: string | Request) => store.delete(urlOf(key)),
      };
    },
  };
  const fetch = vi.fn(async () => new Response('<!doctype html>fallback', { headers: { 'content-type': 'text/html' } }));
  runInNewContext(readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8'), {
    self: { location: { origin: 'https://example.test' }, addEventListener: (name: string, callback: any) => {events[name] = callback;}, clients: {claim: async () => undefined} },
    caches, fetch, URL, Response, Promise,
  });
  const request = async (path: string) => {
    let result: Promise<Response> | undefined;
    const background: Promise<unknown>[] = [];
    events.fetch({ request: new Request('https://example.test'+path), respondWith: (r: Promise<Response>) => {result = r;}, waitUntil: (r: Promise<unknown>) => background.push(r) });
    const response = await result;
    await Promise.all(background);
    return response!;
  };
  return { caches, events, fetch, request };
}

describe('installed worker migration', () => {
  it('purges poisoned JavaScript but retains valid chunks, HTML shell and unrelated caches', async () => {
    const w=worker(); const c=await w.caches.open('ccg-v1');
    await c.put('/assets/bad.js',new Response('<html>',{headers:{'content-type':'text/html'}}));
    await c.put('/assets/old.js',new Response('export {}',{headers:{'content-type':'text/javascript'}}));
    await c.put('/index.html',new Response('<html>',{headers:{'content-type':'text/html'}}));
    await w.caches.open('unrelated-cache');
    let finished: Promise<unknown> | undefined;
    w.events.activate({waitUntil:(promise:Promise<unknown>)=>{finished=promise;}});await finished;
    expect(await c.match('/assets/bad.js')).toBeUndefined();
    expect(await c.match('/assets/old.js')).toBeDefined();
    expect(await c.match('/index.html')).toBeDefined();
    expect(await w.caches.keys()).toContain('unrelated-cache');
  });
  it('does not return or store an HTML fallback as a module', async () => {
    const w=worker();const r=await w.request('/assets/missing.js');
    expect(r.status).toBe(404);
    expect(r.headers.get('content-type')).toBe('text/plain');
    expect(await(await w.caches.open('ccg-v1')).match('/assets/missing.js')).toBeUndefined();
  });
  it('serves a valid cached old module when its deployed file has disappeared', async () => {
    const w=worker();const c=await w.caches.open('ccg-v1');
    await c.put('/assets/old.js',new Response('export const cached = true',{headers:{'content-type':'text/javascript'}}));
    expect(await(await w.request('/assets/old.js')).text()).toBe('export const cached = true');
    expect((await c.match('/assets/old.js'))?.headers.get('content-type')).toBe('text/javascript');
  });
});
