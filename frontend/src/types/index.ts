export interface SearchResult {
  product_id: number;
  score: number;
  display_name: string;
  article_type: string;
  base_colour: string;
  gender: string;
  master_category: string;
  sub_category: string;
  image_path: string;
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