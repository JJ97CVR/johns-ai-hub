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
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          changes: Json | null
          created_at: string
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      ai_response_cache: {
        Row: {
          citations: Json | null
          confidence_score: number | null
          created_at: string | null
          expires_at: string | null
          hit_count: number | null
          id: string
          last_accessed_at: string | null
          mode: string
          model: string
          query_hash: string
          query_text: string
          response_content: string
          tools_used: string[] | null
        }
        Insert: {
          citations?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          last_accessed_at?: string | null
          mode: string
          model: string
          query_hash: string
          query_text: string
          response_content: string
          tools_used?: string[] | null
        }
        Update: {
          citations?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          last_accessed_at?: string | null
          mode?: string
          model?: string
          query_hash?: string
          query_text?: string
          response_content?: string
          tools_used?: string[] | null
        }
        Relationships: []
      }
      analytics_queue: {
        Row: {
          conversation_id: string | null
          created_at: string
          error: string | null
          event_data: Json
          event_type: string
          id: string
          processed_at: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          event_data: Json
          event_type: string
          id?: string
          processed_at?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          processed_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      code_executions: {
        Row: {
          code: string
          created_at: string | null
          error: string | null
          execution_time_ms: number | null
          id: string
          language: string | null
          message_id: string
          output: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          error?: string | null
          execution_time_ms?: number | null
          id?: string
          language?: string | null
          message_id: string
          output?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          error?: string | null
          execution_time_ms?: number | null
          id?: string
          language?: string | null
          message_id?: string
          output?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "code_executions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_promotions: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          importance_score: number | null
          message_id: string
          promoted_to_kb: boolean | null
          promotion_reason: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          importance_score?: number | null
          message_id: string
          promoted_to_kb?: boolean | null
          promotion_reason?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          importance_score?: number | null
          message_id?: string
          promoted_to_kb?: boolean | null
          promotion_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_promotions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_promotions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          model: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          model?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          model?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          config: Json | null
          created_at: string
          description: string | null
          enabled: boolean
          flag_key: string
          id: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key: string
          id?: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          category: string | null
          confidence_score: number | null
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          source: string | null
          title: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          confidence_score?: number | null
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source?: string | null
          title: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          confidence_score?: number | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source?: string | null
          title?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      learned_patterns: {
        Row: {
          answer_template: string
          created_at: string | null
          embedding: string | null
          example_questions: string[] | null
          id: string
          last_used: string | null
          question_pattern: string
          success_rate: number | null
          usage_count: number | null
        }
        Insert: {
          answer_template: string
          created_at?: string | null
          embedding?: string | null
          example_questions?: string[] | null
          id?: string
          last_used?: string | null
          question_pattern: string
          success_rate?: number | null
          usage_count?: number | null
        }
        Update: {
          answer_template?: string
          created_at?: string | null
          embedding?: string | null
          example_questions?: string[] | null
          id?: string
          last_used?: string | null
          question_pattern?: string
          success_rate?: number | null
          usage_count?: number | null
        }
        Relationships: []
      }
      loop_checkpoints: {
        Row: {
          conversation_id: string | null
          created_at: string
          expires_at: string
          id: string
          iteration: number
          partial_content: string | null
          request_id: string
          state: Json
          tools_used: string[] | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          iteration?: number
          partial_content?: string | null
          request_id: string
          state?: Json
          tools_used?: string[] | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          iteration?: number
          partial_content?: string | null
          request_id?: string
          state?: Json
          tools_used?: string[] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loop_checkpoints_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_feedback: {
        Row: {
          comment: string | null
          created_at: string | null
          helpful: boolean
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          helpful: boolean
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          helpful?: boolean
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          citations: Json | null
          content: string
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          role: string
          thinking_process: string | null
          tools_used: string[] | null
        }
        Insert: {
          citations?: Json | null
          content: string
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          role: string
          thinking_process?: string | null
          tools_used?: string[] | null
        }
        Update: {
          citations?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          role?: string
          thinking_process?: string | null
          tools_used?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      model_rate_limits: {
        Row: {
          created_at: string
          id: string
          model: string
          request_count: number | null
          user_id: string | null
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          model: string
          request_count?: number | null
          user_id?: string | null
          window_start: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          request_count?: number | null
          user_id?: string | null
          window_start?: string
        }
        Relationships: []
      }
      organization_facts: {
        Row: {
          confidence: number | null
          created_at: string | null
          description: string | null
          fact_type: string
          id: string
          key: string
          source: string | null
          updated_at: string | null
          value: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          fact_type: string
          id?: string
          key: string
          source?: string | null
          updated_at?: string | null
          value: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          fact_type?: string
          id?: string
          key?: string
          source?: string | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      quality_signals: {
        Row: {
          created_at: string | null
          id: string
          message_id: string
          signal_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id: string
          signal_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_signals_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      query_analytics: {
        Row: {
          assistant_message_id: string | null
          cache_hit: boolean | null
          conversation_id: string | null
          created_at: string | null
          entities_used: Json | null
          id: string
          knowledge_used: string[] | null
          model_used: string | null
          processing_time_ms: number | null
          provider: string | null
          query: string
          query_hash: string | null
          query_type: string | null
          rag_quality_score: number | null
          response_quality: number | null
          tokens_in: number | null
          tokens_out: number | null
          tools_called: string[] | null
          user_id: string | null
        }
        Insert: {
          assistant_message_id?: string | null
          cache_hit?: boolean | null
          conversation_id?: string | null
          created_at?: string | null
          entities_used?: Json | null
          id?: string
          knowledge_used?: string[] | null
          model_used?: string | null
          processing_time_ms?: number | null
          provider?: string | null
          query: string
          query_hash?: string | null
          query_type?: string | null
          rag_quality_score?: number | null
          response_quality?: number | null
          tokens_in?: number | null
          tokens_out?: number | null
          tools_called?: string[] | null
          user_id?: string | null
        }
        Update: {
          assistant_message_id?: string | null
          cache_hit?: boolean | null
          conversation_id?: string | null
          created_at?: string | null
          entities_used?: Json | null
          id?: string
          knowledge_used?: string[] | null
          model_used?: string | null
          processing_time_ms?: number | null
          provider?: string | null
          query?: string
          query_hash?: string | null
          query_type?: string | null
          rag_quality_score?: number | null
          response_quality?: number | null
          tokens_in?: number | null
          tokens_out?: number | null
          tools_called?: string[] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "query_analytics_assistant_message_id_fkey"
            columns: ["assistant_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_analytics_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          ip_address: string | null
          request_count: number | null
          user_id: string | null
          window_start: string
        }
        Insert: {
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: string | null
          request_count?: number | null
          user_id?: string | null
          window_start: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: string | null
          request_count?: number | null
          user_id?: string | null
          window_start?: string
        }
        Relationships: []
      }
      response_cache: {
        Row: {
          cached_response: string
          confidence_score: number | null
          context_used: Json | null
          created_at: string | null
          expires_at: string | null
          id: string
          question_hash: string
          question_text: string
          times_served: number | null
        }
        Insert: {
          cached_response: string
          confidence_score?: number | null
          context_used?: Json | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          question_hash: string
          question_text: string
          times_served?: number | null
        }
        Update: {
          cached_response?: string
          confidence_score?: number | null
          context_used?: Json | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          question_hash?: string
          question_text?: string
          times_served?: number | null
        }
        Relationships: []
      }
      structured_logs: {
        Row: {
          context: Json | null
          conversation_id: string | null
          duration_ms: number | null
          error_stack: string | null
          function_name: string | null
          id: string
          level: string
          message: string
          metadata: Json | null
          timestamp: string
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          conversation_id?: string | null
          duration_ms?: number | null
          error_stack?: string | null
          function_name?: string | null
          id?: string
          level: string
          message: string
          metadata?: Json | null
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          conversation_id?: string | null
          duration_ms?: number | null
          error_stack?: string | null
          function_name?: string | null
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          timestamp?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tool_embeddings: {
        Row: {
          created_at: string
          description: string | null
          embedding: string | null
          id: string
          pattern: string
          tool_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          embedding?: string | null
          id?: string
          pattern: string
          tool_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          embedding?: string | null
          id?: string
          pattern?: string
          tool_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      uploaded_files: {
        Row: {
          content_preview: string | null
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          file_size: number | null
          file_type: string
          filename: string
          id: string
          message_id: string | null
          parsed_data: Json | null
          storage_path: string
        }
        Insert: {
          content_preview?: string | null
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          file_size?: number | null
          file_type: string
          filename: string
          id?: string
          message_id?: string | null
          parsed_data?: Json | null
          storage_path: string
        }
        Update: {
          content_preview?: string | null
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          file_size?: number | null
          file_type?: string
          filename?: string
          id?: string
          message_id?: string | null
          parsed_data?: Json | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_files_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_files_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      cleanup_expired_ai_cache: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_checkpoints: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_analytics: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          rows_deleted: number
          table_name: string
        }[]
      }
      cleanup_old_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_aggregated_analytics: {
        Args: { days_back?: number }
        Returns: {
          avg_processing_time: number
          cache_hit_rate: number
          top_query_types: Json
          total_queries: number
          unique_users: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_query: {
        Args: { query_text: string }
        Returns: string
      }
      match_knowledge: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          id: string
          similarity: number
          title: string
        }[]
      }
      match_patterns: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          answer_template: string
          id: string
          question_pattern: string
          similarity: number
          usage_count: number
        }[]
      }
      soft_delete_conversation: {
        Args: { conversation_uuid: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "user"
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
      app_role: ["owner", "admin", "user"],
    },
  },
} as const
