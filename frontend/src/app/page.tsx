"use client";
import { useRouter } from "next/navigation";

const OUTFIT_IMAGES = [
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80",
  "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80",
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&q=80",
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80",
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&q=80",
  "https://images.unsplash.com/photo-1550614000-4895a10e1bfd?w=400&q=80",
];

const BRANDS = ["Khaadi", "Sapphire", "Gul Ahmed", "Outfitters", "Alkaram", "Limelight", "Beechtree", "Bonanza", "Nishat", "J."];

export default function LandingPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .card:hover { transform: translateY(-4px); transition: transform 0.3s ease; }
        .btn-primary:hover { background: #A8401E !important; }
        .btn-secondary:hover { background: #f0f0ee !important; }
      `}</style>

      {/* Navbar */}
      <nav style={{ padding: "0 48px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #E8E8E4", background: "#fff" }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600 }}>
          FashionLens <span style={{ color: "#C8502A" }}>AI</span>
        </span>
        <div style={{ display: "flex", gap: 16 }}>
          <button onClick={() => router.push("/login")} className="btn-secondary" style={{ padding: "8px 20px", border: "1px solid #E8E8E4", borderRadius: 4, background: "transparent", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Sign in
          </button>
          <button onClick={() => router.push("/register")} className="btn-primary" style={{ padding: "8px 20px", border: "none", borderRadius: 4, background: "#C8502A", color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Get started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "calc(100vh - 64px)", maxWidth: 1200, margin: "0 auto", padding: "0 48px", alignItems: "center", gap: 80 }}>
        
        {/* Left */}
        <div>
          <div style={{ display: "inline-block", padding: "6px 14px", background: "#FDF0EC", borderRadius: 20, fontSize: 12, fontWeight: 500, color: "#C8502A", letterSpacing: "0.5px", marginBottom: 28 }}>
            AI-Powered Fashion Search
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 56, fontWeight: 700, lineHeight: 1.1, marginBottom: 24, color: "#1A1A1A" }}>
            Find any fit<br />across Pakistan's<br />top brands.
          </h1>
          <p style={{ fontSize: 17, color: "#888880", lineHeight: 1.7, marginBottom: 40, maxWidth: 440 }}>
            Upload a photo or describe what you're looking for. FashionLens searches Khaadi, Sapphire, Gul Ahmed, and more — all at once.
          </p>
          <div style={{ display: "flex", gap: 12, marginBottom: 48 }}>
            <button onClick={() => router.push("/register")} className="btn-primary" style={{ padding: "14px 32px", background: "#C8502A", color: "#fff", border: "none", borderRadius: 4, fontSize: 15, fontWeight: 500, cursor: "pointer" }}>
              Start searching free
            </button>
            <button onClick={() => router.push("/search")} className="btn-secondary" style={{ padding: "14px 32px", background: "transparent", color: "#1A1A1A", border: "1px solid #E8E8E4", borderRadius: 4, fontSize: 15, fontWeight: 500, cursor: "pointer" }}>
              Try a demo →
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 40 }}>
            {[["70k+", "Products indexed"], ["10+", "Pakistani brands"], ["AI", "CLIP-powered search"]].map(([val, label]) => (
              <div key={label}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 600, color: "#1A1A1A" }}>{val}</div>
                <div style={{ fontSize: 12, color: "#888880" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — image grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, height: 520 }}>
          {OUTFIT_IMAGES.map((src, i) => (
            <div key={i} className="card" style={{
              borderRadius: 8, overflow: "hidden",
              gridRow: i === 0 ? "span 2" : "span 1",
              animation: `float ${3 + i * 0.4}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            }}>
              <img src={src} alt="outfit" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          ))}
        </div>
      </div>

      {/* Brand marquee */}
      <div style={{ borderTop: "1px solid #E8E8E4", borderBottom: "1px solid #E8E8E4", padding: "18px 0", overflow: "hidden", background: "#fff" }}>
        <div style={{ display: "flex", animation: "marquee 20s linear infinite", width: "max-content" }}>
          {[...BRANDS, ...BRANDS].map((b, i) => (
            <span key={i} style={{ padding: "0 40px", fontSize: 13, fontWeight: 500, letterSpacing: "1px", textTransform: "uppercase", color: "#888880", whiteSpace: "nowrap" }}>
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* Features */}
      <div style={{ maxWidth: 1100, margin: "80px auto", padding: "0 48px" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, textAlign: "center", marginBottom: 48 }}>How it works</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
          {[
            { icon: "📷", title: "Upload or describe", desc: "Take a photo of an outfit you love, or just type what you're looking for." },
            { icon: "🤖", title: "AI finds matches", desc: "CLIP AI analyzes your query and searches across thousands of products instantly." },
            { icon: "🛍️", title: "Shop directly", desc: "Click any result to go straight to the brand's product page and buy." },
          ].map(f => (
            <div key={f.title} style={{ background: "#fff", border: "1px solid #E8E8E4", borderRadius: 8, padding: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "#888880", lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ background: "#1A1A1A", padding: "80px 48px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, color: "#fff", marginBottom: 16 }}>Ready to find your fit?</h2>
        <p style={{ color: "#888880", fontSize: 16, marginBottom: 36 }}>Join thousands searching smarter across Pakistan's top fashion brands.</p>
        <button onClick={() => router.push("/register")} style={{ padding: "16px 40px", background: "#C8502A", color: "#fff", border: "none", borderRadius: 4, fontSize: 15, fontWeight: 500, cursor: "pointer" }}>
          Get started free
        </button>
      </div>
    </div>
  );
}