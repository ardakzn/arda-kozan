import type { LocalizedText } from './i18n';

export interface Project {
  id: string;
  title: LocalizedText;
  slug: string;
  description: LocalizedText;
  summary: LocalizedText;
  thumbnail_image_url?: string;
  thumbnail_video_url?: string;
  links?: ProjectLink[];
  period_start?: LocalizedText;
  period_end?: LocalizedText;
  tags?: string[];
  tech_stack?: string[]; // Legacy alias for tags; still supported for existing data.
  featured: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectLink {
  label: LocalizedText;
  url: string;
  kind?: string;
}

export interface ContentBlock {
  id: string;
  title: LocalizedText;
  content: LocalizedText;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface CodeSnippet {
  id: string;
  project_id: string;
  title: LocalizedText;
  description: LocalizedText;
  code: string;
  // optional path to load code from `public/` (e.g. "/code/FancyButton.tsx")
  code_path?: string;
  language: string;
  order_index: number;
  created_at: string;
}

export interface CodeAnnotation {
  id: string;
  code_snippet_id: string;
  line_number: number;
  start_col: number;
  end_col: number;
  tooltip_title: LocalizedText;
  tooltip_content: LocalizedText;
  detail_type: string;
  detail_content: LocalizedText;
  created_at: string;
}

export interface ProjectWithDetails extends Project {
  // Snippets are stored globally in /data/snippets.json and embedded via @snippet(id, caption) in `description`.
  content_blocks?: ContentBlock[];
}
