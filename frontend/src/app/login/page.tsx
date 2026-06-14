"use client";
import { useState } from "react";
import { login } from "../../services/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      const data = await login(email, password);
      localStorage.setItem("token", data.access_token);
      window.location.href = "/search";
    } catch {
      setError("Invalid email or password");
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@300;400;500&display=swap');`}</style>
      <div style={{ width: 420 }}>
        <a href="/" style={{ display: "block", textAlign: "center", fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600, marginBottom: 40, color: "#1A1A1A" }}>
          FashionLens <span style={{ color: "#C8502A" }}>AI</span>
        </a>
        <div style={{ background: "#fff", border: "1px solid #E8E8E4", borderRadius: 10, padding: "40px 40px 36px" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 600, marginBottom: 6 }}>Welcome back</h1>
          <p style={{ color: "#888880", fontSize: 14, marginBottom: 32 }}>Sign in to your account</p>

          {error && <p style={{ color: "#C8502A", fontSize: 13, marginBottom: 16, padding: "10px 14px", background: "#FDF0EC", borderRadius: 4 }}>{error}</p>}

          <label style={{ fontSize: 12, fontWeight: 500, color: "#555", letterSpacing: "0.3px", display: "block", marginBottom: 6 }}>Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ display: "block", width: "100%", padding: "11px 14px", border: "1px solid #E8E8E4", borderRadius: 4, fontSize: 14, marginBottom: 20, outline: "none", background: "#FAFAF8" }}
          />

          <label style={{ fontSize: 12, fontWeight: 500, color: "#555", letterSpacing: "0.3px", display: "block", marginBottom: 6 }}>Password</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            style={{ display: "block", width: "100%", padding: "11px 14px", border: "1px solid #E8E8E4", borderRadius: 4, fontSize: 14, marginBottom: 28, outline: "none", background: "#FAFAF8" }}
          />

          <button onClick={handleSubmit} disabled={loading} style={{
            width: "100%", padding: "13px", background: loading ? "#E8A090" : "#C8502A",
            color: "#fff", border: "none", borderRadius: 4, fontSize: 14, fontWeight: 500, cursor: "pointer",
          }}>
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#888880" }}>
            No account? <a href="/register" style={{ color: "#C8502A", fontWeight: 500 }}>Register</a>
          </p>
        </div>
      </div>
    </div>
  );
}