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
      accounts: {
        Row: {
          bank: string | null
          color: string | null
          connection_name: string | null
          created_at: string
          currency: string
          id: string
          initial_balance: number
          initial_date: string
          is_archived: boolean
          name: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          bank?: string | null
          color?: string | null
          connection_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          initial_balance?: number
          initial_date?: string
          is_archived?: boolean
          name: string
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          bank?: string | null
          color?: string | null
          connection_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          initial_balance?: number
          initial_date?: string
          is_archived?: boolean
          name?: string
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connections: {
        Row: {
          account_id: string | null
          created_at: string
          gc_account_id: string | null
          iban: string | null
          id: string
          institution_id: string
          institution_name: string | null
          last_synced_at: string | null
          reference: string
          requisition_id: string
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          gc_account_id?: string | null
          iban?: string | null
          id?: string
          institution_id: string
          institution_name?: string | null
          last_synced_at?: string | null
          reference: string
          requisition_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          gc_account_id?: string | null
          iban?: string | null
          id?: string
          institution_id?: string
          institution_name?: string | null
          last_synced_at?: string | null
          reference?: string
          requisition_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_connections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "bank_connections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          month: string
          note: string | null
          projected_amount: number
          subcategory_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          month: string
          note?: string | null
          projected_amount?: number
          subcategory_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          month?: string
          note?: string | null
          projected_amount?: number
          subcategory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "monthly_summary"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "budgets_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "monthly_summary"
            referencedColumns: ["subcategory_id"]
          },
          {
            foreignKeyName: "budgets_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          category_type_id: string
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_archived: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_type_id: string
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_type_id?: string
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_category_type_id_fkey"
            columns: ["category_type_id"]
            isOneToOne: false
            referencedRelation: "category_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_category_type_id_fkey"
            columns: ["category_type_id"]
            isOneToOne: false
            referencedRelation: "monthly_summary"
            referencedColumns: ["category_type_id"]
          },
        ]
      }
      categorization_rules: {
        Row: {
          account_id: string | null
          amount_max: number | null
          amount_min: number | null
          auto_validate: boolean
          case_sensitive: boolean
          created_at: string
          created_from_transaction_id: string | null
          hit_count: number
          id: string
          is_active: boolean
          last_hit_at: string | null
          match_type: Database["public"]["Enums"]["rule_match_type"]
          name: string
          pattern: string
          priority: number
          subcategory_id: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount_max?: number | null
          amount_min?: number | null
          auto_validate?: boolean
          case_sensitive?: boolean
          created_at?: string
          created_from_transaction_id?: string | null
          hit_count?: number
          id?: string
          is_active?: boolean
          last_hit_at?: string | null
          match_type?: Database["public"]["Enums"]["rule_match_type"]
          name: string
          pattern: string
          priority?: number
          subcategory_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount_max?: number | null
          amount_min?: number | null
          auto_validate?: boolean
          case_sensitive?: boolean
          created_at?: string
          created_from_transaction_id?: string | null
          hit_count?: number
          id?: string
          is_active?: boolean
          last_hit_at?: string | null
          match_type?: Database["public"]["Enums"]["rule_match_type"]
          name?: string
          pattern?: string
          priority?: number
          subcategory_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorization_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "categorization_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorization_rules_created_from_transaction_id_fkey"
            columns: ["created_from_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorization_rules_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "monthly_summary"
            referencedColumns: ["subcategory_id"]
          },
          {
            foreignKeyName: "categorization_rules_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_types: {
        Row: {
          color: string
          created_at: string
          id: string
          is_income: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_income?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_income?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      imports: {
        Row: {
          account_id: string
          bank_format: string | null
          created_at: string
          error_message: string | null
          id: string
          imported_at: string
          rows_duplicates: number
          rows_imported: number
          rows_total: number
          source_filename: string
          source_storage_path: string | null
          status: Database["public"]["Enums"]["import_status"]
          updated_at: string
        }
        Insert: {
          account_id: string
          bank_format?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          imported_at?: string
          rows_duplicates?: number
          rows_imported?: number
          rows_total?: number
          source_filename: string
          source_storage_path?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          bank_format?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          imported_at?: string
          rows_duplicates?: number
          rows_imported?: number
          rows_total?: number
          source_filename?: string
          source_storage_path?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "imports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "imports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_patterns: {
        Row: {
          account_id: string | null
          alert_if_missing: boolean
          amount_tolerance: number
          created_at: string
          expected_amount: number | null
          expected_day: number | null
          frequency_days: number
          id: string
          is_active: boolean
          label_pattern: string | null
          last_seen_at: string | null
          name: string
          subcategory_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          alert_if_missing?: boolean
          amount_tolerance?: number
          created_at?: string
          expected_amount?: number | null
          expected_day?: number | null
          frequency_days?: number
          id?: string
          is_active?: boolean
          label_pattern?: string | null
          last_seen_at?: string | null
          name: string
          subcategory_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          alert_if_missing?: boolean
          amount_tolerance?: number
          created_at?: string
          expected_amount?: number | null
          expected_day?: number | null
          frequency_days?: number
          id?: string
          is_active?: boolean
          label_pattern?: string | null
          last_seen_at?: string | null
          name?: string
          subcategory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_patterns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "recurring_patterns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_patterns_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "monthly_summary"
            referencedColumns: ["subcategory_id"]
          },
          {
            foreignKeyName: "recurring_patterns_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_archived: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "monthly_summary"
            referencedColumns: ["category_id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      transaction_tags: {
        Row: {
          created_at: string
          tag_id: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          tag_id: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          tag_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_tags_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          applied_rule_id: string | null
          created_at: string
          currency: string
          dedup_hash: string
          id: string
          import_id: string | null
          is_recurring: boolean
          label: string
          note: string | null
          operation_date: string
          raw_label: string
          recurring_pattern_id: string | null
          search_vector: unknown
          status: Database["public"]["Enums"]["transaction_status"]
          subcategory_id: string | null
          updated_at: string
          validated_at: string | null
          value_date: string | null
        }
        Insert: {
          account_id: string
          amount: number
          applied_rule_id?: string | null
          created_at?: string
          currency?: string
          dedup_hash: string
          id?: string
          import_id?: string | null
          is_recurring?: boolean
          label: string
          note?: string | null
          operation_date: string
          raw_label: string
          recurring_pattern_id?: string | null
          search_vector?: unknown
          status?: Database["public"]["Enums"]["transaction_status"]
          subcategory_id?: string | null
          updated_at?: string
          validated_at?: string | null
          value_date?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          applied_rule_id?: string | null
          created_at?: string
          currency?: string
          dedup_hash?: string
          id?: string
          import_id?: string | null
          is_recurring?: boolean
          label?: string
          note?: string | null
          operation_date?: string
          raw_label?: string
          recurring_pattern_id?: string | null
          search_vector?: unknown
          status?: Database["public"]["Enums"]["transaction_status"]
          subcategory_id?: string | null
          updated_at?: string
          validated_at?: string | null
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_transactions_applied_rule"
            columns: ["applied_rule_id"]
            isOneToOne: false
            referencedRelation: "categorization_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_transactions_recurring_pattern"
            columns: ["recurring_pattern_id"]
            isOneToOne: false
            referencedRelation: "recurring_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "monthly_summary"
            referencedColumns: ["subcategory_id"]
          },
          {
            foreignKeyName: "transactions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          account_name: string | null
          currency: string | null
          current_balance: number | null
          initial_balance: number | null
          pending_count: number | null
          transactions_sum: number | null
          type: Database["public"]["Enums"]["account_type"] | null
        }
        Relationships: []
      }
      monthly_summary: {
        Row: {
          category_id: string | null
          category_name: string | null
          category_type_id: string | null
          category_type_name: string | null
          is_income: boolean | null
          month: string | null
          subcategory_id: string | null
          subcategory_name: string | null
          total_amount: number | null
          transaction_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_owner: { Args: never; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      account_type:
        | "checking"
        | "savings"
        | "pel"
        | "joint"
        | "investment"
        | "other"
      import_status: "processing" | "completed" | "failed"
      rule_match_type: "regex" | "exact" | "contains"
      transaction_status: "pending" | "validated" | "ignored"
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
      account_type: [
        "checking",
        "savings",
        "pel",
        "joint",
        "investment",
        "other",
      ],
      import_status: ["processing", "completed", "failed"],
      rule_match_type: ["regex", "exact", "contains"],
      transaction_status: ["pending", "validated", "ignored"],
    },
  },
} as const
