"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";

type GoogleId = {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let scriptLoading: Promise<void> | null = null;
function loadGoogleScript(): Promise<void> {
  scriptLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptLoading = null;
      reject(new Error("Google sign-in couldn't load"));
    };
    document.head.appendChild(s);
  });
  return scriptLoading;
}

/** "Continue with Google". Renders nothing until GOOGLE_CLIENT_ID is configured on the server. */
export default function GoogleButton({ onDone }: { onDone?: () => void }) {
  const { config, signIn } = useSession();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const clientId = config?.google_client_id;

  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            try {
              const r = await api.google(credential);
              signIn(r.access_token, r.user);
              onDone?.();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Google sign-in failed");
            }
          },
        });
        window.google.accounts.id.renderButton(ref.current, {
          theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 320,
        });
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [clientId, signIn, onDone]);

  if (!clientId) return null;
  return (
    <div>
      <div ref={ref} className="flex min-h-[44px] justify-center" />
      {error && <p className="mt-2 text-center text-xs text-accent-dark">{error}</p>}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
    </div>
  );
}
