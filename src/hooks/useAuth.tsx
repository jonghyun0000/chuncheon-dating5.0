import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import type { Profile } from '@/types/database.types';

export type AuthError = 'session' | 'profile' | 'missing-profile' | null;
interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: AuthError;
  refreshProfile: () => Promise<void>;
  retrySession: () => Promise<void>;
  signOut: () => Promise<void>;
}
interface ProfileState {
  uid: string | null;
  profile: Profile | null;
  loading: boolean;
  error: AuthError;
}
const EMPTY_PROFILE: ProfileState = { uid: null, profile: null, loading: false, error: null };
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_TIMEOUT_MS = 8000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [profileState, setProfileState] = useState<ProfileState>(EMPTY_PROFILE);
  const sessionRef = useRef<Session | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const profileAbort = useRef<AbortController | null>(null);
  const sessionAttempt = useRef(0);

  const fetchProfile = useCallback(async (uid: string) => {
    const request = ++generation.current;
    profileAbort.current?.abort();
    const controller = new AbortController();
    profileAbort.current = controller;
    setProfileState((old) => ({
      uid, profile: old.uid === uid ? old.profile : null, loading: true,
      error: old.uid === uid ? old.error : null,
    }));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        Promise.resolve(supabase.from('profiles').select('*').eq('id', uid).abortSignal(controller.signal).maybeSingle()),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Profile request timed out'));
          }, AUTH_TIMEOUT_MS);
        }),
      ]);
      if (!mounted.current || request !== generation.current || sessionRef.current?.user.id !== uid) return;
      if (result.error) throw result.error;
      setProfileState({ uid, profile: result.data as Profile | null, loading: false, error: result.data ? null : 'missing-profile' });
    } catch {
      if (!mounted.current || request !== generation.current || sessionRef.current?.user.id !== uid) return;
      // A failed query is not an absent account. Keep the last profile for display,
      // but gates block protected content until a successful retry.
      setProfileState((old) => ({ ...old, uid, loading: false, error: 'profile' }));
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const uid = sessionRef.current?.user.id;
    if (uid) await fetchProfile(uid);
  }, [fetchProfile]);

  const retrySession = useCallback(async () => {
    const attempt = ++sessionAttempt.current;
    setInitialized(false);
    setSessionError(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        supabase.auth.getSession(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Session request timed out')), AUTH_TIMEOUT_MS);
        }),
      ]);
      if (!mounted.current || attempt !== sessionAttempt.current) return;
      if (result.error) throw result.error;
      sessionRef.current = result.data.session;
      setSession(result.data.session);
      setInitialized(true);
      if (result.data.session) await fetchProfile(result.data.session.user.id);
    } catch {
      if (mounted.current && attempt === sessionAttempt.current) {
        setSessionError(true);
        setInitialized(true);
      }
    } finally {
      clearTimeout(timer);
    }
  }, [fetchProfile]);

  useEffect(() => {
    mounted.current = true;
    let receivedEvent = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // This callback runs inside Supabase's auth lock. Never await or start a
      // Supabase query here; the separate effect below runs after it returns.
      receivedEvent = true;
      sessionAttempt.current += 1;
      generation.current += 1;
      profileAbort.current?.abort();
      sessionRef.current = nextSession;
      setSession(nextSession ? { ...nextSession } : null);
      setSessionError(false);
      setInitialized(true);
      if (!nextSession) setProfileState(EMPTY_PROFILE);
    });
    const timer = setTimeout(() => {
      if (!receivedEvent) {
        setSessionError(true);
        setInitialized(true);
      }
    }, AUTH_TIMEOUT_MS);
    return () => {
      mounted.current = false;
      generation.current += 1;
      sessionAttempt.current += 1;
      profileAbort.current?.abort();
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    void fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  // Refresh moderation/verification state on returning to the app, outside the
  // authentication callback. Existing sessions and storage keys are preserved.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && sessionRef.current) void refreshProfile();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    generation.current += 1;
    profileAbort.current?.abort();
    try {
      await supabase.auth.signOut();
    } catch {
      // A network failure must not keep this browser visibly signed in.
    } finally {
      sessionRef.current = null;
      setSession(null);
      setProfileState(EMPTY_PROFILE);
      setSessionError(false);
      setInitialized(true);
      try { localStorage.removeItem('cc-gating-auth'); } catch { /* Storage can be disabled. */ }
    }
  }, []);

  const sameUser = profileState.uid === session?.user.id;
  const profile = sameUser ? profileState.profile : null;
  const loading = !initialized || (!sessionError && !!session && (!sameUser || (profileState.loading && !profile)));
  const error: AuthError = sessionError ? 'session' : sameUser ? profileState.error : null;

  return (
    <AuthContext.Provider value={{ session, profile, loading, error, refreshProfile, retrySession, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
