// The one glyph the UI uses: a small drawn heart for "save". Everything else is text.
export default function SaveGlyph({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
      <path
        d="M8 14 2.2 8.3a3.4 3.4 0 0 1 4.8-4.8L8 4.5l1-1a3.4 3.4 0 0 1 4.8 4.8z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
