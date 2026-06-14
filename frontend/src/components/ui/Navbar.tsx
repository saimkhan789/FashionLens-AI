"use client";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const path = usePathname();
  const links = [
    { href: "/search", label: "Search" },
    { href: "/history", label: "History" },
    { href: "/favorites", label: "Saved" },
    { href: "/metrics", label: "Metrics" },
  ];

  return (
    <nav style={{
      borderBottom: "1px solid #E8E8E4",
      background: "#fff",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "0 24px",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <a href="/" style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 20,
          fontWeight: 600,
          color: "#1A1A1A",
        }}>
          FashionLens <span style={{ color: "#C8502A" }}>AI</span>
        </a>
        <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {links.map(l => (
            <a key={l.href} href={l.href} style={{
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: path === l.href ? "#C8502A" : "#888880",
              borderBottom: path === l.href ? "2px solid #C8502A" : "2px solid transparent",
              paddingBottom: 4,
              textDecoration: "none",
            }}>{l.label}</a>
          ))}
          <a href="/login" onClick={() => localStorage.removeItem("token")} style={{
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            color: "#888880",
            textDecoration: "none",
          }}>Logout</a>
        </div>
      </div>
    </nav>
  );
}