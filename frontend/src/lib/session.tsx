"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken, UNAUTHORIZED_EVENT, type GuestQuota, type PublicConfig, type User } from "./api";

type Session = {
  user: User | null;
  /** False until we know whether a stored token is still valid. */
  ready: boolean;
  config: PublicConfig | null;
  signIn: (token: string, user: User) => void;
  signOut: () => void;

  /** Free searches left for guests; null when signed in (unlimited) or not loaded yet. */
  quota: GuestQuota;
  setQuota: (q: GuestQuota) => void;

  savedIds: Set<number>;
  toggleSaved: (productId: number) => Promise<void>;

  /** The "sign in to continue" dialog. */
  prompt: string | null;
  askToSignIn: (message?: string) => void;
  closePrompt: () => void;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [quota, setQuota] = useState<GuestQuota>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [prompt, setPrompt] = useState<string | null>(null);

  const loadSignedIn = useCallback(async () => {
    const { ids } = await api.favoriteIds();
    setSavedIds(new Set(ids));
    setQuota(null);
  }, []);

  useEffect(() => {
    api.config().then(setConfig).catch(() => {});
    (async () => {
      if (getToken()) {
        try {
          setUser(await api.me());
          await loadSignedIn();
          return;
        } catch {
          setToken(null);
        }
      }
      api.quota().then((r) => setQuota(r.guest)).catch(() => {});
    })().finally(() => setReady(true));
  }, [loadSignedIn]);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    setSavedIds(new Set());
    api.quota().then((r) => setQuota(r.guest)).catch(() => {});
  }, []);

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, signOut);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, signOut);
  }, [signOut]);

  const signIn = useCallback((token: string, u: User) => {
    setToken(token);
    setUser(u);
    setPrompt(null);
    loadSignedIn().catch(() => {});
  }, [loadSignedIn]);

  const askToSignIn = useCallback((message?: string) => {
    setPrompt(message ?? "Sign in to save products and keep searching. It's free.");
  }, []);

  const toggleSaved = useCallback(async (productId: number) => {
    if (!user) {
      askToSignIn("Sign in to save products to your collection.");
      return;
    }
    const wasSaved = savedIds.has(productId);
    const next = new Set(savedIds);
    if (wasSaved) next.delete(productId);
    else next.add(productId);
    setSavedIds(next); // optimistic
    try {
      if (wasSaved) await api.removeFavorite(productId);
      else await api.addFavorite(productId);
    } catch {
      setSavedIds(savedIds);
    }
  }, [user, savedIds, askToSignIn]);

  const value = useMemo<Session>(() => ({
    user, ready, config, signIn, signOut, quota, setQuota, savedIds, toggleSaved,
    prompt, askToSignIn, closePrompt: () => setPrompt(null),
  }), [user, ready, config, signIn, signOut, quota, savedIds, toggleSaved, prompt, askToSignIn]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
