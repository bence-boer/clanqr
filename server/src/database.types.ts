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
      agent_runs: {
        Row: {
          cli: string | null
          completion_tokens: number | null
          created_at: string
          duration_ms: number | null
          error: string | null
          feature_id: string | null
          files_changed: string[] | null
          finished_at: string | null
          id: string
          log: string | null
          model: string | null
          prompt_tokens: number | null
          session_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["agent_run_status"]
          summary: string | null
          task_id: string | null
          type: Database["public"]["Enums"]["agent_type"]
        }
        Insert: {
          cli?: string | null
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          feature_id?: string | null
          files_changed?: string[] | null
          finished_at?: string | null
          id?: string
          log?: string | null
          model?: string | null
          prompt_tokens?: number | null
          session_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["agent_run_status"]
          summary?: string | null
          task_id?: string | null
          type: Database["public"]["Enums"]["agent_type"]
        }
        Update: {
          cli?: string | null
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          feature_id?: string | null
          files_changed?: string[] | null
          finished_at?: string | null
          id?: string
          log?: string | null
          model?: string | null
          prompt_tokens?: number | null
          session_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["agent_run_status"]
          summary?: string | null
          task_id?: string | null
          type?: Database["public"]["Enums"]["agent_type"]
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
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
          cli: string | null
          created_at: string
          description: string | null
          execution_model: string | null
          id: string
          last_error: string | null
          manager_retry_count: number
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
          cli?: string | null
          created_at?: string
          description?: string | null
          execution_model?: string | null
          id?: string
          last_error?: string | null
          manager_retry_count?: number
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
          cli?: string | null
          created_at?: string
          description?: string | null
          execution_model?: string | null
          id?: string
          last_error?: string | null
          manager_retry_count?: number
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
          created_by_passkey_id: string | null
          expires_at: string
          id: string
          label: string | null
          role: string
          token: string
          used_at: string | null
          used_by_passkey_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_passkey_id?: string | null
          expires_at: string
          id?: string
          label?: string | null
          role?: string
          token: string
          used_at?: string | null
          used_by_passkey_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_passkey_id?: string | null
          expires_at?: string
          id?: string
          label?: string | null
          role?: string
          token?: string
          used_at?: string | null
          used_by_passkey_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_tokens_created_by_passkey_id_fkey"
            columns: ["created_by_passkey_id"]
            isOneToOne: false
            referencedRelation: "passkeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_tokens_used_by_passkey_id_fkey"
            columns: ["used_by_passkey_id"]
            isOneToOne: false
            referencedRelation: "passkeys"
            referencedColumns: ["id"]
          },
        ]
      }
      passkeys: {
        Row: {
          backed_up: boolean
          counter: number
          created_at: string
          credential_id: string
          device_type: string
          display_name: string | null
          id: string
          public_key: string
          role: string
          transports: string[] | null
        }
        Insert: {
          backed_up?: boolean
          counter?: number
          created_at?: string
          credential_id: string
          device_type?: string
          display_name?: string | null
          id: string
          public_key: string
          role?: string
          transports?: string[] | null
        }
        Update: {
          backed_up?: boolean
          counter?: number
          created_at?: string
          credential_id?: string
          device_type?: string
          display_name?: string | null
          id?: string
          public_key?: string
          role?: string
          transports?: string[] | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: []
      }
      prompts: {
        Row: {
          content: string
          id: string
          role: Database["public"]["Enums"]["prompt_role"]
          updated_at: string
          version: number
        }
        Insert: {
          content: string
          id?: string
          role: Database["public"]["Enums"]["prompt_role"]
          updated_at?: string
          version?: number
        }
        Update: {
          content?: string
          id?: string
          role?: Database["public"]["Enums"]["prompt_role"]
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
          id: string
          passkey_id: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          passkey_id: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          passkey_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_passkey_id_fkey"
            columns: ["passkey_id"]
            isOneToOne: false
            referencedRelation: "passkeys"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_links: {
        Row: {
          assigned_by: string
          created_at: string
          id: string
          skill_name: string
          task_id: string
        }
        Insert: {
          assigned_by?: string
          created_at?: string
          id?: string
          skill_name: string
          task_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          id?: string
          skill_name?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_links_task_id_fkey"
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
          assigned_by: string
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
          assigned_by?: string
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
          assigned_by?: string
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
          target: Database["public"]["Enums"]["trait_target"]
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name: string
          target: Database["public"]["Enums"]["trait_target"]
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name?: string
          target?: Database["public"]["Enums"]["trait_target"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      agent_run_status:
        | "queued"
        | "running"
        | "completed"
        | "failed"
        | "stopped"
      agent_type: "manager" | "ralph" | "chat"
      assignment_scope: "project" | "feature" | "task"
      failure_behavior: "stop" | "skip" | "retry"
      feature_status: "Draft" | "Submitted" | "In_Progress" | "Done"
      project_status: "Active" | "Archived"
      prompt_role: "manager" | "ralph"
      resource_status: "Pending" | "Fetched" | "Error"
      task_status:
        | "Pending_Approval"
        | "Approved"
        | "In_Progress"
        | "Complete"
        | "Skipped"
        | "Failed"
      trait_target: "manager" | "ralph"
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
      agent_run_status: ["queued", "running", "completed", "failed", "stopped"],
      agent_type: ["manager", "ralph", "chat"],
      assignment_scope: ["project", "feature", "task"],
      failure_behavior: ["stop", "skip", "retry"],
      feature_status: ["Draft", "Submitted", "In_Progress", "Done"],
      project_status: ["Active", "Archived"],
      prompt_role: ["manager", "ralph"],
      resource_status: ["Pending", "Fetched", "Error"],
      task_status: [
        "Pending_Approval",
        "Approved",
        "In_Progress",
        "Complete",
        "Skipped",
        "Failed",
      ],
      trait_target: ["manager", "ralph"],
    },
  },
} as const

