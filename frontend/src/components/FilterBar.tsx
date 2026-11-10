"use client";

import { useEffect, useState } from "react";
import { api, EMPTY_FILTERS, type Facets, type Filters, type Sort } from "@/lib/api";

let facetsCache: Promise<Facets> | null = null;
export function loadFacets(): Promise<Facets> {
  facetsCache ??= api.facets().catch((e) => {
    facetsCache = null;
    throw e;
  });
  return facetsCache;
}

const PRICE_RANGES: { label: string; min: number | null; max: number | null }[] = [
  { label: "Any price", min: null, max: null },
  { label: "Under Rs 3,000", min: null, max: 3000 },
  { label: "Rs 3,000 to 6,000", min: 3000, max: 6000 },
  { label: "Rs 6,000 to 10,000", min: 6000, max: 10000 },
  { label: "Over Rs 10,000", min: 10000, max: null },
];

const SORTS: { value: Sort; label: string }[] = [
  { value: "relevance", label: "Closest match" },
  { value: "price_asc", label: "Price, low to high" },
  { value: "price_desc", label: "Price, high to low" },
];

const CATEGORY_LABELS: Record<string, string> = {
  kurta: "Kurtas", shirt: "Shirts", top: "Tops", dress: "Dresses", suit: "Suits", trousers: "Trousers",
  dupatta: "Dupattas", shawl: "Shawls", jacket: "Jackets", skirt: "Skirts", jeans: "Jeans", shalwar: "Shalwars",
};
const categoryLabel = (c: string) => CATEGORY_LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1);

const select = "h-[34px] rounded-[2px] border border-line-strong bg-surface px-2 text-sm hover:border-ink focus:border-ink focus:outline-none";

type Props = {
  value: Filters;
  onChange: (f: Filters) => void;
  /** Image searches already scope results to the detected garment. */
  hideCategory?: boolean;
};

export default function FilterBar({ value, onChange, hideCategory }: Props) {
  const [facets, setFacets] = useState<Facets | null>(null);
  useEffect(() => {
    loadFacets().then(setFacets).catch(() => {});
  }, []);

  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  const priceIndex = Math.max(0, PRICE_RANGES.findIndex((r) => r.min === value.min_price && r.max === value.max_price));
  const active = value.brand.length || value.category.length || value.gender || value.min_price != null || value.max_price != null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-b border-t-ink border-b-line py-3.5 text-sm">
      <label className="flex items-center gap-2">
        Brand
        <select
          className={select}
          value={value.brand[0] ?? ""}
          onChange={(e) => set({ brand: e.target.value ? [Number(e.target.value)] : [] })}
        >
          <option value="">All brands</option>
          {facets?.brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </label>
      {!hideCategory && (
        <label className="flex items-center gap-2">
          Type
          <select
            className={select}
            value={value.category[0] ?? ""}
            onChange={(e) => set({ category: e.target.value ? [e.target.value] : [] })}
          >
            <option value="">Everything</option>
            {facets?.categories.map((c) => (
              <option key={c.id} value={c.id}>{categoryLabel(c.id)}</option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center gap-2">
        For
        <select className={select} value={value.gender ?? ""} onChange={(e) => set({ gender: (e.target.value || null) as Filters["gender"] })}>
          <option value="">Anyone</option>
          <option value="women">Women</option>
          <option value="men">Men</option>
          <option value="kids">Kids</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        Price
        <select
          className={select}
          value={priceIndex}
          onChange={(e) => {
            const r = PRICE_RANGES[Number(e.target.value)];
            set({ min_price: r.min, max_price: r.max });
          }}
        >
          {PRICE_RANGES.map((r, i) => (
            <option key={r.label} value={i}>{r.label}</option>
          ))}
        </select>
      </label>
      {active ? (
        <button onClick={() => onChange({ ...EMPTY_FILTERS, sort: value.sort })} className="text-ink-soft underline hover:text-accent-dark">
          Clear
        </button>
      ) : null}
      <label className="flex items-center gap-2 sm:ml-auto">
        Sort
        <select className={select} value={value.sort} onChange={(e) => set({ sort: e.target.value as Sort })}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
