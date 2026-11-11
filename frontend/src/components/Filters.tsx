"use client";

import { useEffect, useState } from "react";
import { api, EMPTY_FILTERS, type Facets, type Filters, type Sort } from "@/lib/api";
import { FilterIcon } from "./icons";

let facetsCache: Promise<Facets> | null = null;
export function loadFacets(): Promise<Facets> {
  facetsCache ??= api.facets().catch((e) => {
    facetsCache = null;
    throw e;
  });
  return facetsCache;
}

const CATEGORY_LABELS: Record<string, string> = {
  unstitched: "Unstitched", suit: "Suits", kurta: "Kurtas", dress: "Dresses", outerwear: "Jackets and knits",
  dupatta: "Dupattas and shawls", footwear: "Shoes", bag: "Bags", jewelry: "Jewellery", skirt: "Skirts",
  bottoms: "Trousers", tops: "Tops and shirts",
};
export const categoryLabel = (c: string) => CATEGORY_LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1);

const heading = "mb-2 text-[11px] font-bold tracking-[0.1em] text-muted uppercase";
const field = "h-[38px] w-full min-w-0 rounded-[10px] border border-[#e0dad1] bg-paper px-2.5 text-[13px] outline-none focus:border-ink-soft";

type Props = {
  value: Filters;
  onChange: (f: Filters) => void;
  /** Photo searches already narrow results to the detected garment. */
  hideCategory?: boolean;
};

export function FilterSidebar({ value, onChange, hideCategory }: Props) {
  const [facets, setFacets] = useState<Facets | null>(null);
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(value.min_price?.toString() ?? "");
  const [max, setMax] = useState(value.max_price?.toString() ?? "");
  // When the price filter changes from outside (e.g. "Clear filters"), resync the boxes.
  const priceKey = `${value.min_price}|${value.max_price}`;
  const [syncedKey, setSyncedKey] = useState(priceKey);
  if (syncedKey !== priceKey) {
    setSyncedKey(priceKey);
    setMin(value.min_price?.toString() ?? "");
    setMax(value.max_price?.toString() ?? "");
  }

  useEffect(() => {
    loadFacets().then(setFacets).catch(() => {});
  }, []);

  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  const applyPrice = () => {
    const toNum = (s: string) => (s.trim() && Number(s) >= 0 ? Number(s) : null);
    set({ min_price: toNum(min), max_price: toNum(max) });
  };
  const active = value.brand.length + value.category.length + (value.gender ? 1 : 0) + (value.min_price != null || value.max_price != null ? 1 : 0);

  return (
    <aside className="w-full md:w-[230px] md:shrink-0 md:self-start">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-semibold md:hidden"
        aria-expanded={open}
      >
        <FilterIcon /> Filters{active ? ` (${active})` : ""}
      </button>
      <div className={`${open ? "mt-3 block" : "hidden"} rounded-[18px] border border-[#efebe4] bg-surface p-5 text-sm shadow-soft md:mt-0 md:block`}>
        <p className={heading}>Brand</p>
        {facets ? (
          facets.brands.map((b) => (
            <label key={b.id} className="flex cursor-pointer items-center gap-2.5 py-1">
              <input type="checkbox" checked={value.brand.includes(b.id)} onChange={() => set({ brand: toggle(value.brand, b.id) })} />
              <span className="flex-1">{b.name}</span>
            </label>
          ))
        ) : (
          <div className="skeleton h-16 rounded-lg" />
        )}

        {!hideCategory && facets && facets.categories.length > 0 && (
          <>
            <p className={`${heading} mt-5`}>Type</p>
            {facets.categories.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2.5 py-1">
                <input type="checkbox" checked={value.category.includes(c.id)} onChange={() => set({ category: toggle(value.category, c.id) })} />
                {categoryLabel(c.id)}
              </label>
            ))}
          </>
        )}

        <p className={`${heading} mt-5`}>For</p>
        {([[null, "Anyone"], ["women", "Women"], ["men", "Men"], ["kids", "Kids"]] as const).map(([g, label]) => (
          <label key={label} className="flex cursor-pointer items-center gap-2.5 py-1">
            <input type="radio" name="filter-gender" checked={value.gender === g} onChange={() => set({ gender: g })} />
            {label}
          </label>
        ))}

        <p className={`${heading} mt-5`}>Price (Rs)</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyPrice();
          }}
        >
          <input className={field} inputMode="numeric" placeholder="Min" aria-label="Minimum price" value={min} onChange={(e) => setMin(e.target.value)} onBlur={applyPrice} />
          <input className={field} inputMode="numeric" placeholder="Max" aria-label="Maximum price" value={max} onChange={(e) => setMax(e.target.value)} onBlur={applyPrice} />
          <button type="submit" hidden />
        </form>

        {active > 0 && (
          <button onClick={() => onChange({ ...EMPTY_FILTERS, sort: value.sort })} className="mt-5 text-[13px] font-semibold text-accent-dark hover:underline">
            Clear filters
          </button>
        )}
      </div>
    </aside>
  );
}

export function SortSelect({ value, onChange }: { value: Sort; onChange: (s: Sort) => void }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-ink-soft">
      Sort
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Sort)}
        className="h-[38px] rounded-full border border-[#e0dad1] bg-surface px-3 text-[13px] text-ink outline-none focus:border-ink-soft"
      >
        <option value="relevance">Best match</option>
        <option value="price_asc">Price: low to high</option>
        <option value="price_desc">Price: high to low</option>
      </select>
    </label>
  );
}
