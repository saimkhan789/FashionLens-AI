"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/session";
import GoogleButton, { OrDivider } from "./GoogleButton";
import { CloseIcon } from "./icons";

/** The "sign in to keep going" dialog: shown when a guest runs out of free searches or tries to save. */
export default function SignInPrompt() {
  const { prompt, closePrompt, config } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    if (!prompt) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePrompt();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prompt, closePrompt]);

  if (!prompt) return null;
  const next = encodeURIComponent(pathname);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm" onClick={closePrompt}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[420px] rounded-[28px] bg-paper p-8 text-center shadow-panel"
      >
        <button onClick={closePrompt} aria-label="Close" className="absolute top-4 right-4 grid size-10 place-items-center rounded-full hover:bg-chip">
          <CloseIcon />
        </button>
        <p className="font-display text-[30px] leading-none font-semibold">
          fashionlens<span className="text-accent">.</span>
        </p>
        <h2 id="signin-title" className="mt-5 font-display text-[34px] leading-[1.05] font-semibold">
          Keep <span className="italic text-accent">finding.</span>
        </h2>
        <p className="mx-auto mt-2 max-w-[300px] text-sm text-ink-soft">{prompt}</p>
        <div className="mt-6">
          <GoogleButton onDone={closePrompt} />
          {config?.google_client_id && <OrDivider />}
          <div className="flex flex-col gap-2.5">
            <Link
              href={`/register?next=${next}`}
              onClick={closePrompt}
              className="rounded-full bg-accent py-3 font-semibold text-white shadow-accent transition hover:bg-accent-dark"
            >
              Create a free account
            </Link>
            <Link href={`/login?next=${next}`} onClick={closePrompt} className="rounded-full border border-line-strong bg-surface py-3 font-medium hover:border-ink-soft">
              I already have an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
