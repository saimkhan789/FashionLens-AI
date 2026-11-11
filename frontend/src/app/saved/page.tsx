"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProductGrid, { EmptyState } from "@/components/ProductGrid";
import { api, type Product } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function SavedPage() {
  const { user, ready, savedIds, askToSignIn } = useSession();
  const [products, setProducts] = useState<Product[] | null>(null);
  const loading = !ready || (!!user && products === null);

  useEffect(() => {
    if (!ready || !user) return;
    api.favorites().then((r) => setProducts(r.favorites)).catch(() => setProducts([]));
  }, [ready, user]);

  // Unsaving from this page removes the card straight away.
  const visible = (products ?? []).filter((p) => savedIds.has(p.id));

  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-10 pb-16 sm:px-8">
      <h1 className="font-display text-[44px] leading-none font-semibold">
        Saved <span className="text-accent italic">pieces</span>
      </h1>
      <p className="mt-2 mb-8 text-ink-soft">Everything you hearted, ready when you are.</p>
      {ready && !user ? (
        <EmptyState title="Sign in to see your saved pieces">
          <p>Tap the heart on any product to keep it here.</p>
          <button onClick={() => askToSignIn("Sign in to save products and see them on any device.")} className="mt-5 rounded-full bg-accent px-6 py-2.5 font-semibold text-white shadow-accent hover:bg-accent-dark">
            Sign in free
          </button>
        </EmptyState>
      ) : (
        <ProductGrid
          products={visible}
          source="saved"
          loading={loading}
          empty={
            <EmptyState title="Nothing saved yet">
              <p>Tap the heart on any product to keep it here.</p>
              <Link href="/search" className="mt-5 inline-block rounded-full bg-ink px-6 py-2.5 font-semibold text-white hover:bg-accent-dark">Start searching</Link>
            </EmptyState>
          }
        />
      )}
    </div>
  );
}
