"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPrice, goUrl, type Product } from "@/lib/api";
import { useSession } from "@/lib/session";
import SaveGlyph from "./SaveGlyph";

type Props = { product: Product; source: "search" | "image" | "similar" | "saved" };

/** The whole card opens the product on the brand's own shop (through /api/go for click stats). */
export default function ProductCard({ product: p, source }: Props) {
  const { savedIds, toggleSaved } = useSession();
  const [broken, setBroken] = useState(false);
  const saved = savedIds.has(p.id);
  const onSale = p.compare_at_price != null && p.price != null && p.compare_at_price > p.price;
  const soldOut = p.available === false;

  return (
    <article className="group relative">
      <a href={goUrl(p.id, source)} target="_blank" rel="noopener" className="block no-underline" title={`View on ${p.brand}`}>
        <div className="relative aspect-[3/4] overflow-hidden rounded-[2px] bg-[#ece9e3]">
          {!broken ? (
            // Brand CDNs serve their own sizes; next/image optimisation is off in the static export.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.image_url}
              alt={p.title}
              loading="lazy"
              onError={() => setBroken(true)}
              className={`size-full object-cover transition-opacity duration-300 group-hover:opacity-90 ${soldOut ? "opacity-50" : ""}`}
            />
          ) : (
            <div className="grid size-full place-items-center text-xs text-muted">Image unavailable</div>
          )}
          {(onSale || soldOut) && (
            <span
              className={`absolute top-2 left-2 px-2 py-px text-[11px] tracking-[0.06em] text-white uppercase ${soldOut ? "bg-ink" : "bg-accent"}`}
            >
              {soldOut ? "Sold out" : "Sale"}
            </span>
          )}
        </div>
        <p className="mt-3 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">{p.brand}</p>
        <h3 className="mt-0.5 line-clamp-2 text-[15px] leading-snug">{p.title}</h3>
        <p className="mt-1 text-[15px]">
          <span className={onSale ? "text-accent-dark" : ""}>{formatPrice(p.price)}</span>
          {onSale && <span className="ml-2 text-[13px] text-muted line-through">{formatPrice(p.compare_at_price)}</span>}
        </p>
      </a>

      <button
        onClick={() => toggleSaved(p.id)}
        aria-label={saved ? "Remove from saved" : "Save"}
        aria-pressed={saved}
        className={`absolute top-2 right-2 grid size-11 place-items-center rounded-[2px] border border-line bg-surface transition-colors hover:border-ink ${
          saved ? "text-accent" : "text-ink"
        }`}
      >
        <SaveGlyph filled={saved} />
      </button>
      {source !== "similar" && (
        <Link href={`/similar?id=${p.id}`} className="mt-1.5 inline-block text-[13px] text-ink-soft hover:text-accent-dark">
          More like this
        </Link>
      )}
    </article>
  );
}
