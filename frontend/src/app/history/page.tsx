"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CameraIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { EmptyState } from "@/components/ProductGrid";
import { api, type HistoryEntry } from "@/lib/api";
import { useSession } from "@/lib/session";

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

export default function HistoryPage() {
  const { user, ready, askToSignIn } = useSession();
  const [loaded, setLoaded] = useState<HistoryEntry[] | null>(null);
  const loading = !ready || (!!user && loaded === null);
  const entries = loaded ?? [];
  const setEntries = setLoaded;

  useEffect(() => {
    if (!ready || !user) return;
    api.history().then((r) => setLoaded(r.history)).catch(() => setLoaded([]));
  }, [ready, user]);

  const clear = async () => {
    if (!confirm("Clear your whole search history?")) return;
    await api.clearHistory();
    setEntries([]);
  };

  return (
    <div className="mx-auto max-w-[860px] px-4 pt-10 pb-16 sm:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[44px] leading-none font-semibold">
            Your <span className="text-accent italic">searches</span>
          </h1>
          <p className="mt-2 text-ink-soft">Pick up where you left off.</p>
        </div>
        {entries.length > 0 && (
          <button onClick={clear} className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-medium hover:border-ink-soft">
            <TrashIcon /> Clear history
          </button>
        )}
      </div>

      {ready && !user ? (
        <EmptyState title="Sign in to keep a history">
          <button onClick={() => askToSignIn("Sign in to keep your searches and come back to them later.")} className="mt-4 rounded-full bg-accent px-6 py-2.5 font-semibold text-white shadow-accent hover:bg-accent-dark">
            Sign in free
          </button>
        </EmptyState>
      ) : loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[72px] rounded-2xl" />)}</div>
      ) : entries.length === 0 ? (
        <EmptyState title="No searches yet">
          <Link href="/search" className="mt-4 inline-block rounded-full bg-ink px-6 py-2.5 font-semibold text-white hover:bg-accent-dark">Start searching</Link>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {entries.map((h) => {
            const isLink = h.query_type === "image" && h.query.startsWith("http");
            const href = h.query_type === "text" ? `/search?q=${encodeURIComponent(h.query)}` : isLink ? `/search?img=${encodeURIComponent(h.query)}` : null;
            const body = (
              <>
                <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${h.query_type === "image" ? "bg-accent text-white shadow-accent" : "bg-chip text-ink"}`}>
                  {h.query_type === "image" ? <CameraIcon /> : <SearchIcon />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {h.query_type === "text" ? h.query : isLink ? "Photo from a link" : "Uploaded photo"}
                  </span>
                  <span className="block truncate text-[13px] text-muted">
                    {isLink ? `${h.query} · ` : ""}{h.result_count} results · {when(h.created_at)}
                  </span>
                </span>
                {href && <span className="text-sm font-semibold text-accent-dark">Search again</span>}
              </>
            );
            return (
              <li key={h.id}>
                {href ? (
                  <Link href={href} className="flex items-center gap-4 rounded-2xl border border-[#efebe4] bg-surface p-3.5 shadow-soft transition hover:-translate-y-0.5">{body}</Link>
                ) : (
                  <div className="flex items-center gap-4 rounded-2xl border border-[#efebe4] bg-surface p-3.5 shadow-soft">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
