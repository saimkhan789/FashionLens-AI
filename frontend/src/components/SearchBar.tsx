"use client";

import { useCallback, useRef, useState } from "react";
import { looksLikeUrl, type GuestQuota } from "@/lib/api";
import { useSearchNavigation } from "@/lib/navigate";
import { useSession } from "@/lib/session";
import { DropOverlay, usePhotoDrop } from "@/lib/usePhotoDrop";
import { CameraIcon, SearchIcon } from "./icons";

function quotaText(q: NonNullable<GuestQuota>): string {
  if (q.text_left <= 0 && q.image_left <= 0) return "You've used your free searches. Sign in free to keep going.";
  const t = `${q.text_left} free ${q.text_left === 1 ? "search" : "searches"}`;
  const i = `${q.image_left} photo ${q.image_left === 1 ? "search" : "searches"}`;
  return `${t} and ${i} left, then sign in free.`;
}

export function QuotaLine({ className = "" }: { className?: string }) {
  const { quota } = useSession();
  if (!quota) return null;
  return <p className={`text-[13px] text-muted ${className}`}>{quotaText(quota)}</p>;
}

/** Shared logic: the text box treats a pasted link as a photo search.
 *  (Callers remount the box with a `key` to reset it for a new query.) */
function useQuery(initial: string) {
  const [value, setValue] = useState(initial);
  const { searchText, searchImage } = useSearchNavigation();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    if (looksLikeUrl(q)) searchImage(q);
    else searchText(q);
  };
  return { value, setValue, submit, searchImage };
}

/** Home page: the photo drop zone with a text search under it. */
export function HeroSearch() {
  const { value, setValue, submit, searchImage } = useQuery("");
  const fileRef = useRef<HTMLInputElement>(null);
  const onFile = useCallback((f: File) => searchImage(f), [searchImage]);
  const dragging = usePhotoDrop(onFile);

  return (
    <div>
      <div className="rounded-[26px] bg-gradient-to-br from-[#eee5da] to-[#e2d5c6] p-4 shadow-panel sm:p-[22px]">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group block w-full rounded-[18px] border-2 border-dashed border-[#b3a99c] bg-paper/50 px-5 py-6 text-center backdrop-blur-sm transition hover:border-accent hover:bg-paper/70"
        >
          <span className="inline-grid size-14 place-items-center rounded-2xl bg-accent text-white shadow-accent transition group-hover:scale-105">
            <CameraIcon className="size-6" />
          </span>
          <span className="mt-3 block font-display text-[26px] leading-tight font-semibold">Drop a photo here</span>
          <span className="mt-0.5 block text-[13px] text-ink-soft">
            or <span className="font-bold underline underline-offset-[3px]">choose from your gallery</span>, or paste a screenshot
          </span>
        </button>
        <form onSubmit={submit} className="mt-3.5 flex h-14 items-center gap-2 rounded-full bg-surface pr-1.5 pl-[18px] shadow-soft">
          <SearchIcon className="size-[18px] shrink-0 text-muted" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Or describe it: mustard lawn suit under 6k"
            aria-label="Describe what you're looking for, or paste a link"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
          />
          <button type="submit" className="h-11 shrink-0 rounded-full bg-ink px-[22px] font-bold text-white transition hover:bg-accent-dark">
            Search
          </button>
        </form>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) searchImage(f);
            e.target.value = "";
          }}
        />
      </div>
      <QuotaLine className="mt-3" />
      {dragging && <DropOverlay />}
    </div>
  );
}

/** Inner pages: a search pill with an orange camera button (lives in the navbar). */
export function CompactSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const { value, setValue, submit, searchImage } = useQuery(initialQuery);
  const fileRef = useRef<HTMLInputElement>(null);
  const onFile = useCallback((f: File) => searchImage(f), [searchImage]);
  const dragging = usePhotoDrop(onFile);

  return (
    <>
      <form
        onSubmit={submit}
        className="flex h-[46px] w-full items-center gap-2 rounded-full border border-[#e6e1d9] bg-surface pr-[5px] pl-4 shadow-soft focus-within:border-ink-soft"
      >
        <SearchIcon className="size-[18px] shrink-0 text-muted" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search again, or drop another photo"
          aria-label="Search again"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Search with a photo"
          title="Search with a photo"
          className="grid h-9 w-11 shrink-0 place-items-center rounded-full bg-accent text-white shadow-accent transition hover:bg-accent-dark"
        >
          <CameraIcon className="size-[17px]" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) searchImage(f);
            e.target.value = "";
          }}
        />
      </form>
      {dragging && <DropOverlay />}
    </>
  );
}
