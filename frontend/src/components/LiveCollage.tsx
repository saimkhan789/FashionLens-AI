"use client";

import { useEffect, useState } from "react";

const PHOTOS = [1, 2, 3, 4, 5, 6].map((n) => `/hero/outfit${n}.jpg`);
const SHUFFLE_MS = 2800;

/** Five floating tiles showing five of six outfit photos; every few seconds they all move one place. */
export default function LiveCollage() {
  const [shift, setShift] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setShift((s) => (s + 1) % PHOTOS.length), SHUFFLE_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="grid grid-cols-3 grid-rows-[180px_180px] gap-3 sm:grid-rows-[230px_230px] sm:gap-3.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const src = PHOTOS[(i + shift) % PHOTOS.length];
        return (
          <div
            key={i}
            className={`float-tile relative overflow-hidden rounded-2xl bg-[#ece4da] shadow-card transition-transform hover:!-translate-y-1.5 ${i === 0 ? "row-span-2" : ""}`}
            style={{ animation: `float ${3 + i * 0.4}s ease-in-out ${i * 0.3}s infinite` }}
          >
            {/* key={src} remounts the image so each swap fades in */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={src} src={src} alt="" className="size-full object-cover" style={{ animation: "fade-in 0.8s ease" }} />
          </div>
        );
      })}
    </div>
  );
}
