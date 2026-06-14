"use client";
import { useEffect, useState } from "react";
import { getHistory } from "../../services/metrics";
import { HistoryEntry } from "../../types";
import Navbar from "../../components/ui/Navbar";

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory().then(data => { setHistory(data.history); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, marginBottom: 8 }}>Search History</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 40 }}>Your recent searches</p>

        {loading && <p style={{ color: "var(--muted)" }}>Loading...</p>}
        {!loading && history.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)" }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🔍</p>
            <p>No searches yet. Try searching something.</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {history.map((entry, i) => (
            <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                  {entry.query_type === "image" ? "📷 Image Search" : `🔍 "${entry.query}"`}
                </p>
                <p style={{ fontSize: 12, color: "var(--muted)" }}>{entry.results.length} results · {new Date(entry.created_at).toLocaleString()}</p>
              </div>
              <a href="/search" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500 }}>Search again →</a>
            </div>
          ))}
        </div>
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