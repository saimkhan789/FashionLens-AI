"use client";
import { useState, useRef } from "react";
import { textSearch, imageSearch } from "../../services/search";
import { addFavorite } from "../../services/favorites";
import { SearchResult } from "../../types";
import Navbar from "../../components/ui/Navbar";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [favored, setFavored] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleTextSearch() {
    if (!query.trim()) return;
    setLoading(true); setError("");
    try {
      const data = await textSearch(query);
      setResults(data.results);
    } catch { setError("Search failed. Try again."); }
    setLoading(false);
  }

  async function handleImageSearch() {
    if (!file) return;
    setLoading(true); setError("");
    try {
      const data = await imageSearch(file);
      setResults(data.results);
    } catch { setError("Image search failed."); }
    setLoading(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleFavorite(product_id: string) {
    try {
      await addFavorite(Number(product_id));
      setFavored(prev => new Set([...prev, product_id]));
    } catch { alert("Login to save favorites"); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ marginBottom: 48, maxWidth: 680 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 600, lineHeight: 1.15, marginBottom: 12 }}>
            Find fashion,<br />the intelligent way.
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 15 }}>Search by text or upload an image to find similar products from top Pakistani brands.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 48, maxWidth: 800 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>Text Search</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                placeholder="e.g. red floral kurta for women"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleTextSearch()}
                style={{
                  flex: 1, padding: "10px 14px", border: "1px solid var(--border)",
                  borderRadius: 4, fontSize: 14, background: "var(--bg)", outline: "none",
                }}
              />
              <button onClick={handleTextSearch} style={{
                padding: "10px 20px", background: "var(--accent)", color: "#fff",
                border: "none", borderRadius: 4, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap",
              }}>Search</button>
            </div>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>Image Search</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {preview && <img src={preview} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border)" }} />}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
              <button onClick={() => fileRef.current?.click()} style={{
                flex: 1, padding: "10px 14px", background: "var(--bg)", border: "1px solid var(--border)",
                borderRadius: 4, fontSize: 13, color: "var(--muted)", textAlign: "left",
              }}>{file ? file.name : "Upload image..."}</button>
              <button onClick={handleImageSearch} disabled={!file} style={{
                padding: "10px 20px", background: file ? "var(--accent)" : "var(--border)", color: file ? "#fff" : "var(--muted)",
                border: "none", borderRadius: 4, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap",
              }}>Search</button>
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)" }}>
            <p style={{ fontSize: 14 }}>Searching across collections...</p>
          </div>
        )}

        {error && <p style={{ color: "var(--accent)", marginBottom: 24, fontSize: 14 }}>{error}</p>}

        {results.length > 0 && (
          <>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>{results.length} results found</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
              {results.map(r => (
                <div key={r.product_id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                  <a href={r.product_url || "#"} target="_blank" rel="noreferrer">
                    <div style={{ position: "relative", paddingTop: "120%", background: "#F5F5F3", overflow: "hidden" }}>
                      <img
                        src={r.image_url || (r.source === "kaggle" ? `http://localhost:8000/images/${r.product_id}.jpg` : "/no-image.png")}
                        alt={r.display_name}
                        onError={(e) => { (e.target as HTMLImageElement).src = "/no-image.png"; }}
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  </a>
                  <div style={{ padding: "14px 14px 16px" }}>
                    {r.brand && <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--accent)", marginBottom: 4 }}>{r.brand}</p>}
                    <p style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, marginBottom: 4, color: "var(--text)" }}>{r.display_name}</p>
                    <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: r.price ? 6 : 10 }}>{r.article_type}{r.base_colour && r.base_colour !== "unknown" ? ` · ${r.base_colour}` : ""}</p>
                    {r.price && <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>PKR {r.price}</p>}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => handleFavorite(String(r.product_id))}
                        style={{
                          flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 500,
                          border: `1px solid ${favored.has(String(r.product_id)) ? "var(--accent)" : "var(--border)"}`,
                          background: favored.has(String(r.product_id)) ? "#FDF0EC" : "transparent",
                          color: favored.has(String(r.product_id)) ? "var(--accent)" : "var(--muted)",
                          borderRadius: 4,
                        }}
                      >
                        {favored.has(String(r.product_id)) ? "Saved" : "Save"}
                      </button>
                      {r.product_url && (
                        <a href={r.product_url} target="_blank" rel="noreferrer" style={{
                          flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 500,
                          border: "1px solid var(--border)", borderRadius: 4,
                          color: "var(--text)", textAlign: "center", display: "block",
                        }}>View →</a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <style>{`
  :root {
    --bg: #FAFAF8; --surface: #FFFFFF; --border: #E8E8E4;
    --text: #1A1A1A; --muted: #888880; --accent: #C8502A;
    --font-display: 'Playfair Display', serif;
    --font-body: 'DM Sans', sans-serif;
  }
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');
`}</style>
    </div>
  );
}