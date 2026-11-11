"use client";

import { useEffect, useState } from "react";
import { CameraIcon } from "@/components/icons";

function imageFrom(items: DataTransferItemList | null | undefined): File | null {
  for (const item of Array.from(items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}

/** Paste an image or drop one anywhere on the page. Returns whether a file is being dragged over. */
export function usePhotoDrop(onImage: (file: File) => void): boolean {
  const [dragging, setDragging] = useState(false);

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

  return dragging;
}

export function DropOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-ink/40 backdrop-blur-sm">
      <div className="rounded-[28px] border-2 border-dashed border-white px-14 py-11 text-center text-white">
        <CameraIcon className="mx-auto mb-3 size-10" />
        <p className="font-display text-3xl font-semibold">Drop your photo to search</p>
        <p className="mt-1 text-sm text-white/85">We&apos;ll find each piece in it</p>
      </div>
    </div>
  );
}
