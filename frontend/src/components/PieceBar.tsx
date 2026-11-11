"use client";

import type { DetectedItem } from "@/lib/api";

type Props = {
  imageSrc: string | null;
  items: DetectedItem[];
  selected: number;
  onSelect: (i: number) => void;
};

/** The band above photo results: your photo with the chosen piece boxed, and one tab per piece. */
export default function PieceBar({ imageSrc, items, selected, onSelect }: Props) {
  const box = items[selected]?.box;
  const pieces = items.filter((it) => it.box).length;

  return (
    <div className="border-b border-line bg-gradient-to-b from-sand to-[#f7f3ee]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-[18px] px-4 py-[18px] sm:px-8">
        {imageSrc && (
          <div className="relative h-28 w-[84px] shrink-0 overflow-hidden rounded-xl bg-[#ece4da] shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc} alt="Your photo" className="size-full object-cover" />
            {box && (
              <div
                className="absolute rounded-[5px] border-2 border-accent shadow-[0_0_0_999px_rgba(26,26,26,0.14)] transition-all duration-300"
                style={{ left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${(box[2] - box[0]) * 100}%`, height: `${(box[3] - box[1]) * 100}%` }}
              />
            )}
          </div>
        )}
        <div className="min-w-0">
          <p className="mb-2 text-[13px] text-ink-soft">
            {pieces > 0 ? (
              <>
                We found <strong className="text-ink">{pieces} {pieces === 1 ? "piece" : "pieces"}</strong> in your photo. Pick one to see matches.
              </>
            ) : (
              "We couldn't pick out separate pieces, so here are matches for the whole look."
            )}
          </p>
          <div className="flex flex-wrap gap-2" role="tablist">
            {items.map((it, i) => {
              const count = it.has_more ? `${it.results.length}+` : `${it.results.length}`;
              const active = i === selected;
              return (
                <button
                  key={`${it.label}-${i}`}
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSelect(i)}
                  className={`rounded-full px-3.5 py-[7px] text-[13px] transition ${
                    active ? "bg-accent font-semibold text-white shadow-accent" : "border border-line-strong bg-surface font-medium hover:border-ink-soft"
                  }`}
                >
                  {it.label}
                  {it.box && <span className={active ? "text-white/85" : "text-muted"}> · {count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
