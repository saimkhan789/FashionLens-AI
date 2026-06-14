import api from "../lib/api";

export async function textSearch(q: string, top_k = 10) {
  const res = await api.get("/search/text", { params: { q, top_k } });
  return res.data;
}

export async function imageSearch(file: File, top_k = 10) {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post(`/search/image?top_k=${top_k}`, form);
  return res.data;
}