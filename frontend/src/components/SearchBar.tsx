"use client";

import { useEffect, useRef, useState } from "react";
import { looksLikeUrl } from "@/lib/api";
import { useSession } from "@/lib/session";

type Props = {
  initialQuery?: string;
  onText: (q: string) => void;
  /** A File (upload, paste or drop) or an image or page link. */
  onImage: (image: File | string) => void;
  size?: "lg" | "md";
  autoFocus?: boolean;
  busy?: boolean;
  /** Show the guest free-search line under the box. */
  showQuota?: boolean;
};

function imageFrom(items: DataTransferItemList | null | undefined): File | null {
  for (const item of Array.from(items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}

/**
 * One box for every kind of query: type a description, paste a link (an image or a
 * Pinterest pin), paste or drop a photo anywhere on the page, or upload one.
 */
export default function SearchBar({ initialQuery = "", onText, onImage, size = "md", autoFocus, busy, showQuota = true }: Props) {
  const [value, setValue] = useState(initialQuery);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { quota } = useSession();

  useEffect(() => setValue(initialQuery), [initialQuery]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = imageFrom(e.clipboardData?.items);
      if (file) {
        e.preventDefault();
        onImage(file);
      }
    };
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => { if (hasFiles(e)) { depth++; setDragging(true); } };
    const onLeave = (e: DragEvent) => { if (hasFiles(e) && --depth <= 0) { depth = 0; setDragging(false); } };
    const onOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) onImage(file);
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [onImage]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q || busy) return;
    if (looksLikeUrl(q)) onImage(q);
    else onText(q);
  };

  const lg = size === "lg";
  return (
    <div>
      <form
        onSubmit={submit}
        className={`flex items-stretch rounded-[2px] border bg-surface ${lg ? "h-[60px] border-ink" : "h-11 border-line-strong focus-within:border-ink"}`}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={lg ? "Describe it, or paste a Pinterest link" : "Search again"}
          autoFocus={autoFocus}
          aria-label="Describe what you're looking for, or paste a link"
          className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted ${lg ? "px-5 text-[17px]" : "px-3.5 text-sm"}`}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`shrink-0 border-l border-line hover:text-accent-dark ${lg ? "px-5 text-sm" : "px-3.5 text-[13px]"}`}
        >
          Upload photo
        </button>
        <button
          type="submit"
          disabled={busy}
          className={`shrink-0 bg-ink font-medium text-paper hover:bg-accent-dark disabled:opacity-60 ${lg ? "px-8" : "px-4 text-sm"}`}
        >
          {busy ? "Searching" : "Search"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImage(f);
            e.target.value = "";
          }}
        />
      </form>
      {lg && (
        <p className="mt-3 text-[13px] text-muted">
          You can also paste an image or drop one anywhere on the page.
          {showQuota && quota && <> {quotaText(quota)}</>}
        </p>
      )}
      {!lg && showQuota && quota && <p className="mt-2 text-xs text-muted">{quotaText(quota)}</p>}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-paper/95">
          <div className="border border-ink px-16 py-12 text-center">
            <p className="font-display text-3xl">Drop the photo to search</p>
            <p className="mt-2 text-sm text-muted">We&apos;ll find each piece in it</p>
          </div>
        </div>
      )}
    </div>
  );
}

function quotaText(q: { text_left: number; image_left: number }) {
  if (q.text_left <= 0 && q.image_left <= 0) return "You've used your free searches. Sign in to keep going, it's free.";
  const t = `${q.text_left} free ${q.text_left === 1 ? "search" : "searches"}`;
  const i = `${q.image_left} photo ${q.image_left === 1 ? "search" : "searches"}`;
  return `${t} and ${i} left, then sign in for unlimited.`;
}
