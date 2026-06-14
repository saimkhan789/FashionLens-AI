"use client";
import { useEffect, useState } from "react";
import api from "../../lib/api";
import Navbar from "../../components/ui/Navbar";

interface Metrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  confusion_matrix: number[][];
  categories: string[];
  total_evaluated: number;
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/metrics").then(r => setMetrics(r.data)).catch(() => setError("Run evaluate_model.py first."));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 24px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, marginBottom: 8 }}>Model Metrics</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 40 }}>
          {metrics ? `Evaluated on ${metrics.total_evaluated} samples` : "CLIP similarity evaluation results"}
        </p>

        {error && <p style={{ color: "var(--accent)" }}>{error}</p>}

        {metrics && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 48 }}>
              {[
                { label: "Accuracy", value: metrics.accuracy },
                { label: "Precision", value: metrics.precision },
                { label: "Recall", value: metrics.recall },
                { label: "F1 Score", value: metrics.f1 },
              ].map(m => (
                <div key={m.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 28, textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 600, color: "var(--accent)", marginBottom: 6 }}>
                    {(m.value * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--muted)" }}>{m.label}</div>
                </div>
              ))}
            </div>

            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, marginBottom: 20 }}>Confusion Matrix</h2>
            <div style={{ overflowX: "auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 24 }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--muted)", fontWeight: 500 }}>Actual \ Predicted</th>
                    {metrics.categories.map(c => (
                      <th key={c} style={{ padding: "8px 12px", color: "var(--muted)", fontWeight: 500, textTransform: "capitalize" }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.confusion_matrix.map((row, i) => (
                    <tr key={i}>
                      <td style={{ padding: "8px 12px", fontWeight: 500, textTransform: "capitalize", color: "var(--text)" }}>{metrics.categories[i]}</td>
                      {row.map((val, j) => (
                        <td key={j} style={{
                          padding: "8px 12px", textAlign: "center", borderRadius: 4,
                          background: i === j ? `rgba(200,80,42,${Math.min(val / 20, 0.8)})` : val > 0 ? `rgba(200,80,42,${Math.min(val / 10, 0.2)})` : "transparent",
                          color: i === j && val > 10 ? "#fff" : "var(--text)",
                          fontWeight: i === j ? 600 : 400,
                        }}>{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}