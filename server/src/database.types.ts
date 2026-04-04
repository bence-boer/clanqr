export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agent_events: {
        Row: {
          agent_session_id: string
          created_at: string
          event_data: Json
          event_type: string
          id: string
        }
        Insert: {
          agent_session_id: string
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
        }
        Update: {
          agent_session_id?: string
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_events_agent_session_id_fkey"
            columns: ["agent_session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_sessions: {
        Row: {
          agent_type: Database["public"]["Enums"]["agent_type"]
          cache_read_tokens: number
          cache_write_tokens: number
          completion_tokens: number
          created_at: string
          duration_ms: number | null
          error: string | null
          estimated_cost: number
          feature_id: string | null
          files_changed: string[] | null
          finished_at: string | null
          id: string
          model: string | null
          prompt_tokens: number
          sdk_session_id: string | null
          session_id: string | null
          source: string
          started_at: string | null
          status: Database["public"]["Enums"]["agent_session_status"]
          summary: string | null
          task_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agent_type: Database["public"]["Enums"]["agent_type"]
          cache_read_tokens?: number
          cache_write_tokens?: number
          completion_tokens?: number
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          estimated_cost?: number
          feature_id?: string | null
          files_changed?: string[] | null
          finished_at?: string | null
          id?: string
          model?: string | null
          prompt_tokens?: number
          sdk_session_id?: string | null
          session_id?: string | null
          source?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["agent_session_status"]
          summary?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agent_type?: Database["public"]["Enums"]["agent_type"]
          cache_read_tokens?: number
          cache_write_tokens?: number
          completion_tokens?: number
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          estimated_cost?: number
          feature_id?: string | null
          files_changed?: string[] | null
          finished_at?: string | null
          id?: string
          model?: string | null
          prompt_tokens?: number
          sdk_session_id?: string | null
          session_id?: string | null
          source?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["agent_session_status"]
          summary?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_sessions_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tool_calls: {
        Row: {
          agent_session_id: string
          arguments: Json | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          mcp_server_name: string | null
          permission_decision: string | null
          result_success: boolean | null
          result_summary: string | null
          tool_call_id: string | null
          tool_name: string
          tool_type: string | null
          was_suppressed: boolean
        }
        Insert: {
          agent_session_id: string
          arguments?: Json | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          mcp_server_name?: string | null
          permission_decision?: string | null
          result_success?: boolean | null
          result_summary?: string | null
          tool_call_id?: string | null
          tool_name: string
          tool_type?: string | null
          was_suppressed?: boolean
        }
        Update: {
          agent_session_id?: string
          arguments?: Json | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          mcp_server_name?: string | null
          permission_decision?: string | null
          result_success?: boolean | null
          result_summary?: string | null
          tool_call_id?: string | null
          tool_name?: string
          tool_type?: string | null
          was_suppressed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agent_tool_calls_agent_session_id_fkey"
            columns: ["agent_session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          agent_type: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          payload: Json | null
          session_id: string
        }
        Insert: {
          agent_type?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          session_id: string
        }
        Update: {
          agent_type?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          session_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          model: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      features: {
        Row: {
          auto_approve: boolean
          created_at: string
          created_by: string | null
          description: string | null
          execution_model: string | null
          id: string
          last_error: string | null
          manager_retry_count: number
          model: string | null
          on_task_failure: Database["public"]["Enums"]["failure_behavior"]
          planning_model: string | null
          project_id: string
          status: Database["public"]["Enums"]["feature_status"]
          task_timeout_minutes: number
          title: string
          updated_at: string
        }
        Insert: {
          auto_approve?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          execution_model?: string | null
          id?: string
          last_error?: string | null
          manager_retry_count?: number
          model?: string | null
          on_task_failure?: Database["public"]["Enums"]["failure_behavior"]
          planning_model?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["feature_status"]
          task_timeout_minutes?: number
          title: string
          updated_at?: string
        }
        Update: {
          auto_approve?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          execution_model?: string | null
          id?: string
          last_error?: string | null
          manager_retry_count?: number
          model?: string | null
          on_task_failure?: Database["public"]["Enums"]["failure_behavior"]
          planning_model?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["feature_status"]
          task_timeout_minutes?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "features_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "features_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_tokens_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_server_configs: {
        Row: {
          args: string[] | null
          command: string | null
          created_at: string
          env: Json | null
          id: string
          is_global: boolean
          name: string
          server_type: string
          status: string
          updated_at: string
          url: string | null
        }
        Insert: {
          args?: string[] | null
          command?: string | null
          created_at?: string
          env?: Json | null
          id?: string
          is_global?: boolean
          name: string
          server_type: string
          status?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          args?: string[] | null
          command?: string | null
          created_at?: string
          env?: Json | null
          id?: string
          is_global?: boolean
          name?: string
          server_type?: string
          status?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          agent_type: Database["public"]["Enums"]["agent_type"]
          content: string
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          version: number
        }
        Insert: {
          agent_type: Database["public"]["Enums"]["agent_type"]
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          agent_type?: Database["public"]["Enums"]["agent_type"]
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      resources: {
        Row: {
          created_at: string
          feature_id: string
          id: string
          status: Database["public"]["Enums"]["resource_status"]
          title: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          id?: string
          status?: Database["public"]["Enums"]["resource_status"]
          title?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          id?: string
          status?: Database["public"]["Enums"]["resource_status"]
          title?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          expires_at: string
          github_access_token: string | null
          github_refresh_token: string | null
          id: string
          token: string
          token_expires_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          github_access_token?: string | null
          github_refresh_token?: string | null
          id?: string
          token: string
          token_expires_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          github_access_token?: string | null
          github_refresh_token?: string | null
          id?: string
          token?: string
          token_expires_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_links: {
        Row: {
          assigned_by: string | null
          created_at: string
          feature_id: string | null
          id: string
          project_id: string | null
          skill_name: string
          task_id: string | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          feature_id?: string | null
          id?: string
          project_id?: string | null
          skill_name: string
          task_id?: string | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          feature_id?: string | null
          id?: string
          project_id?: string | null
          skill_name?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_links_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_links_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_artifacts: {
        Row: {
          agent_session_id: string | null
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          task_id: string
        }
        Insert: {
          agent_session_id?: string | null
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          task_id: string
        }
        Update: {
          agent_session_id?: string | null
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_artifacts_agent_session_id_fkey"
            columns: ["agent_session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_artifacts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agent_log: string | null
          created_at: string
          created_by: string | null
          description: string
          feature_id: string
          id: string
          max_retries: number
          model: string | null
          output: string | null
          retry_count: number
          sort_order: number
          status: Database["public"]["Enums"]["task_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          agent_log?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          feature_id: string
          id?: string
          max_retries?: number
          model?: string | null
          output?: string | null
          retry_count?: number
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          agent_log?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          feature_id?: string
          id?: string
          max_retries?: number
          model?: string | null
          output?: string | null
          retry_count?: number
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      trait_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          feature_id: string | null
          id: string
          is_excluded: boolean
          project_id: string | null
          scope: Database["public"]["Enums"]["assignment_scope"]
          task_id: string | null
          trait_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          feature_id?: string | null
          id?: string
          is_excluded?: boolean
          project_id?: string | null
          scope: Database["public"]["Enums"]["assignment_scope"]
          task_id?: string | null
          trait_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          feature_id?: string | null
          id?: string
          is_excluded?: boolean
          project_id?: string | null
          scope?: Database["public"]["Enums"]["assignment_scope"]
          task_id?: string | null
          trait_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trait_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trait_assignments_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trait_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trait_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trait_assignments_trait_id_fkey"
            columns: ["trait_id"]
            isOneToOne: false
            referencedRelation: "traits"
            referencedColumns: ["id"]
          },
        ]
      }
      traits: {
        Row: {
          content: string
          created_at: string
          description: string | null
          id: string
          is_global: boolean
          name: string
          target: Database["public"]["Enums"]["agent_type"]
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name: string
          target: Database["public"]["Enums"]["agent_type"]
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name?: string
          target?: Database["public"]["Enums"]["agent_type"]
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          github_id: number
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          github_id: number
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          github_id?: number
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dearmor: { Args: { "": string }; Returns: string }
      gen_random_uuid: { Args: never; Returns: string }
      gen_salt: { Args: { "": string }; Returns: string }
      pgp_armor_headers: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      uuid_generate_v1: { Args: never; Returns: string }
      uuid_generate_v1mc: { Args: never; Returns: string }
      uuid_generate_v3: {
        Args: { name: string; namespace: string }
        Returns: string
      }
      uuid_generate_v4: { Args: never; Returns: string }
      uuid_generate_v5: {
        Args: { name: string; namespace: string }
        Returns: string
      }
      uuid_nil: { Args: never; Returns: string }
      uuid_ns_dns: { Args: never; Returns: string }
      uuid_ns_oid: { Args: never; Returns: string }
      uuid_ns_url: { Args: never; Returns: string }
      uuid_ns_x500: { Args: never; Returns: string }
    }
    Enums: {
      agent_session_status:
        | "pending"
        | "running"
        | "paused"
        | "completed"
        | "failed"
        | "cancelled"
      agent_type:
        | "manager"
        | "ralph"
        | "researcher"
        | "editor"
        | "chat"
        | "custom"
      assignment_scope: "project" | "feature" | "task"
      failure_behavior: "stop" | "skip" | "retry"
      feature_status:
        | "draft"
        | "submitted"
        | "in_progress"
        | "done"
        | "cancelled"
      project_status: "active" | "archived" | "planning"
      resource_status: "pending" | "fetched" | "error"
      task_status:
        | "queued"
        | "approved"
        | "in_progress"
        | "complete"
        | "failed"
        | "skipped"
      user_role: "admin" | "member"
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
      agent_session_status: [
        "pending",
        "running",
        "paused",
        "completed",
        "failed",
        "cancelled",
      ],
      agent_type: [
        "manager",
        "ralph",
        "researcher",
        "editor",
        "chat",
        "custom",
      ],
      assignment_scope: ["project", "feature", "task"],
      failure_behavior: ["stop", "skip", "retry"],
      feature_status: [
        "draft",
        "submitted",
        "in_progress",
        "done",
        "cancelled",
      ],
      project_status: ["active", "archived", "planning"],
      resource_status: ["pending", "fetched", "error"],
      task_status: [
        "queued",
        "approved",
        "in_progress",
        "complete",
        "failed",
        "skipped",
      ],
      user_role: ["admin", "member"],
    },
  },
} as const

