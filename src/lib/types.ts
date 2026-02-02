export interface Generation {
  id: number;
  slug: string;
  prompt: string;
  model: string;
  provider: string;
  timestamp: string;
  date: string;
  image_path: string;
  thumb_path: string | null;
  generation_time_seconds: number | null;
  cost_estimate_usd: number | null;
  seed: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  parent_id: number | null;
  starred: boolean;
  created_at: string;
  trashed_at: string | null;
  title: string | null;
  tags: string[];
  references: Reference[];
}

export interface GenerateParams {
  prompt: string;
  model: string;
  tags: string[];
  reference_paths: string[];
  copy_to: string | null;
}

export interface ListFilter {
  limit?: number;
  offset?: number;
  tag?: string;
  model?: string;
  starred_only?: boolean;
  search?: string;
  since?: string;
}

export interface TagCount {
  name: string;
  count: number;
}

export interface ModelInfo {
  id: string;
  provider: string;
  display_name: string;
  cost_per_image: number;
}

export interface CostSummary {
  total_usd: number;
  by_model: [string, number][];
  by_day: [string, number][];
  count: number;
}

export interface Reference {
  id: number;
  hash: string;
  path: string;
  created_at: string;
}
