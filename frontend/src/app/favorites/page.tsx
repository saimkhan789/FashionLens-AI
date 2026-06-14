"use client";
import { useEffect, useState } from "react";
import { getFavorites, removeFavorite } from "../../services/favorites";
import Navbar from "../../components/ui/Navbar";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFavorites().then(data => { setFavorites(data.favorites); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function handleRemove(product_id: number) {
    await removeFavorite(product_id);
    setFavorites(prev => prev.filter(f => f.product_id !== product_id));
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, marginBottom: 8 }}>Saved Items</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 40 }}>Products you've saved for later</p>

        {loading && <p style={{ color: "var(--muted)" }}>Loading...</p>}
        {!loading && favorites.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)" }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🤍</p>
            <p>No saved items yet.</p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {favorites.map(f => (
            <div key={f.product_id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ paddingTop: "120%", background: "#F5F5F3", position: "relative" }}>
                <img
                  src={`http://localhost:8000/images/${f.product_id}.jpg`}
                  alt={f.display_name}
                  onError={(e) => { (e.target as HTMLImageElement).src = "/no-image.png"; }}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div style={{ padding: "14px 14px 16px" }}>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{f.display_name}</p>
                <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>{f.article_type} · {f.base_colour}</p>
                <button onClick={() => handleRemove(f.product_id)} style={{
                  width: "100%", padding: "7px 0", fontSize: 12, fontWeight: 500,
                  border: "1px solid #FFCDD2", borderRadius: 4, background: "#FFF5F5", color: "#C62828",
                }}>Remove</button>
              </div>
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