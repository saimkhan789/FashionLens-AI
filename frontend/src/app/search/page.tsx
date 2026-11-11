"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { FilterSidebar, SortSelect } from "@/components/Filters";
import PieceBar from "@/components/PieceBar";
import ProductGrid, { EmptyState } from "@/components/ProductGrid";
import { HeroSearch } from "@/components/SearchBar";
import { api, ApiError, EMPTY_FILTERS, type DetectedItem, type Filters, type Product } from "@/lib/api";
import { getPendingImage } from "@/lib/pending";
import { useSession } from "@/lib/session";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <SearchView />
    </Suspense>
  );
}

type Problem = { kind: "limit" | "error" | "expired" | "lost-photo"; message: string } | null;

function SearchView() {
  const params = useSearchParams();
  const q = params.get("q")?.trim() || "";
  const img = params.get("img")?.trim() || "";
  const photo = params.get("photo") || "";

  if (q) return <TextResults key={`q:${q}`} query={q} />;
  if (img || photo) return <PhotoResults key={img ? `img:${img}` : `photo:${photo}`} link={img || null} stamp={photo} />;
  return (
    <div className="mx-auto max-w-[640px] px-4 py-16 sm:px-8">
      <h1 className="mb-2 text-center font-display text-5xl font-semibold">
        What are you <span className="text-accent italic">looking for?</span>
      </h1>
      <p className="mb-8 text-center text-ink-soft">Drop an outfit photo, paste a Pinterest link, or describe it.</p>
      <HeroSearch />
    </div>
  );
}

/** Shared handling of API failures: the guest limit opens the sign-in dialog. */
function useProblem() {
  const { askToSignIn } = useSession();
  const [problem, setProblem] = useState<Problem>(null);
  const report = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.code === "guest_limit") {
        askToSignIn(e.message);
        setProblem({ kind: "limit", message: e.message });
      } else if (e instanceof ApiError && e.status === 410) {
        setProblem({ kind: "expired", message: e.message });
      } else if (e instanceof ApiError && e.status === 503) {
        setProblem({ kind: "error", message: "The AI is still warming up. Give it a minute and try again." });
      } else {
        setProblem({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong" });
      }
    },
    [askToSignIn],
  );
  return { problem, setProblem, report };
}

function ProblemPanel({ problem }: { problem: NonNullable<Problem> }) {
  const { askToSignIn } = useSession();
  const titles = { limit: "Sign in to keep searching", error: "That didn't work", expired: "This search expired", "lost-photo": "Your photo didn't come along" };
  return (
    <EmptyState title={titles[problem.kind]}>
      <p>{problem.message}</p>
      {problem.kind === "limit" && (
        <button onClick={() => askToSignIn(problem.message)} className="mt-5 rounded-full bg-accent px-6 py-2.5 font-semibold text-white shadow-accent hover:bg-accent-dark">
          Sign in free
        </button>
      )}
    </EmptyState>
  );
}

