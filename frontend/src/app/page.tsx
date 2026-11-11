"use client";

import { useEffect, useState } from "react";
import { categoryLabel, loadFacets } from "@/components/Filters";
import LiveCollage from "@/components/LiveCollage";
import ProductGrid from "@/components/ProductGrid";
import { HeroSearch } from "@/components/SearchBar";
import { api, type Product } from "@/lib/api";

export default function HomePage() {
  return (
    <>
      <section className="bg-gradient-to-b from-sand to-paper">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-12 px-4 pt-12 pb-14 sm:px-8 sm:pt-14">
          <div className="min-w-0 flex-[1_1_500px]">
            <span className="inline-flex items-center gap-2 rounded-full bg-surface py-1.5 pr-3.5 pl-2 text-[13px] font-semibold shadow-soft">
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-dark">NEW</span>
              Search by photo, piece by piece
            </span>
            <h1 className="mt-[18px] mb-3 font-display text-[56px] leading-[0.98] font-medium tracking-tight sm:text-[76px]">
              Every piece,
              <br />
              <span className="text-accent italic">found.</span>
            </h1>
            <p className="mb-[26px] max-w-[470px] text-[17px] text-ink-soft">
              Show us an outfit from Pinterest or your gallery. We pick out each garment and find where to buy it from Pakistani brands.
            </p>
            <HeroSearch />
          </div>
          <div className="min-w-0 flex-[1_1_400px]">
            <LiveCollage />
          </div>
        </div>
      </section>
      <Trending />
    </>
  );
}

function Trending() {
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  // Results remember which category they belong to; until they match, we're loading.
  const [data, setData] = useState<{ category: string | null; products: Product[] } | null>(null);
  const loading = data?.category !== category;
  const products = loading ? [] : data.products;

  useEffect(() => {
    loadFacets().then((f) => setCategories(f.categories.slice(0, 4).map((c) => c.id))).catch(() => {});
  }, []);
  useEffect(() => {
    let alive = true;
    api.latest(category ?? undefined, 8)
      .then((r) => alive && setData({ category, products: r.results }))
      .catch(() => alive && setData({ category, products: [] }));
    return () => {
      alive = false;
    };
  }, [category]);

  if (!loading && products.length === 0 && category === null) return null; // empty catalogue

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-[13px] font-semibold transition ${active ? "bg-ink text-white" : "bg-chip hover:bg-[#e8e2d8]"}`;

  return (
    <section className="mx-auto max-w-[1200px] px-4 pt-9 pb-[72px] sm:px-8">
      <div className="mb-[22px] flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-[40px] leading-none font-semibold">Trending this week</h2>
        <div className="flex flex-wrap gap-2">
          <button className={chip(category === null)} onClick={() => setCategory(null)}>All</button>
          {categories.map((c) => (
            <button key={c} className={chip(category === c)} onClick={() => setCategory(c)}>
              {categoryLabel(c)}
            </button>
          ))}
        </div>
      </div>
      <ProductGrid products={products.slice(0, 8)} source="search" loading={loading} variant="wide" />
    </section>
  );
}
