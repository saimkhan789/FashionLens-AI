"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FilterSidebar, SortSelect } from "@/components/Filters";
import { SparkIcon } from "@/components/icons";
import ProductGrid, { EmptyState } from "@/components/ProductGrid";
import { api, EMPTY_FILTERS, formatPrice, goUrl, type Filters, type Product } from "@/lib/api";

export default function SimilarPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <SimilarView />
    </Suspense>
  );
}

function SimilarView() {
  const id = Number(useSearchParams().get("id"));
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [product, setProduct] = useState<Product | null>(null);
  // Results remember the product and filters they were fetched for; until they match, we're loading.
  const [page, setPage] = useState<{ key: string; results: Product[]; hasMore: boolean } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = `${id}|${JSON.stringify(filters)}`;
  const current = page?.key === key ? page : null;
  const results = current?.results ?? [];
  const loading = !current || loadingMore;

  useEffect(() => {
    if (!id) return;
    let alive = true;
    api.similar(id, filters, 0)
      .then((r) => {
        if (!alive) return;
        setProduct(r.product);
        setPage({ key, results: r.results, hasMore: r.has_more });
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        setPage({ key, results: [], hasMore: false });
        setError(e instanceof Error ? e.message : "Something went wrong");
      });
    return () => {
      alive = false;
    };
  }, [id, filters, key]);

  const loadMore = async () => {
    if (!current || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await api.similar(id, filters, current.results.length);
      setPage((p) => (p && p.key === key ? { ...p, results: [...p.results, ...r.results], hasMore: r.has_more } : p));
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  };

  if (!id) return <div className="mx-auto max-w-xl px-4 py-16"><EmptyState title="No product chosen" /></div>;

  return (
    <>
      {product && (
        <div className="border-b border-line bg-gradient-to-b from-sand to-[#f7f3ee]">
          <div className="mx-auto flex max-w-[1280px] items-center gap-[18px] px-4 py-[18px] sm:px-8">
            <a href={goUrl(product.id, "similar")} target="_blank" rel="noopener" className="h-28 w-[84px] shrink-0 overflow-hidden rounded-xl bg-[#ece4da] shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.image_url} alt={product.title} className="size-full object-cover" />
            </a>
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft"><SparkIcon /> More like this</p>
              <p className="mt-0.5 text-[11px] font-bold tracking-[0.08em] text-accent-dark uppercase">{product.brand}</p>
              <p className="truncate font-medium">{product.title}</p>
              <p className="text-sm font-bold">{formatPrice(product.price)}</p>
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 pt-[26px] pb-16 sm:px-8 md:flex-row md:gap-8">
        <FilterSidebar value={filters} onChange={setFilters} />
        <section className="min-w-0 flex-1">
          <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-[36px] leading-[1.1] font-semibold">
              Similar <span className="text-accent italic">pieces</span>
            </h1>
            <SortSelect value={filters.sort} onChange={(sort) => setFilters({ ...filters, sort })} />
          </div>
          {error && results.length === 0 ? (
            <EmptyState title="That didn't work">{error}</EmptyState>
          ) : (
            <ProductGrid
              products={results}
              source="similar"
              loading={loading}
              hasMore={!!current?.hasMore}
              onLoadMore={loadMore}
              empty={<EmptyState title="Nothing similar yet">Try clearing some filters.</EmptyState>}
            />
          )}
        </section>
      </div>
    </>
  );
}
