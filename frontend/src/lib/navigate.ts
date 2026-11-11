"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { setPendingImage } from "./pending";

/**
 * Every search box sends people to /search:
 *   text   -> /search?q=...
 *   link   -> /search?img=<url>      (shareable)
 *   upload -> /search?photo=<stamp>  (the File waits in pending.ts; the stamp makes each upload a new URL)
 */
export function useSearchNavigation() {
  const router = useRouter();
  const searchText = useCallback((q: string) => router.push(`/search?q=${encodeURIComponent(q)}`), [router]);
  const searchImage = useCallback(
    (image: File | string) => {
      if (typeof image === "string") {
        router.push(`/search?img=${encodeURIComponent(image)}`);
      } else {
        router.push(`/search?photo=${setPendingImage(image)}`);
      }
    },
    [router],
  );
  return { searchText, searchImage };
}
