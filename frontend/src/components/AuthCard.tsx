"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { api, type User } from "@/lib/api";
import { useSession } from "@/lib/session";
import GoogleButton, { OrDivider } from "./GoogleButton";

const input =
  "h-12 w-full rounded-xl border border-[#e0dad1] bg-surface px-4 outline-none transition placeholder:text-muted focus:border-ink-soft focus:shadow-soft";

/** Only follow relative "next" links back into the app. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") && !next.startsWith("/register") ? next : "/";
}

export default function AuthCard({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { signIn, config } = useSession();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = useCallback(() => router.push(next), [router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r: { access_token: string; user: User } =
        mode === "login" ? await api.login(email, password) : await api.register(username, email, password);
      signIn(r.access_token, r.user);
      done();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const isLogin = mode === "login";
  const other = `${isLogin ? "/register" : "/login"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="bg-gradient-to-b from-sand to-paper px-4 py-14">
      <div className="mx-auto w-full max-w-[440px] rounded-[28px] border border-[#efebe4] bg-paper p-8 shadow-panel sm:p-10">
        <h1 className="text-center font-display text-[40px] leading-[1.05] font-semibold">
          {isLogin ? <>Welcome <span className="text-accent italic">back.</span></> : <>Join <span className="text-accent italic">free.</span></>}
        </h1>
        <p className="mt-2 text-center text-sm text-ink-soft">
          {isLogin ? "Sign in for unlimited searches and your saved pieces." : "Unlimited searches, saved pieces and your history."}
        </p>

        <div className="mt-7">
          <GoogleButton onDone={done} />
          {config?.google_client_id && <OrDivider />}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {!isLogin && (
            <label className="block">
              <span className="mb-1 block text-[13px] font-semibold">Name</span>
              <input className={input} value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={80} autoComplete="name" />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold">Email</span>
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold">Password</span>
            <input
              className={input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isLogin ? undefined : 6}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
            {!isLogin && <span className="mt-1 block text-xs text-muted">At least 6 characters</span>}
          </label>
          {error && <p className="rounded-xl bg-accent-soft px-4 py-2.5 text-sm text-accent-dark" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-2 h-12 rounded-full bg-accent font-semibold text-white shadow-accent transition hover:bg-accent-dark disabled:opacity-60"
          >
            {busy ? "One moment" : isLogin ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-soft">
          {isLogin ? "New here? " : "Already have an account? "}
          <Link href={other} className="font-semibold text-ink underline underline-offset-[3px] hover:text-accent-dark">
            {isLogin ? "Create an account" : "Sign in"}
          </Link>
        </p>
      </div>
    </div>
  );
}
