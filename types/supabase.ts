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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      exercise_progress_state: {
        Row: {
          exercise_id: string
          next_goal_type: string | null
          next_target_weight: number | null
          updated_at: string
          user_id: string
          variant_key: string
        }
        Insert: {
          exercise_id: string
          next_goal_type?: string | null
          next_target_weight?: number | null
          updated_at?: string
          user_id: string
          variant_key?: string
        }
        Update: {
          exercise_id?: string
          next_goal_type?: string | null
          next_target_weight?: number | null
          updated_at?: string
          user_id?: string
          variant_key?: string
        }
        Relationships: []
      }
      user_exercises: {
        Row: {
          id: string
          user_id: string
          name: string
          category: string
          equipment: string[]
          movement_type: string
          force_type: string
          overload_category: string
          laterality: string | null
          load_entry_mode: string
          base_movement_id: string | null
          aliases: string[]
          muscles: unknown
          description: string | null
          tips: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          category: string
          equipment?: string[]
          movement_type: string
          force_type: string
          overload_category?: string
          laterality?: string | null
          load_entry_mode?: string
          base_movement_id?: string | null
          aliases?: string[]
          muscles?: unknown
          description?: string | null
          tips?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          category?: string
          equipment?: string[]
          movement_type?: string
          force_type?: string
          overload_category?: string
          laterality?: string | null
          load_entry_mode?: string
          base_movement_id?: string | null
          aliases?: string[]
          muscles?: unknown
          description?: string | null
          tips?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      nutrition_logs: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          date: string
          fat: number
          id: string
          protein: number
          updated_at: string
          user_id: string
          water: number
        }
        Insert: {
          calories?: number
          carbs?: number
          created_at?: string
          date: string
          fat?: number
          id: string
          protein?: number
          updated_at?: string
          user_id: string
          water?: number
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          date?: string
          fat?: number
          id?: string
          protein?: number
          updated_at?: string
          user_id?: string
          water?: number
        }
        Relationships: []
      }
      nutrition_meals: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          fat: number
          image_uri: string | null
          log_date: string
          meal_id: string
          meal_type: string
          name: string
          protein: number
          time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          image_uri?: string | null
          log_date: string
          meal_id?: string
          meal_type?: string
          name: string
          protein?: number
          time?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          image_uri?: string | null
          log_date?: string
          meal_id?: string
          meal_type?: string
          name?: string
          protein?: number
          time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_nutrition_meals_log"
            columns: ["user_id", "log_date"]
            isOneToOne: false
            referencedRelation: "nutrition_logs"
            referencedColumns: ["user_id", "date"]
          },
        ]
      }
      prompts: {
        Row: {
          category: string | null
          created_at: string
          date_added: string
          full_text: string
          id: string
          source: string
          source_url: string
          summary: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          date_added?: string
          full_text: string
          id?: string
          source: string
          source_url: string
          summary: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          date_added?: string
          full_text?: string
          id?: string
          source?: string
          source_url?: string
          summary?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_foods: {
        Row: {
          brand: string | null
          calories: number
          carbs: number
          created_at: string
          fat: number
          id: string
          last_used: string
          name: string
          protein: number
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          brand?: string | null
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          id?: string
          last_used?: string
          name: string
          protein?: number
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          brand?: string | null
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          id?: string
          last_used?: string
          name?: string
          protein?: number
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      saved_routines: {
        Row: {
          created_at: string
          exercises_json: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exercises_json?: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exercises_json?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          daily_calories_goal: number
          daily_carbs_goal: number
          daily_fat_goal: number
          daily_goals: Json | null
          daily_protein_goal: number
          daily_water_goal: number
          default_rest_timer: number | null
          default_rest_timer_enabled: boolean | null
          notifications_enabled: boolean
          rest_timer_sound: boolean
          training_settings: Json | null
          updated_at: string
          user_id: string
          volume_unit: string
          weight_unit: string
        }
        Insert: {
          created_at?: string
          daily_calories_goal?: number
          daily_carbs_goal?: number
          daily_fat_goal?: number
          daily_goals?: Json | null
          daily_protein_goal?: number
          daily_water_goal?: number
          default_rest_timer?: number | null
          default_rest_timer_enabled?: boolean | null
          notifications_enabled?: boolean
          rest_timer_sound?: boolean
          training_settings?: Json | null
          updated_at?: string
          user_id: string
          volume_unit?: string
          weight_unit?: string
        }
        Update: {
          created_at?: string
          daily_calories_goal?: number
          daily_carbs_goal?: number
          daily_fat_goal?: number
          daily_goals?: Json | null
          daily_protein_goal?: number
          daily_water_goal?: number
          default_rest_timer?: number | null
          default_rest_timer_enabled?: boolean | null
          notifications_enabled?: boolean
          rest_timer_sound?: boolean
          training_settings?: Json | null
          updated_at?: string
          user_id?: string
          volume_unit?: string
          weight_unit?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          created_at: string
          default_target_rpe: number | null
          exercise_db_id: string | null
          id: string
          name: string
          notes: string | null
          rep_range_high: number | null
          rep_range_low: number | null
          rest_timer: number | null
          session_id: string
          smallest_increment: number | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_target_rpe?: number | null
          exercise_db_id?: string | null
          id?: string
          name: string
          notes?: string | null
          rep_range_high?: number | null
          rep_range_low?: number | null
          rest_timer?: number | null
          session_id: string
          smallest_increment?: number | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_target_rpe?: number | null
          exercise_db_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          rep_range_high?: number | null
          rep_range_low?: number | null
          rest_timer?: number | null
          session_id?: string
          smallest_increment?: number | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_posts: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_path: string | null
          session_id: string
          title: string | null
          updated_at: string | null
          user_id: string
          visibility: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_path?: string | null
          session_id: string
          title?: string | null
          updated_at?: string | null
          user_id: string
          visibility?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_path?: string | null
          session_id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_posts_user_id_session_id_fkey"
            columns: ["user_id", "session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          created_at: string
          duration: number
          id: string
          is_complete: boolean
          name: string
          updated_at: string
          user_id: string
          workout_time: string
        }
        Insert: {
          created_at?: string
          duration?: number
          id?: string
          is_complete?: boolean
          name: string
          updated_at?: string
          user_id: string
          workout_time?: string
        }
        Update: {
          created_at?: string
          duration?: number
          id?: string
          is_complete?: boolean
          name?: string
          updated_at?: string
          user_id?: string
          workout_time?: string
        }
        Relationships: []
      }
      workout_sets: {
        Row: {
          completed: boolean
          created_at: string
          exercise_id: string
          id: string
          notes: string | null
          notes_visibility: string | null
          reps: number
          rpe: number | null
          session_id: string
          set_number: number | null
          set_order: number
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          completed?: boolean
          created_at?: string
          exercise_id: string
          id?: string
          notes?: string | null
          notes_visibility?: string | null
          reps?: number
          rpe?: number | null
          session_id: string
          set_number?: number | null
          set_order?: number
          updated_at?: string
          user_id: string
          weight?: number
        }
        Update: {
          completed?: boolean
          created_at?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          notes_visibility?: string | null
          reps?: number
          rpe?: number | null
          session_id?: string
          set_number?: number | null
          set_order?: number
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_streaks: {
        Row: {
          created_at: string
          exempt_week: string | null
          last_workout_at: string | null
          last_workout_ymd: string | null
          streak_dead: boolean
          streak_start_ymd: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exempt_week?: string | null
          last_workout_at?: string | null
          last_workout_ymd?: string | null
          streak_dead?: boolean
          streak_start_ymd?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exempt_week?: string | null
          last_workout_at?: string | null
          last_workout_ymd?: string | null
          streak_dead?: boolean
          streak_start_ymd?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
