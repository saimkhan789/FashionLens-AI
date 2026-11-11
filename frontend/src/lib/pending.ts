// An uploaded or pasted photo can't travel in a URL, so it waits here under a stamp
// that goes in the URL (/search?photo=<stamp>). Reading doesn't clear it, so React
// can render twice safely; the next upload replaces it.
let pending: { stamp: string; file: File } | null = null;

export function setPendingImage(file: File): string {
  const stamp = `${Date.now()}`;
  pending = { stamp, file };
  return stamp;
}

export function getPendingImage(stamp: string): File | null {
  return pending && pending.stamp === stamp ? pending.file : null;
}
