import api from "../lib/api";

export async function getHistory() {
  const res = await api.get("/history");
  return res.data;
}