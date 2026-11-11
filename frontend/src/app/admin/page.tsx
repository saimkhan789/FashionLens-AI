"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshIcon, TrashIcon } from "@/components/icons";
import { EmptyState } from "@/components/ProductGrid";
import { api, type AdminStore, type Stats } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function AdminPage() {
  const { user, ready } = useSession();
  const [tab, setTab] = useState<"stores" | "usage">("stores");

  if (!ready) return <div className="min-h-[60vh]" />;
  if (!user?.is_admin)
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState title="Admins only">Sign in with an admin account (listed in ADMIN_EMAILS on the server) to manage stores.</EmptyState>
      </div>
    );

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-10 pb-16 sm:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[44px] leading-none font-semibold">
          Admin <span className="text-accent italic">desk</span>
        </h1>
        <div className="flex gap-1 rounded-full bg-chip p-1 text-sm font-semibold" role="tablist">
          {(["stores", "usage"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full px-5 py-2 capitalize transition ${tab === t ? "bg-surface shadow-soft" : "text-ink-soft hover:text-ink"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === "stores" ? <Stores /> : <Usage />}
    </div>
  );
}

// ---------------------------------------------------------------- stores

const card = "rounded-[22px] border border-[#efebe4] bg-surface p-6 shadow-soft";

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

function Stores() {
  const [stores, setStores] = useState<AdminStore[] | null>(null);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(() => api.admin.stores().then((r) => setStores(r.stores)).catch((e) => setError(e.message)), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while any import is queued or running.
  const busy = stores?.some((s) => s.job && (s.job.status === "queued" || s.job.status === "running"));
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [busy, refresh]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      await api.admin.addStore(url.trim(), name.trim() || undefined);
      setUrl("");
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that store");
    } finally {
      setAdding(false);
    }
  };

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work");
    }
    refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form onSubmit={add} className={`${card} self-start`}>
        <h2 className="font-display text-[28px] leading-tight font-semibold">Add a store</h2>
        <p className="mt-1 mb-5 text-sm text-ink-soft">Paste the shop&apos;s address. We import its catalogue and make every product searchable.</p>
        <label className="block">
          <span className="mb-1 block text-[13px] font-semibold">Store address</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="https://www.example.pk"
            className="h-11 w-full rounded-xl border border-[#e0dad1] bg-paper px-3.5 outline-none focus:border-ink-soft"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-[13px] font-semibold">Brand name <span className="font-normal text-muted">(optional)</span></span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Taken from the address if empty"
            className="h-11 w-full rounded-xl border border-[#e0dad1] bg-paper px-3.5 outline-none focus:border-ink-soft"
          />
        </label>
        {error && <p className="mt-3 rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm text-accent-dark" role="alert">{error}</p>}
        <button type="submit" disabled={adding} className="mt-4 h-11 w-full rounded-full bg-accent font-semibold text-white shadow-accent hover:bg-accent-dark disabled:opacity-60">
          {adding ? "Adding" : "Add and import"}
        </button>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          A big catalogue can take a while: every product photo is run through the AI model (about 3 a second on a normal processor).
          For a first import, run the app on your own computer against the cloud database.
        </p>
      </form>

      <div className="space-y-4">
        {stores === null ? (
          [0, 1].map((i) => <div key={i} className="skeleton h-40 rounded-[22px]" />)
        ) : stores.length === 0 ? (
          <EmptyState title="No stores yet">Add the first brand on the left.</EmptyState>
        ) : (
          stores.map((s) => <StoreCard key={s.id} store={s} act={act} />)
        )}
      </div>
    </div>
  );
}

