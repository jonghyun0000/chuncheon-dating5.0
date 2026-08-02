import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, withTimeout } from '@/lib/supabaseClient';
import type { Profile } from '@/types/database.types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const initRef = useRef(false);

  const fetchProfile = useCallback(async (uid: string) => {
    const result = await withTimeout(
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      5000,
      { data: null, error: null } as any,
      'fetchProfile'
    );
    if (result?.error) {
      console.warn('[auth] profile fetch error:', result.error.message);
      setProfile(null);
      return;
    }
    setProfile((result?.data as Profile) ?? null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user.id) {
      setProfile(null);
      return;
    }
    await fetchProfile(session.user.id);
  }, [session?.user.id, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (!mounted) return;
      console.log('[auth] event:', event);

      setSession(sess);

      if (sess?.user.id) {
        await fetchProfile(sess.user.id);
      } else {
        setProfile(null);
      }

      if (event === 'TOKEN_REFRESHED' && !sess) {
        console.warn('[auth] token refresh failed, signing out');
        try { localStorage.removeItem('cc-gating-auth'); } catch {}
      }

      initRef.current = true;
      setLoading(false);
    });

    // 안전장치: INITIAL_SESSION이 4초 안에 안 와도 화면 띄우기
    const safetyTimer = setTimeout(() => {
      if (mounted && !initRef.current) {
        console.warn('[auth] safety timeout: forcing loading=false');
        setLoading(false);
      }
    }, 4000);

    // 탭 전환 후 돌아왔을 때 lock 풀기 시도
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && initRef.current) {
        // 새 세션 가져오기 시도 (실패해도 lock은 풀림)
        void withTimeout(
          supabase.auth.getSession(),
          2000,
          { data: { session: null }, error: null } as any,
          'getSession-visibility'
        );
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      sub.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[auth] signOut error:', e);
    }
    setSession(null);
    setProfile(null);
    try { localStorage.removeItem('cc-gating-auth'); } catch {}
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}