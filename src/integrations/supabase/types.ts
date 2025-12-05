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
      jobsite_photos: {
        Row: {
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          request_id: string | null
          uploaded_at: string
        }
        Insert: {
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          request_id?: string | null
          uploaded_at?: string
        }
        Update: {
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          request_id?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobsite_photos_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "video_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      kie_video_generations: {
        Row: {
          ai_prompt: string | null
          aspect_ratio: string | null
          audio_enabled: boolean | null
          avatar_name: string
          city: string
          created_at: string | null
          current_scene: number | null
          duration: number | null
          extended_completed_at: string | null
          extended_error: string | null
          extended_status: string | null
          extended_task_id: string | null
          extended_video_url: string | null
          final_video_completed_at: string | null
          final_video_error: string | null
          final_video_response_url: string | null
          final_video_status: string | null
          final_video_status_url: string | null
          final_video_task_id: string | null
          final_video_url: string | null
          id: string
          image_url: string
          industry: string
          initial_completed_at: string | null
          initial_error: string | null
          initial_status: string | null
          initial_task_id: string | null
          initial_video_url: string | null
          is_final: boolean | null
          is_multi_scene: boolean | null
          metadata: Json | null
          model: string | null
          number_of_scenes: number | null
          resolution: string | null
          scene_prompts: Json | null
          script: string | null
          seeds: number | null
          sora_model: string | null
          story_idea: string | null
          user_id: string
          video_segments: Json | null
          watermark: string | null
        }
        Insert: {
          ai_prompt?: string | null
          aspect_ratio?: string | null
          audio_enabled?: boolean | null
          avatar_name: string
          city: string
          created_at?: string | null
          current_scene?: number | null
          duration?: number | null
          extended_completed_at?: string | null
          extended_error?: string | null
          extended_status?: string | null
          extended_task_id?: string | null
          extended_video_url?: string | null
          final_video_completed_at?: string | null
          final_video_error?: string | null
          final_video_response_url?: string | null
          final_video_status?: string | null
          final_video_status_url?: string | null
          final_video_task_id?: string | null
          final_video_url?: string | null
          id?: string
          image_url: string
          industry: string
          initial_completed_at?: string | null
          initial_error?: string | null
          initial_status?: string | null
          initial_task_id?: string | null
          initial_video_url?: string | null
          is_final?: boolean | null
          is_multi_scene?: boolean | null
          metadata?: Json | null
          model?: string | null
          number_of_scenes?: number | null
          resolution?: string | null
          scene_prompts?: Json | null
          script?: string | null
          seeds?: number | null
          sora_model?: string | null
          story_idea?: string | null
          user_id: string
          video_segments?: Json | null
          watermark?: string | null
        }
        Update: {
          ai_prompt?: string | null
          aspect_ratio?: string | null
          audio_enabled?: boolean | null
          avatar_name?: string
          city?: string
          created_at?: string | null
          current_scene?: number | null
          duration?: number | null
          extended_completed_at?: string | null
          extended_error?: string | null
          extended_status?: string | null
          extended_task_id?: string | null
          extended_video_url?: string | null
          final_video_completed_at?: string | null
          final_video_error?: string | null
          final_video_response_url?: string | null
          final_video_status?: string | null
          final_video_status_url?: string | null
          final_video_task_id?: string | null
          final_video_url?: string | null
          id?: string
          image_url?: string
          industry?: string
          initial_completed_at?: string | null
          initial_error?: string | null
          initial_status?: string | null
          initial_task_id?: string | null
          initial_video_url?: string | null
          is_final?: boolean | null
          is_multi_scene?: boolean | null
          metadata?: Json | null
          model?: string | null
          number_of_scenes?: number | null
          resolution?: string | null
          scene_prompts?: Json | null
          script?: string | null
          seeds?: number | null
          sora_model?: string | null
          story_idea?: string | null
          user_id?: string
          video_segments?: Json | null
          watermark?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      request_selected_photos: {
        Row: {
          created_at: string
          id: string
          photo_id: string
          request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_id: string
          request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_selected_photos_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "jobsite_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_selected_photos_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "video_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_templates: {
        Row: {
          aspect_ratio: Database["public"]["Enums"]["aspect_ratio"] | null
          caption: string | null
          category: string | null
          character: string | null
          city_community: string | null
          client_company_name: string | null
          colors: string | null
          company_type: Database["public"]["Enums"]["company_type"] | null
          created_at: string
          description: string | null
          gender_avatar: Database["public"]["Enums"]["gender_avatar"] | null
          id: string
          is_system_template: boolean
          name: string
          render_mode: Database["public"]["Enums"]["render_mode_v2"] | null
          scenes: number | null
          special_request: string | null
          story_idea: string | null
          title: string | null
          updated_at: string
          user_id: string | null
          visual_style: Database["public"]["Enums"]["visual_style"] | null
        }
        Insert: {
          aspect_ratio?: Database["public"]["Enums"]["aspect_ratio"] | null
          caption?: string | null
          category?: string | null
          character?: string | null
          city_community?: string | null
          client_company_name?: string | null
          colors?: string | null
          company_type?: Database["public"]["Enums"]["company_type"] | null
          created_at?: string
          description?: string | null
          gender_avatar?: Database["public"]["Enums"]["gender_avatar"] | null
          id?: string
          is_system_template?: boolean
          name: string
          render_mode?: Database["public"]["Enums"]["render_mode_v2"] | null
          scenes?: number | null
          special_request?: string | null
          story_idea?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          visual_style?: Database["public"]["Enums"]["visual_style"] | null
        }
        Update: {
          aspect_ratio?: Database["public"]["Enums"]["aspect_ratio"] | null
          caption?: string | null
          category?: string | null
          character?: string | null
          city_community?: string | null
          client_company_name?: string | null
          colors?: string | null
          company_type?: Database["public"]["Enums"]["company_type"] | null
          created_at?: string
          description?: string | null
          gender_avatar?: Database["public"]["Enums"]["gender_avatar"] | null
          id?: string
          is_system_template?: boolean
          name?: string
          render_mode?: Database["public"]["Enums"]["render_mode_v2"] | null
          scenes?: number | null
          special_request?: string | null
          story_idea?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          visual_style?: Database["public"]["Enums"]["visual_style"] | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_requests: {
        Row: {
          aspect_ratio: Database["public"]["Enums"]["aspect_ratio"] | null
          caption: string | null
          character: string
          city_community: string
          client_company_name: string
          colors: string | null
          company_type: Database["public"]["Enums"]["company_type"]
          completed_at: string | null
          created_at: string
          gender_avatar: Database["public"]["Enums"]["gender_avatar"] | null
          id: string
          render_mode: Database["public"]["Enums"]["render_mode_v2"] | null
          scenes: number | null
          special_request: string | null
          status: Database["public"]["Enums"]["request_status"]
          story_idea: string | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
          visual_style: Database["public"]["Enums"]["visual_style"] | null
        }
        Insert: {
          aspect_ratio?: Database["public"]["Enums"]["aspect_ratio"] | null
          caption?: string | null
          character: string
          city_community: string
          client_company_name: string
          colors?: string | null
          company_type: Database["public"]["Enums"]["company_type"]
          completed_at?: string | null
          created_at?: string
          gender_avatar?: Database["public"]["Enums"]["gender_avatar"] | null
          id?: string
          render_mode?: Database["public"]["Enums"]["render_mode_v2"] | null
          scenes?: number | null
          special_request?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          story_idea?: string | null
          title?: string
          updated_at?: string
          user_id: string
          video_url?: string | null
          visual_style?: Database["public"]["Enums"]["visual_style"] | null
        }
        Update: {
          aspect_ratio?: Database["public"]["Enums"]["aspect_ratio"] | null
          caption?: string | null
          character?: string
          city_community?: string
          client_company_name?: string
          colors?: string | null
          company_type?: Database["public"]["Enums"]["company_type"]
          completed_at?: string | null
          created_at?: string
          gender_avatar?: Database["public"]["Enums"]["gender_avatar"] | null
          id?: string
          render_mode?: Database["public"]["Enums"]["render_mode_v2"] | null
          scenes?: number | null
          special_request?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          story_idea?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
          visual_style?: Database["public"]["Enums"]["visual_style"] | null
        }
        Relationships: [
          {
            foreignKeyName: "video_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      aspect_ratio: "16:9" | "9:16"
      company_type:
        | "roofing"
        | "gutter"
        | "christmas_lights"
        | "landscaping"
        | "painting"
        | "other"
        | "power_washing"
      gender_avatar: "male" | "female" | "neutral"
      render_mode: "fast" | "quality"
      render_mode_v2: "veo3" | "veo3_fast"
      request_status: "queued" | "processing" | "completed" | "failed"
      user_role: "admin" | "manager" | "editor" | "contributor"
      visual_style: "realistic" | "cartoonized"
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
      aspect_ratio: ["16:9", "9:16"],
      company_type: [
        "roofing",
        "gutter",
        "christmas_lights",
        "landscaping",
        "painting",
        "other",
        "power_washing",
      ],
      gender_avatar: ["male", "female", "neutral"],
      render_mode: ["fast", "quality"],
      render_mode_v2: ["veo3", "veo3_fast"],
      request_status: ["queued", "processing", "completed", "failed"],
      user_role: ["admin", "manager", "editor", "contributor"],
      visual_style: ["realistic", "cartoonized"],
    },
  },
} as const
