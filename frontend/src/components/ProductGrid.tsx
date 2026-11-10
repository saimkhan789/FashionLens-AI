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
};

export function SkeletonCard() {
  return (
    <div aria-hidden>
      <div className="skeleton aspect-[3/4] rounded-[2px]" />
      <div className="skeleton mt-3 h-2.5 w-16" />
      <div className="skeleton mt-2 h-3.5 w-4/5" />
      <div className="skeleton mt-2 h-3.5 w-20" />
    </div>
  );
}

const GRID = "grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4";

/** Results grid that loads the next page when its end scrolls into view. */
export default function ProductGrid({ products, source, loading, hasMore, onLoadMore, empty }: Props) {
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
      <div className={GRID}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} source={source} />
        ))}
        {loading && Array.from({ length: products.length ? 4 : 8 }, (_, i) => <SkeletonCard key={`s${i}`} />)}
      </div>
      <div ref={sentinel} />
      {!loading && !hasMore && products.length > 0 && (
        <p className="mt-14 border-t border-line pt-5 text-center text-[13px] text-muted">That&apos;s everything that matches.</p>
      )}
    </>
  );
}
