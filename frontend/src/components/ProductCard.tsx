"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPrice, goUrl, type Product } from "@/lib/api";
import { useSession } from "@/lib/session";
import { HeartIcon, SparkIcon } from "./icons";

type Props = {
  product: Product;
  source: "search" | "image" | "similar" | "saved";
  aspect?: "3/4" | "4/5";
};

/** The whole card opens the product on the brand's own shop (through /api/go for click stats). */
export default function ProductCard({ product: p, source, aspect = "3/4" }: Props) {
  const { savedIds, toggleSaved } = useSession();
  const [broken, setBroken] = useState(false);
  const saved = savedIds.has(p.id);
  const onSale = p.compare_at_price != null && p.price != null && p.compare_at_price > p.price;
  const soldOut = p.available === false;

  return (
    <article className="group relative">
      <a href={goUrl(p.id, source)} target="_blank" rel="noopener" className="block" title={`View on ${p.brand}`}>
        <div
          className={`relative overflow-hidden rounded-2xl bg-[#ece4da] shadow-card transition duration-300 group-hover:-translate-y-1 ${
            aspect === "4/5" ? "aspect-[4/5]" : "aspect-[3/4]"
          }`}
        >
          {!broken ? (
            // Brand CDNs serve their own sizes; next/image optimisation is off in the static export.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.image_url}
              alt={p.title}
              loading="lazy"
              onError={() => setBroken(true)}
              className={`size-full object-cover transition duration-500 group-hover:scale-[1.04] ${soldOut ? "opacity-50" : ""}`}
            />
          ) : (
            <div className="grid size-full place-items-center text-xs text-muted">Image unavailable</div>
          )}
          {(onSale || soldOut) && (
            <span className={`absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white ${soldOut ? "bg-ink" : "bg-accent"}`}>
              {soldOut ? "Sold out" : "Sale"}
            </span>
          )}
        </div>
        <p className="mt-2.5 text-[11px] font-bold tracking-[0.08em] text-accent-dark uppercase">{p.brand}</p>
        <h3 className="mt-px line-clamp-2 text-sm leading-snug font-medium">{p.title}</h3>
        <p className="mt-1 text-sm">
          <span className="font-bold">{formatPrice(p.price)}</span>
          {onSale && <span className="ml-2 text-xs text-muted line-through">{formatPrice(p.compare_at_price)}</span>}
        </p>
      </a>

      <button
        onClick={() => toggleSaved(p.id)}
        aria-label={saved ? "Remove from saved" : "Save"}
        aria-pressed={saved}
        className={`absolute top-2.5 right-2.5 grid size-11 place-items-center rounded-full bg-white/75 backdrop-blur-md transition hover:scale-110 ${
          saved ? "text-accent" : "text-ink"
        }`}
      >
        <HeartIcon filled={saved} />
      </button>
      {source !== "similar" && (
        <Link href={`/similar?id=${p.id}`} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-accent-dark">
          <SparkIcon className="size-[13px]" /> Similar
        </Link>
      )}
    </article>
  );
}
