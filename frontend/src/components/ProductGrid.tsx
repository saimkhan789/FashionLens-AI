"use client";

import { useEffect, useRef } from "react";
import type { Product } from "@/lib/api";
import ProductCard from "./ProductCard";

type Props = {
  products: Product[];
  source: "search" | "image" | "similar" | "saved";
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  empty?: React.ReactNode;
  /** Wider cards (home page row) vs the denser results grid. */
  variant?: "results" | "wide";
};

export function SkeletonCard() {
  return (
    <div aria-hidden>
      <div className="skeleton aspect-[3/4] rounded-2xl" />
      <div className="skeleton mt-3 h-2.5 w-16 rounded" />
      <div className="skeleton mt-2 h-3.5 w-4/5 rounded" />
      <div className="skeleton mt-2 h-3.5 w-20 rounded" />
    </div>
  );
}

const GRIDS = {
  results: "grid grid-cols-2 gap-x-[18px] gap-y-[26px] sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]",
  wide: "grid grid-cols-2 gap-x-5 gap-y-[26px] sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]",
};

/** Results grid that loads the next page when its end scrolls into view. */
export default function ProductGrid({ products, source, loading, hasMore, onLoadMore, empty, variant = "results" }: Props) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading || !onLoadMore) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && onLoadMore(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (!loading && products.length === 0) return <>{empty}</>;

  return (
    <>
      <div className={GRIDS[variant]}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} source={source} aspect={variant === "wide" ? "4/5" : "3/4"} />
        ))}
        {loading && Array.from({ length: products.length ? 4 : 8 }, (_, i) => <SkeletonCard key={`s${i}`} />)}
      </div>
      <div ref={sentinel} />
      {!loading && !hasMore && products.length > 0 && variant === "results" && (
        <p className="mt-12 text-center text-[13px] text-muted">That&apos;s everything that matches.</p>
      )}
    </>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-line bg-surface px-6 py-14 text-center shadow-soft">
      <p className="font-display text-3xl font-semibold">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{children}</div>}
    </div>
  );
}
