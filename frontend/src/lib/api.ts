// Thin client for the FastAPI backend. The API is always same-origin at /api
// (served by FastAPI in production, proxied by `next dev` in development).

export type Product = {
  id: number;
  title: string;
  brand: string;
  store_id: number;
  price: number | null;
  compare_at_price: number | null;
  currency: string;
  image_url: string;
  product_url: string;
  category: string | null;
  gender: string | null;
  score: number | null;
  available?: boolean;
};

export type User = { id: number; username: string; email: string; is_admin: boolean };
export type GuestQuota = { text_left: number; image_left: number } | null;

export type Sort = "relevance" | "price_asc" | "price_desc";
export type Filters = {
  brand: number[];
  category: string[];
  gender: "women" | "men" | "kids" | null;
  min_price: number | null;
  max_price: number | null;
  sort: Sort;
};
export const EMPTY_FILTERS: Filters = { brand: [], category: [], gender: null, min_price: null, max_price: null, sort: "relevance" };

export type Page = { results: Product[]; has_more: boolean };
export type TextSearch = Page & { query: string; guest: GuestQuota };
export type DetectedItem = Page & { label: string; box: [number, number, number, number] | null };
export type ImageSearch = { search_id: string; image_url: string | null; items: DetectedItem[]; guest: GuestQuota };
export type Facets = {
  brands: { id: number; name: string; count: number }[];
  categories: { id: string; count: number }[];
  total: number;
};
export type HistoryEntry = { id: number; query_type: "text" | "image"; query: string; result_count: number; created_at: string };
export type PublicConfig = { google_client_id: string | null; guest_text_searches: number; guest_image_searches: number };

export type ImportJob = {
  id: number; status: "queued" | "running" | "done" | "failed"; stage: string | null;
  found: number; embedded: number; to_embed: number; error: string | null;
  created_at: string; finished_at: string | null;
};
export type AdminStore = {
  id: number; name: string; url: string; platform: string | null; active: boolean;
  searchable: number; total: number; embedded: number; last_synced_at: string | null; job: ImportJob | null;
};
export type Stats = {
  days: number;
  totals: {
    searches: number; text_searches: number; image_searches: number; guest_searches: number;
    signups: number; clicks: number; users: number; searchable_products: number;
  };
  daily: { date: string; text: number; image: number; guest: number; signed_in: number; signups: number; clicks: number }[];
  top_brands: { id: number; name: string; clicks: number; visitors: number }[];
  top_queries: { query: string; count: number }[];
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public queryType?: string) {
    super(message);
  }
}

const TOKEN_KEY = "fl_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: the session just won't survive a reload */
  }
}

/** Fired when a signed-in request comes back 401 (expired token): the session logs out. */
export const UNAUTHORIZED_EVENT = "fl:unauthorized";

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...rest,
    credentials: "same-origin",
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.ok) return res.json() as Promise<T>;

  let detail: unknown = null;
  try {
    detail = (await res.json()).detail;
  } catch {
    /* non-JSON error page */
  }
  if (detail && typeof detail === "object" && "code" in detail) {
    const d = detail as { code: string; message: string; query_type?: string };
    throw new ApiError(d.message, res.status, d.code, d.query_type);
  }
  if (res.status === 401 && token) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  const message = typeof detail === "string" ? detail
    : res.status >= 500 ? "Something went wrong on our side. Please try again."
    : "Request failed";
  throw new ApiError(message, res.status);
}

function filterParams(f: Filters, extra: Record<string, string | number> = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
  f.brand.forEach((b) => p.append("brand", String(b)));
  f.category.forEach((c) => p.append("category", c));
  if (f.gender) p.set("gender", f.gender);
  if (f.min_price != null) p.set("min_price", String(f.min_price));
  if (f.max_price != null) p.set("max_price", String(f.max_price));
  if (f.sort !== "relevance") p.set("sort", f.sort);
  return p.toString();
}

export const api = {
  config: () => request<PublicConfig>("/config"),
  facets: () => request<Facets>("/catalog/facets"),
  latest: (category?: string, limit = 8) =>
    request<{ results: Product[] }>(`/catalog/latest?limit=${limit}${category ? `&category=${encodeURIComponent(category)}` : ""}`),

  quota: () => request<{ guest: GuestQuota }>("/search/quota"),
  textSearch: (q: string, f: Filters, offset = 0) =>
    request<TextSearch>(`/search/text?${filterParams(f, { q, offset })}`),
  imageSearch: (image: File | string, f: Filters) => {
    const body = new FormData();
    if (typeof image === "string") body.set("image_url", image);
    else body.set("file", image);
    return request<ImageSearch>(`/search/image?${filterParams(f)}`, { method: "POST", body });
  },
  moreResults: (searchId: string, item: number, f: Filters, offset = 0) =>
    request<Page>(`/search/results?${filterParams(f, { search_id: searchId, item, offset })}`),
  similar: (id: number, f: Filters, offset = 0) =>
    request<Page & { product: Product }>(`/search/similar/${id}?${filterParams(f, { offset })}`),

  register: (username: string, email: string, password: string) =>
    request<{ access_token: string; user: User }>("/auth/register", { method: "POST", json: { username, email, password } }),
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>("/auth/login", { method: "POST", json: { email, password } }),
  google: (credential: string) =>
    request<{ access_token: string; user: User }>("/auth/google", { method: "POST", json: { credential } }),
  me: () => request<User>("/auth/me"),

  favorites: () => request<{ favorites: Product[] }>("/favorites"),
  favoriteIds: () => request<{ ids: number[] }>("/favorites/ids"),
  addFavorite: (product_id: number) => request("/favorites", { method: "POST", json: { product_id } }),
  removeFavorite: (product_id: number) => request(`/favorites/${product_id}`, { method: "DELETE" }),
  history: () => request<{ history: HistoryEntry[] }>("/history"),
  clearHistory: () => request("/history", { method: "DELETE" }),

  admin: {
    stores: () => request<{ stores: AdminStore[] }>("/admin/stores"),
    addStore: (url: string, name?: string) =>
      request<{ id: number }>("/admin/stores", { method: "POST", json: { url, name: name || null } }),
    updateStore: (id: number, body: { name?: string; active?: boolean }) =>
      request(`/admin/stores/${id}`, { method: "PATCH", json: body }),
    syncStore: (id: number) => request(`/admin/stores/${id}/sync`, { method: "POST" }),
    deleteStore: (id: number) => request(`/admin/stores/${id}`, { method: "DELETE" }),
    stats: (days: number) => request<Stats>(`/admin/stats?days=${days}`),
  },
};

/** Product cards link through /api/go so clicks are counted before reaching the brand's shop. */
export const goUrl = (id: number, src: "search" | "image" | "similar" | "saved") => `/api/go/${id}?src=${src}`;

export const formatPrice = (n: number | null) =>
  n == null ? "" : `Rs ${Math.round(n).toLocaleString("en-PK")}`;

export const looksLikeUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());
