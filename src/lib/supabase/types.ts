export interface DestravaiProfile {
  id: string
  name: string | null
  email: string | null
  profession: string | null
  avatar_url: string | null
  plan: string
  onboarding_completed: boolean
  essence_completed: boolean
  created_at: string
  updated_at: string
}

export interface BrandEssence {
  id: string
  user_id: string
  profession: string | null
  niche: string | null
  audience: string | null
  tone_of_voice: string | null
  content_goals: string | null
  routine: string | null
  preferred_formats: string[] | null
  topics: string[] | null
  restrictions: string[] | null
  differentials: string | null
  services: string[] | null
  frequent_questions: string[] | null
  common_objections: string[] | null
  phrases: string[] | null
  references_text: string | null
  raw_answers_json: Record<string, unknown> | null
  ai_summary: string | null
  ai_positioning: string | null
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LibraryItem {
  id: string
  user_id: string
  essence_id: string | null
  type: LibraryItemType
  title: string
  content: string
  category: string | null
  format: string | null
  status: 'saved' | 'done' | 'archived'
  source: 'ai' | 'manual'
  tags: string[] | null
  metadata: Record<string, unknown> | null
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export type LibraryItemType =
  | 'story_sequence'
  | 'reels_script'
  | 'caption'
  | 'hook'
  | 'cta'
  | 'content_idea'
  | 'objection_answer'
  | 'routine_prompt'
  | 'daily_prompt'
  | 'carousel_idea'
  | 'static_post_idea'

export interface AiConversation {
  id: string
  user_id: string
  title: string | null
  context_type: string | null
  created_at: string
  updated_at: string
}

export interface AiMessage {
  id: string
  conversation_id: string
  user_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AiGeneration {
  id: string
  user_id: string
  prompt_type: string
  input_data: Record<string, unknown> | null
  output_data: Record<string, unknown> | null
  model: string | null
  tokens_used: number | null
  status: 'success' | 'error'
  error_message: string | null
  created_at: string
}

export interface UsageLimits {
  id: string
  user_id: string
  period_start: string
  period_end: string
  ai_generations_count: number
  library_generations_count: number
  scripts_count: number
  stories_count: number
  created_at: string
  updated_at: string
}
