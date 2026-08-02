import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * 브라우저용 Supabase 클라이언트.
 */
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'cc-gating-auth',
    },
  }
);

/**
 * 모든 Supabase 호출에서 사용하는 공통 타임아웃 래퍼.
 * - 응답이 ms 안에 안 오면 fallback 값으로 resolve.
 * - 콜드스타트, 네트워크 불안정, Supabase hang 등에서 화면이 멈추는 것을 방지.
 *
 * 사용 예:
 *   const { data, error } = await withTimeout(
 *     supabase.from('teams').select('*'),
 *     8000,
 *     { data: [], error: { message: 'timeout' } }
 *   );
 */
export function withTimeout<T>(
  p: PromiseLike<T>,
  ms: number,
  fallback: T,
  label = ''
): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        if (label) console.warn(`[supabase] timeout (${label}) after ${ms}ms`);
        resolve(fallback);
      }
    }, ms);
    Promise.resolve(p).then(
      (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } },
      (e) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          if (label) console.warn(`[supabase] error (${label}):`, e);
          resolve(fallback);
        }
      }
    );
  });
}