function ResultsLayout({ filters, setFilters, hideCategory, title, children }: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  hideCategory?: boolean;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 pt-[26px] pb-16 sm:px-8 md:flex-row md:gap-8">
      <FilterSidebar value={filters} onChange={setFilters} hideCategory={hideCategory} />
      <section className="min-w-0 flex-1">
        <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-[36px] leading-[1.1] font-semibold">{title}</h1>
          <SortSelect value={filters.sort} onChange={(sort) => setFilters({ ...filters, sort })} />
        </div>
        {children}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- text

function TextResults({ query }: { query: string }) {
  const { setQuota } = useSession();
  const { problem, setProblem, report } = useProblem();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  // A page of results remembers the filters it was fetched with; until it matches, we're loading.
  const [page, setPage] = useState<{ filters: Filters; results: Product[]; hasMore: boolean } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const current = page?.filters === filters ? page : null;
  const results = current?.results ?? [];
  const loading = !current || loadingMore;

  useEffect(() => {
    let alive = true;
    api.textSearch(query, filters, 0)
      .then((r) => {
        if (!alive) return;
        setPage({ filters, results: r.results, hasMore: r.has_more });
        setProblem(null);
        setQuota(r.guest);
      })
      .catch((e) => {
        if (!alive) return;
        setPage({ filters, results: [], hasMore: false });
        report(e);
      });
    return () => {
      alive = false;
    };
  }, [query, filters, report, setProblem, setQuota]);

  const loadMore = async () => {
    if (!current || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await api.textSearch(query, filters, current.results.length);
      setPage((p) => (p && p.filters === filters ? { ...p, results: [...p.results, ...r.results], hasMore: r.has_more } : p));
    } catch (e) {
      report(e);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <ResultsLayout
      filters={filters}
      setFilters={setFilters}
      title={<>Results for <span className="text-accent italic">{query}</span></>}
    >
      {problem && !loading && results.length === 0 ? (
        <ProblemPanel problem={problem} />
      ) : (
        <ProductGrid
          products={results}
          source="search"
          loading={loading}
          hasMore={!!current?.hasMore && !problem}
          onLoadMore={loadMore}
          empty={<EmptyState title="Nothing matched">Try fewer words, a different colour, or clear some filters.</EmptyState>}
        />
      )}
    </ResultsLayout>
  );
}

// ---------------------------------------------------------------- photo

function PhotoResults({ link, stamp }: { link: string | null; stamp: string }) {
  const { setQuota } = useSession();
  const { problem: apiProblem, report } = useProblem();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [file] = useState(() => (link ? null : getPendingImage(stamp)));
  const lostPhoto = !link && !file;
  const problem: Problem = lostPhoto
    ? { kind: "lost-photo", message: "Photos can't be kept across a page reload. Drop or upload it again above." }
    : apiProblem;
  const [localPreview] = useState(() => (file ? URL.createObjectURL(file) : null));
  const [remotePreview, setRemotePreview] = useState<string | null>(null);
  const preview = localPreview ?? remotePreview;
  const [searchId, setSearchId] = useState<string | null>(null);
  const [items, setItems] = useState<DetectedItem[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(!lostPhoto);
  const started = useRef(false);
  const requestId = useRef(0);
  const filtersApplied = useRef(false);

  // 1. Run the photo search once.
  useEffect(() => {
    if (started.current || lostPhoto) return;
    started.current = true;
    api.imageSearch(file ?? link!, EMPTY_FILTERS)
      .then((r) => {
        setSearchId(r.search_id);
        setItems(r.items);
        if (!file) setRemotePreview(r.image_url ?? link);
        setQuota(r.guest);
      })
      .catch(report)
      .finally(() => setLoading(false));
  }, [file, link, lostPhoto, report, setQuota]);

  // Free the uploaded photo's preview when leaving the page.
  useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  // 2. Filters or another piece: re-query that piece with the current filters.
  const reload = useCallback(
    async (item: number, offset: number) => {
      if (!searchId) return;
      const id = ++requestId.current;
      setLoading(true);
      try {
        const r = await api.moreResults(searchId, item, filters, offset);
        if (id !== requestId.current) return;
        setItems((prev) =>
          prev.map((it, i) => (i === item ? { ...it, results: offset === 0 ? r.results : [...it.results, ...r.results], has_more: r.has_more } : it)),
        );
      } catch (e) {
        if (id === requestId.current) report(e);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [searchId, filters, report],
  );

  useEffect(() => {
    if (!searchId) return;
    if (!filtersApplied.current && filters === EMPTY_FILTERS) return; // first results came with the search
    filtersApplied.current = true;
    reload(selected, 0);
    // Only filter changes trigger this; switching pieces is handled in onSelect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const onSelect = (i: number) => {
    setSelected(i);
    if (filtersApplied.current) reload(i, 0);
  };

  const current = items[selected];
  const label = current?.label === "Full look" ? "whole look" : current?.label.toLowerCase();

  return (
    <>
      {(preview || items.length > 0) && <PieceBar imageSrc={preview} items={items} selected={selected} onSelect={onSelect} />}
      <ResultsLayout
        filters={filters}
        setFilters={setFilters}
        hideCategory
        title={current ? <>Matches for the <span className="text-accent italic">{label}</span></> : "Finding every piece"}
      >
        {problem && !current?.results.length ? (
          <ProblemPanel problem={problem} />
        ) : (
          <ProductGrid
            products={current?.results ?? []}
            source="image"
            loading={loading}
            hasMore={!!current?.has_more && !problem}
            onLoadMore={() => reload(selected, current?.results.length ?? 0)}
            empty={<EmptyState title="Nothing matched this piece">Try another piece above, or clear some filters.</EmptyState>}
          />
        )}
      </ResultsLayout>
    </>
  );
}
