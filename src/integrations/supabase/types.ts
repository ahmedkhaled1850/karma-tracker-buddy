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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      daily_changes: {
        Row: {
          change_amount: number
          change_date: string
          change_time: string | null
          created_at: string
          field_name: string
          id: string
          new_value: number
          old_value: number
          performance_id: string
          user_id: string | null
        }
        Insert: {
          change_amount: number
          change_date: string
          change_time?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value: number
          old_value: number
          performance_id: string
          user_id?: string | null
        }
        Update: {
          change_amount?: number
          change_date?: string
          change_time?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: number
          old_value?: number
          performance_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_changes_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "performance_data"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          note_date: string
          performance_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          note_date?: string
          performance_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          note_date?: string
          performance_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_notes_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "performance_data"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_survey_calls: {
        Row: {
          call_date: string
          created_at: string
          id: string
          surveys_sent: number
          total_calls: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          call_date?: string
          created_at?: string
          id?: string
          surveys_sent?: number
          total_calls?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          call_date?: string
          created_at?: string
          id?: string
          surveys_sent?: number
          total_calls?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      genesys_tickets: {
        Row: {
          created_at: string
          customer_phone: string | null
          id: string
          performance_id: string
          rating_score: number | null
          ticket_date: string
          ticket_link: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_phone?: string | null
          id?: string
          performance_id: string
          rating_score?: number | null
          ticket_date?: string
          ticket_link: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_phone?: string | null
          id?: string
          performance_id?: string
          rating_score?: number | null
          ticket_date?: string
          ticket_link?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "genesys_tickets_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "performance_data"
            referencedColumns: ["id"]
          },
        ]
      }
      hold_tickets: {
        Row: {
          completed_at: string | null
          created_at: string
          hold_hours: number
          hold_start: string
          id: string
          is_completed: boolean
          performance_id: string
          reason: string | null
          ticket_link: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          hold_hours?: number
          hold_start?: string
          id?: string
          is_completed?: boolean
          performance_id: string
          reason?: string | null
          ticket_link: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          hold_hours?: number
          hold_start?: string
          id?: string
          is_completed?: boolean
          performance_id?: string
          reason?: string | null
          ticket_link?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hold_tickets_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "performance_data"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_data: {
        Row: {
          bad: number
          created_at: string
          fcr: number | null
          genesys_bad: number
          genesys_good: number
          good: number
          good_chat: number
          good_email: number
          good_phone: number
          id: string
          karma_bad: number
          month: number
          off_days: number[] | null
          updated_at: string
          user_id: string | null
          year: number
        }
        Insert: {
          bad?: number
          created_at?: string
          fcr?: number | null
          genesys_bad?: number
          genesys_good?: number
          good?: number
          good_chat?: number
          good_email?: number
          good_phone?: number
          id?: string
          karma_bad?: number
          month: number
          off_days?: number[] | null
          updated_at?: string
          user_id?: string | null
          year: number
        }
        Update: {
          bad?: number
          created_at?: string
          fcr?: number | null
          genesys_bad?: number
          genesys_good?: number
          good?: number
          good_chat?: number
          good_email?: number
          good_phone?: number
          id?: string
          karma_bad?: number
          month?: number
          off_days?: number[] | null
          updated_at?: string
          user_id?: string | null
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          channel: string
          created_at: string
          id: string
          note: string | null
          performance_id: string
          ticket_id: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          note?: string | null
          performance_id: string
          ticket_id: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          note?: string | null
          performance_id?: string
          ticket_id?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "performance_data"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          break1_time: string | null
          break2_time: string | null
          break3_time: string | null
          created_at: string
          id: string
          shift_start_time: string | null
          updated_at: string
          user_id: string
          work_days: Json | null
        }
        Insert: {
          break1_time?: string | null
          break2_time?: string | null
          break3_time?: string | null
          created_at?: string
          id?: string
          shift_start_time?: string | null
          updated_at?: string
          user_id: string
          work_days?: Json | null
        }
        Update: {
          break1_time?: string | null
          break2_time?: string | null
          break3_time?: string | null
          created_at?: string
          id?: string
          shift_start_time?: string | null
          updated_at?: string
          user_id?: string
          work_days?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
