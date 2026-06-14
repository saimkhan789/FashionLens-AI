"use client";
import { useState } from "react";
import { register } from "../../services/auth";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      const data = await register(username, email, password);
      localStorage.setItem("token", data.access_token);
      window.location.href = "/search";
    } catch {
      setError("Registration failed. Try a different email.");
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
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 600, marginBottom: 6 }}>Create account</h1>
          <p style={{ color: "#888880", fontSize: 14, marginBottom: 32 }}>Start searching across Pakistan's top fashion brands</p>

          {error && <p style={{ color: "#C8502A", fontSize: 13, marginBottom: 16, padding: "10px 14px", background: "#FDF0EC", borderRadius: 4 }}>{error}</p>}

          {[
            { label: "Username", value: username, set: setUsername, type: "text", placeholder: "yourname" },
            { label: "Email", value: email, set: setEmail, type: "email", placeholder: "you@example.com" },
            { label: "Password", value: password, set: setPassword, type: "password", placeholder: "••••••••" },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#555", display: "block", marginBottom: 6 }}>{f.label}</label>
              <input
                type={f.type} value={f.value} placeholder={f.placeholder}
                onChange={e => f.set(e.target.value)}
                style={{ display: "block", width: "100%", padding: "11px 14px", border: "1px solid #E8E8E4", borderRadius: 4, fontSize: 14, marginBottom: 20, outline: "none", background: "#FAFAF8" }}
              />
            </div>
          ))}

          <button onClick={handleSubmit} disabled={loading} style={{
            width: "100%", padding: "13px", background: loading ? "#E8A090" : "#C8502A",
            color: "#fff", border: "none", borderRadius: 4, fontSize: 14, fontWeight: 500, cursor: "pointer", marginTop: 8,
          }}>
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#888880" }}>
            Have an account? <a href="/login" style={{ color: "#C8502A", fontWeight: 500 }}>Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}