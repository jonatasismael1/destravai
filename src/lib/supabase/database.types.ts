export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      asaas_webhook_events: {
        Row: {
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          created_at: string
          event_id: string | null
          event_type: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          user_id: string | null
        }
        Insert: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          event_id?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          user_id?: string | null
        }
        Update: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          event_id?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      destravai_ai_conversations: {
        Row: {
          context_type: string | null
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context_type?: string | null
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          context_type?: string | null
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      destravai_ai_generations: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          input_data: Json | null
          model: string | null
          output_data: Json | null
          prompt_type: string
          status: string | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          model?: string | null
          output_data?: Json | null
          prompt_type: string
          status?: string | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          model?: string | null
          output_data?: Json | null
          prompt_type?: string
          status?: string | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      destravai_ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "destravai_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "destravai_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      destravai_brand_essence: {
        Row: {
          ai_positioning: string | null
          ai_summary: string | null
          audience: string | null
          common_objections: string[] | null
          content_goals: string | null
          created_at: string | null
          differentials: string | null
          frequent_questions: string[] | null
          id: string
          is_active: boolean | null
          niche: string | null
          phrases: string[] | null
          preferred_formats: string[] | null
          profession: string | null
          raw_answers_json: Json | null
          references_text: string | null
          restrictions: string[] | null
          routine: string | null
          services: string[] | null
          tone_of_voice: string | null
          topics: string[] | null
          updated_at: string | null
          user_id: string
          version: number | null
        }
        Insert: {
          ai_positioning?: string | null
          ai_summary?: string | null
          audience?: string | null
          common_objections?: string[] | null
          content_goals?: string | null
          created_at?: string | null
          differentials?: string | null
          frequent_questions?: string[] | null
          id?: string
          is_active?: boolean | null
          niche?: string | null
          phrases?: string[] | null
          preferred_formats?: string[] | null
          profession?: string | null
          raw_answers_json?: Json | null
          references_text?: string | null
          restrictions?: string[] | null
          routine?: string | null
          services?: string[] | null
          tone_of_voice?: string | null
          topics?: string[] | null
          updated_at?: string | null
          user_id: string
          version?: number | null
        }
        Update: {
          ai_positioning?: string | null
          ai_summary?: string | null
          audience?: string | null
          common_objections?: string[] | null
          content_goals?: string | null
          created_at?: string | null
          differentials?: string | null
          frequent_questions?: string[] | null
          id?: string
          is_active?: boolean | null
          niche?: string | null
          phrases?: string[] | null
          preferred_formats?: string[] | null
          profession?: string | null
          raw_answers_json?: Json | null
          references_text?: string | null
          restrictions?: string[] | null
          routine?: string | null
          services?: string[] | null
          tone_of_voice?: string | null
          topics?: string[] | null
          updated_at?: string | null
          user_id?: string
          version?: number | null
        }
        Relationships: []
      }
      destravai_calendar_items: {
        Row: {
          created_at: string
          day_key: string
          id: string
          idea_id: string
          idea_snapshot: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_key: string
          id?: string
          idea_id: string
          idea_snapshot: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_key?: string
          id?: string
          idea_id?: string
          idea_snapshot?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      destravai_daily_checkins: {
        Row: {
          checkin_key: string
          created_at: string
          daily_status: string
          day_key: string
          extras: Json
          id: string
          mission: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          checkin_key?: string
          created_at?: string
          daily_status?: string
          day_key: string
          extras?: Json
          id?: string
          mission?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          checkin_key?: string
          created_at?: string
          daily_status?: string
          day_key?: string
          extras?: Json
          id?: string
          mission?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      destravai_execution_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          ref_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          ref_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      destravai_journal_entries: {
        Row: {
          content: string
          created_at: string
          entry_date: string
          id: string
          mood: string
          tags: string[]
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          entry_date?: string
          id?: string
          mood?: string
          tags?: string[]
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          mood?: string
          tags?: string[]
          user_id?: string
        }
        Relationships: []
      }
      destravai_library_items: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          essence_id: string | null
          format: string | null
          id: string
          is_favorite: boolean | null
          metadata: Json | null
          source: string | null
          status: string | null
          tags: string[] | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          essence_id?: string | null
          format?: string | null
          id?: string
          is_favorite?: boolean | null
          metadata?: Json | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          essence_id?: string | null
          format?: string | null
          id?: string
          is_favorite?: boolean | null
          metadata?: Json | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "destravai_library_items_essence_id_fkey"
            columns: ["essence_id"]
            isOneToOne: false
            referencedRelation: "destravai_brand_essence"
            referencedColumns: ["id"]
          },
        ]
      }
      destravai_missions: {
        Row: {
          content: Json | null
          created_at: string
          description: string
          id: string
          mission_date: string
          points: number
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          description?: string
          id?: string
          mission_date?: string
          points?: number
          status?: string
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          description?: string
          id?: string
          mission_date?: string
          points?: number
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      destravai_personal_ideas: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      destravai_personal_space: {
        Row: {
          context: Json
          created_at: string
          today_mood: string | null
          today_mood_date: string | null
          today_mood_note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: Json
          created_at?: string
          today_mood?: string | null
          today_mood_date?: string | null
          today_mood_note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: Json
          created_at?: string
          today_mood?: string | null
          today_mood_date?: string | null
          today_mood_note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      destravai_plans: {
        Row: {
          asaas_identifier: string | null
          benefits: string[]
          created_at: string
          highlight: boolean
          id: string
          is_active: boolean
          monthly_price: number
          name: string
          short_description: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          asaas_identifier?: string | null
          benefits?: string[]
          created_at?: string
          highlight?: boolean
          id: string
          is_active?: boolean
          monthly_price: number
          name: string
          short_description?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          asaas_identifier?: string | null
          benefits?: string[]
          created_at?: string
          highlight?: boolean
          id?: string
          is_active?: boolean
          monthly_price?: number
          name?: string
          short_description?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      destravai_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          essence_completed: boolean | null
          id: string
          name: string | null
          onboarding_completed: boolean | null
          plan: string | null
          profession: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          essence_completed?: boolean | null
          id: string
          name?: string | null
          onboarding_completed?: boolean | null
          plan?: string | null
          profession?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          essence_completed?: boolean | null
          id?: string
          name?: string | null
          onboarding_completed?: boolean | null
          plan?: string | null
          profession?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      destravai_progress: {
        Row: {
          content_balance: Json
          created_at: string
          current_streak: number
          last_activity: string
          level: string
          missions_completed: number
          updated_at: string
          user_id: string
          week_key: string | null
          weekly_missions: number
        }
        Insert: {
          content_balance?: Json
          created_at?: string
          current_streak?: number
          last_activity?: string
          level?: string
          missions_completed?: number
          updated_at?: string
          user_id: string
          week_key?: string | null
          weekly_missions?: number
        }
        Update: {
          content_balance?: Json
          created_at?: string
          current_streak?: number
          last_activity?: string
          level?: string
          missions_completed?: number
          updated_at?: string
          user_id?: string
          week_key?: string | null
          weekly_missions?: number
        }
        Relationships: []
      }
      destravai_subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string | null
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string | null
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      destravai_usage_limits: {
        Row: {
          ai_generations_count: number | null
          created_at: string | null
          id: string
          library_generations_count: number | null
          period_end: string
          period_start: string
          scripts_count: number | null
          stories_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_generations_count?: number | null
          created_at?: string | null
          id?: string
          library_generations_count?: number | null
          period_end: string
          period_start: string
          scripts_count?: number | null
          stories_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_generations_count?: number | null
          created_at?: string | null
          id?: string
          library_generations_count?: number | null
          period_end?: string
          period_start?: string
          scripts_count?: number | null
          stories_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          access_email_sent: boolean
          access_granted: boolean
          access_granted_at: string | null
          asaas_customer_id: string | null
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          billing_cycle: string | null
          canceled_at: string | null
          created_at: string
          customer_document: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          last_webhook_event: string | null
          last_webhook_payload: Json | null
          payment_method: string | null
          payment_status: string
          pix_copy_paste: string | null
          pix_expiration: string | null
          pix_qr_code: string | null
          plan_id: string | null
          plan_name: string | null
          price: number | null
          refund_deadline: string | null
          refunded_at: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_email_sent?: boolean
          access_granted?: boolean
          access_granted_at?: string | null
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string | null
          canceled_at?: string | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_webhook_event?: string | null
          last_webhook_payload?: Json | null
          payment_method?: string | null
          payment_status?: string
          pix_copy_paste?: string | null
          pix_expiration?: string | null
          pix_qr_code?: string | null
          plan_id?: string | null
          plan_name?: string | null
          price?: number | null
          refund_deadline?: string | null
          refunded_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_email_sent?: boolean
          access_granted?: boolean
          access_granted_at?: string | null
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string | null
          canceled_at?: string | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_webhook_event?: string | null
          last_webhook_payload?: Json | null
          payment_method?: string | null
          payment_status?: string
          pix_copy_paste?: string | null
          pix_expiration?: string | null
          pix_qr_code?: string | null
          plan_id?: string | null
          plan_name?: string | null
          price?: number | null
          refund_deadline?: string | null
          refunded_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      destravai_find_user_id_by_email: {
        Args: { p_email: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
