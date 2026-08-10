export interface SearchResult {
  product_id: string;
  score: number;
  display_name: string;
  article_type: string;
  base_colour: string;
  gender: string;
  master_category: string;
  sub_category: string;
  image_path: string;
  source?: string;
  brand?: string;
  price?: string;
  product_url?: string;
  image_url?: string;
}

export interface HistoryEntry {
  query: string;
  query_type: string;
  results: SearchResult[];
  created_at: string;
}

export interface FavoriteItem {
  product_id: number;
  display_name: string;
  article_type: string;
  base_colour: string;
  gender: string;
  image_path: string;
}