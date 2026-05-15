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
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          app_name: string
          hero_description: string
          hero_title: string
          id: number
          logo_url: string | null
          tagline: string
          updated_at: string
        }
        Insert: {
          app_name?: string
          hero_description?: string
          hero_title?: string
          id?: number
          logo_url?: string | null
          tagline?: string
          updated_at?: string
        }
        Update: {
          app_name?: string
          hero_description?: string
          hero_title?: string
          id?: number
          logo_url?: string | null
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_articles: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_articles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_evaluations: {
        Row: {
          area: string
          comment: string | null
          created_at: string
          description: string | null
          id: string
          order_index: number
          plan_id: string
          rating_30: number | null
          rating_60: number | null
          rating_90: number | null
          updated_at: string
        }
        Insert: {
          area: string
          comment?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          plan_id: string
          rating_30?: number | null
          rating_60?: number | null
          rating_90?: number | null
          updated_at?: string
        }
        Update: {
          area?: string
          comment?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          plan_id?: string
          rating_30?: number | null
          rating_60?: number | null
          rating_90?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_evaluations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "onboarding_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_expectations: {
        Row: {
          area: string
          created_at: string
          id: string
          order_index: number
          plan_id: string
          updated_at: string
          value_30: string | null
          value_60: string | null
          value_90: string | null
        }
        Insert: {
          area: string
          created_at?: string
          id?: string
          order_index?: number
          plan_id: string
          updated_at?: string
          value_30?: string | null
          value_60?: string | null
          value_90?: string | null
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          order_index?: number
          plan_id?: string
          updated_at?: string
          value_30?: string | null
          value_60?: string | null
          value_90?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_expectations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "onboarding_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_history: {
        Row: {
          completed_at: string
          completed_by: string | null
          id: string
          plan_id: string | null
          profile_id: string
          snapshot: Json
          summary: string | null
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          id?: string
          plan_id?: string | null
          profile_id: string
          snapshot: Json
          summary?: string | null
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          id?: string
          plan_id?: string | null
          profile_id?: string
          snapshot?: Json
          summary?: string | null
        }
        Relationships: []
      }
      onboarding_plans: {
        Row: {
          created_at: string
          id: string
          intern_position: string | null
          point_of_contact: string | null
          profile_id: string
          senior_name: string | null
          supervisor_name: string | null
          updated_at: string
          welcome_message: string
        }
        Insert: {
          created_at?: string
          id?: string
          intern_position?: string | null
          point_of_contact?: string | null
          profile_id: string
          senior_name?: string | null
          supervisor_name?: string | null
          updated_at?: string
          welcome_message?: string
        }
        Update: {
          created_at?: string
          id?: string
          intern_position?: string | null
          point_of_contact?: string | null
          profile_id?: string
          senior_name?: string | null
          supervisor_name?: string | null
          updated_at?: string
          welcome_message?: string
        }
        Relationships: []
      }
      onboarding_progress: {
        Row: {
          checkpoint: number
          created_at: string
          id: string
          note: string | null
          order_index: number
          plan_id: string
          status: string
          updated_at: string
        }
        Insert: {
          checkpoint: number
          created_at?: string
          id?: string
          note?: string | null
          order_index?: number
          plan_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          checkpoint?: number
          created_at?: string
          id?: string
          note?: string | null
          order_index?: number
          plan_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "onboarding_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_reflections: {
        Row: {
          answer: string | null
          checkpoint: number
          created_at: string
          id: string
          order_index: number
          plan_id: string
          question: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          checkpoint: number
          created_at?: string
          id?: string
          order_index?: number
          plan_id: string
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          checkpoint?: number
          created_at?: string
          id?: string
          order_index?: number
          plan_id?: string
          question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_reflections_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "onboarding_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_sections: {
        Row: {
          body: string
          created_at: string
          id: string
          order_index: number
          plan_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          order_index?: number
          plan_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          order_index?: number
          plan_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_sections_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "onboarding_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          order_index: number
          profile_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          profile_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          profile_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          created_at: string
          department: string | null
          id: string
          name: string
          priority: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          id?: string
          name: string
          priority?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          id?: string
          name?: string
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          job_title: string | null
          manager_id: string | null
          mentor_id: string | null
          onboarded: boolean
          start_date: string | null
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id: string
          job_title?: string | null
          manager_id?: string | null
          mentor_id?: string | null
          onboarded?: boolean
          start_date?: string | null
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          manager_id?: string | null
          mentor_id?: string | null
          onboarded?: boolean
          start_date?: string | null
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_assignments: {
        Row: {
          assigned_at: string
          completed_at: string | null
          id: string
          material_id: string
          profile_id: string
          status: string
        }
        Insert: {
          assigned_at?: string
          completed_at?: string | null
          id?: string
          material_id: string
          profile_id: string
          status?: string
        }
        Update: {
          assigned_at?: string
          completed_at?: string | null
          id?: string
          material_id?: string
          profile_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_assignments_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "training_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_materials: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          material_type: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          material_type?: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          material_type?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
