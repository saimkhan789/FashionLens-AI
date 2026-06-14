import api from "../lib/api";

export async function getFavorites() {
  const res = await api.get("/favorites");
  return res.data;
}

export async function addFavorite(product_id: number) {
  const res = await api.post("/favorites", { product_id: Number(product_id) });
  return res.data;
}

export async function removeFavorite(product_id: number) {
  const res = await api.delete(`/favorites/${product_id}`);
  return res.data;
}