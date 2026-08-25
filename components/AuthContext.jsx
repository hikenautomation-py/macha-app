'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [supabase] = useState(() => createBrowserClient());
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  useEffect(() => {
    if (session?.user) {
      supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data }) => setProfile(data));
    } else {
      setProfile(null);
    }
  }, [session, supabase]);

  const signIn = useCallback((email, password) => supabase.auth.signInWithPassword({ email, password }), [supabase]);
  const signUp = useCallback(
    (email, password, meta) => supabase.auth.signUp({ email, password, options: { data: meta } }),
    [supabase]
  );
  const signOut = useCallback(() => supabase.auth.signOut(), [supabase]);

  return (
    <AuthContext.Provider
      value={{ supabase, session, user: session?.user || null, profile, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