function StoreCard({ store: s, act }: { store: AdminStore; act: (fn: () => Promise<unknown>) => void }) {
  const job = s.job;
  const running = job && (job.status === "queued" || job.status === "running");
  const pct = s.total ? Math.round((s.embedded / s.total) * 100) : 0;
  const jobPct = job && job.to_embed ? Math.round((job.embedded / job.to_embed) * 100) : 0;

  return (
    <div className={`${card} ${s.active ? "" : "opacity-70"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-[26px] leading-none font-semibold">{s.name}</h3>
            {!s.active && <span className="rounded-full bg-chip px-2.5 py-0.5 text-[11px] font-bold text-muted">Hidden</span>}
            {s.platform && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent-dark capitalize">{s.platform}</span>}
          </div>
          <a href={s.url} target="_blank" rel="noopener" className="mt-1 block truncate text-[13px] text-muted hover:text-ink">{s.url}</a>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => act(() => api.admin.syncStore(s.id))}
            disabled={!!running}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
          >
            <RefreshIcon className={`size-4 ${running ? "animate-spin" : ""}`} /> {running ? "Syncing" : "Sync"}
          </button>
          <button
            onClick={() => act(() => api.admin.updateStore(s.id, { active: !s.active }))}
            className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium hover:border-ink-soft"
          >
            {s.active ? "Hide" : "Show"}
          </button>
          <button
            onClick={() => confirm(`Delete ${s.name} and all ${s.total} of its products?`) && act(() => api.admin.deleteStore(s.id))}
            aria-label={`Delete ${s.name}`}
            className="grid size-9 place-items-center rounded-full border border-line-strong text-ink-soft hover:border-accent hover:text-accent-dark"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-center">
        {[
          ["Searchable", s.searchable.toLocaleString()],
          ["Products", s.total.toLocaleString()],
          ["Last sync", timeAgo(s.last_synced_at)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-paper px-3 py-3">
            <p className="font-display text-2xl leading-none font-semibold">{value}</p>
            <p className="mt-1 text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>Photos processed</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-chip">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {job && running && (
        <p className="mt-4 rounded-xl bg-sand px-4 py-2.5 text-sm">
          {job.status === "queued"
            ? "Waiting to start"
            : job.stage === "embedding"
              ? `Processing photos: ${job.embedded.toLocaleString()} of ${job.to_embed.toLocaleString()} (${jobPct}%)`
              : `Reading the catalogue: ${job.found.toLocaleString()} products found`}
        </p>
      )}
      {job?.status === "failed" && (
        <p className="mt-4 rounded-xl bg-accent-soft px-4 py-2.5 text-sm text-accent-dark">Last sync failed: {job.error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- usage

function Usage() {
  const [days, setDays] = useState(30);
  const [loaded, setLoaded] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stats = loaded?.days === days ? loaded : null; // null while the new range loads

  useEffect(() => {
    let alive = true;
    api.admin.stats(days).then((s) => alive && setLoaded(s)).catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [days]);

  if (error) return <EmptyState title="Couldn't load stats">{error}</EmptyState>;

  const t = stats?.totals;
  const tiles: [string, string, string?][] = t
    ? [
        ["Searches", t.searches.toLocaleString(), `${t.image_searches.toLocaleString()} by photo`],
        ["Guest share", t.searches ? `${Math.round((t.guest_searches / t.searches) * 100)}%` : "0%", "of searches"],
        ["New sign-ups", t.signups.toLocaleString(), `${t.users.toLocaleString()} users in total`],
        ["Visits to brands", t.clicks.toLocaleString(), "product clicks"],
        ["Searchable products", t.searchable_products.toLocaleString()],
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="text-ink-soft">Last</span>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-full px-3.5 py-1.5 font-semibold ${days === d ? "bg-ink text-white" : "bg-chip hover:bg-[#e8e2d8]"}`}
          >
            {d} days
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats
          ? tiles.map(([label, value, sub]) => (
              <div key={label} className="rounded-[20px] border border-[#efebe4] bg-surface p-5 shadow-soft">
                <p className="text-[13px] text-ink-soft">{label}</p>
                <p className="mt-1 font-display text-[38px] leading-none font-semibold">{value}</p>
                {sub && <p className="mt-1.5 text-xs text-muted">{sub}</p>}
              </div>
            ))
          : [0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-[118px] rounded-[20px]" />)}
      </div>

      {stats && <SearchesChart daily={stats.daily} />}

      {stats && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className={card}>
            <h3 className="mb-3 font-display text-2xl font-semibold">Most visited brands</h3>
            {stats.top_brands.length === 0 ? (
              <p className="text-sm text-muted">No product clicks yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-2 font-semibold">Brand</th>
                    <th className="pb-2 text-right font-semibold">Clicks</th>
                    <th className="pb-2 text-right font-semibold">Visitors</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_brands.map((b) => (
                    <tr key={b.id} className="border-t border-line">
                      <td className="py-2">{b.name}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{b.clicks.toLocaleString()}</td>
                      <td className="py-2 text-right tabular-nums text-ink-soft">{b.visitors.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className={card}>
            <h3 className="mb-3 font-display text-2xl font-semibold">Top searches</h3>
            {stats.top_queries.length === 0 ? (
              <p className="text-sm text-muted">No text searches yet.</p>
            ) : (
              <ol className="space-y-1.5 text-sm">
                {stats.top_queries.map((q, i) => (
                  <li key={q.query} className="flex items-baseline gap-3 border-t border-line pt-1.5 first:border-0 first:pt-0">
                    <span className="w-5 text-right text-xs text-muted tabular-nums">{i + 1}</span>
                    <span className="flex-1 truncate">{q.query}</span>
                    <span className="font-semibold tabular-nums">{q.count}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Searches per day: one series (rust), hover for the text/photo split, table view for exact numbers. */
function SearchesChart({ daily }: { daily: Stats["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const totals = daily.map((d) => d.text + d.image);
  const max = Math.max(4, ...totals);
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const W = 1000, H = 240, padL = 36, padB = 26;
  const bw = (W - padL) / daily.length;
  const label = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-PK", { day: "numeric", month: "short" });

  return (
    <div className={card}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-display text-2xl font-semibold">Searches per day</h3>
        <button onClick={() => setAsTable((v) => !v)} className="text-sm font-semibold text-accent-dark hover:underline">
          {asTable ? "Show chart" : "Show table"}
        </button>
      </div>
      {asTable ? (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
              <tr><th className="pb-2">Day</th><th className="pb-2 text-right">Text</th><th className="pb-2 text-right">Photo</th><th className="pb-2 text-right">Guests</th><th className="pb-2 text-right">Sign-ups</th><th className="pb-2 text-right">Clicks</th></tr>
            </thead>
            <tbody>
              {[...daily].reverse().map((d) => (
                <tr key={d.date} className="border-t border-line tabular-nums">
                  <td className="py-1.5">{label(d.date)}</td>
                  <td className="py-1.5 text-right">{d.text}</td>
                  <td className="py-1.5 text-right">{d.image}</td>
                  <td className="py-1.5 text-right">{d.guest}</td>
                  <td className="py-1.5 text-right">{d.signups}</td>
                  <td className="py-1.5 text-right">{d.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bar chart of searches per day" onMouseLeave={() => setHover(null)}>
            {[0, 1, 2, 3, 4].map((i) => {
              const y = (H - padB) * (1 - i / 4);
              return (
                <g key={i}>
                  <line x1={padL} x2={W} y1={y} y2={y} stroke="#ece9e3" strokeWidth={1} />
                  <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#6b6b64">{step * i}</text>
                </g>
              );
            })}
            {daily.map((d, i) => {
              const h = ((H - padB) * totals[i]) / top;
              const x = padL + i * bw;
              const barW = Math.max(bw - 2, 1);
              return (
                <g key={d.date} onMouseEnter={() => setHover(i)}>
                  <rect x={x} y={0} width={bw} height={H - padB} fill="transparent" />
                  {h > 0 && (
                    <path
                      d={`M${x + 1},${H - padB} V${H - padB - h + Math.min(4, h)} q0,-${Math.min(4, h)} ${Math.min(4, barW / 2)},-${Math.min(4, h)} H${x + 1 + barW - Math.min(4, barW / 2)} q${Math.min(4, barW / 2)},0 ${Math.min(4, barW / 2)},${Math.min(4, h)} V${H - padB} Z`}
                      fill={hover === i ? "#a8401e" : "#c8502a"}
                    />
                  )}
                  {(i === 0 || i === daily.length - 1 || i % Math.ceil(daily.length / 6) === 0) && (
                    <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#6b6b64">{label(d.date)}</text>
                  )}
                </g>
              );
            })}
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-0 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-soft"
              style={{ left: `${((padL + (hover + 0.5) * bw) / W) * 100}%`, transform: "translateX(-50%)" }}
            >
              <p className="font-semibold">{label(daily[hover].date)}</p>
              <p>{totals[hover]} searches: {daily[hover].text} text, {daily[hover].image} photo</p>
              <p className="text-muted">{daily[hover].guest} by guests · {daily[hover].clicks} brand visits</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
