// An uploaded/pasted photo can't travel in a URL, so the landing page parks it here
// and the search page picks it up after client-side navigation.
let pendingImage: File | null = null;

export function setPendingImage(file: File) {
  pendingImage = file;
}

export function takePendingImage(): File | null {
  const file = pendingImage;
  pendingImage = null;
  return file;
}
