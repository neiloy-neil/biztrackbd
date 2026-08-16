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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      account_transactions: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          id: string
          transaction_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          id?: string
          transaction_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          business_id: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          business_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          business_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          business_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          created_at: string
          currency: string
          id: string
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          business_id: string
          created_at: string
          id: string
          key: string
          request_params: Json | null
          request_path: string
          response_body: Json | null
          response_code: number | null
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          key: string
          request_params?: Json | null
          request_path: string
          response_body?: Json | null
          response_code?: number | null
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          key?: string
          request_params?: Json | null
          request_path?: string
          response_body?: Json | null
          response_code?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          after_quantity: number
          before_quantity: number
          branch_id: string
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          reason: string | null
          transaction_id: string | null
          type: Database["public"]["Enums"]["inventory_movement_type"]
        }
        Insert: {
          after_quantity?: number
          before_quantity?: number
          branch_id: string
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
          transaction_id?: string | null
          type: Database["public"]["Enums"]["inventory_movement_type"]
        }
        Update: {
          after_quantity?: number
          before_quantity?: number
          branch_id?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          transaction_id?: string | null
          type?: Database["public"]["Enums"]["inventory_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          opening_balance: number
          phone: string | null
          type: Database["public"]["Enums"]["party_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          opening_balance?: number
          phone?: string | null
          type: Database["public"]["Enums"]["party_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          opening_balance?: number
          phone?: string | null
          type?: Database["public"]["Enums"]["party_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          business_id: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          business_id: string
          category_id: string | null
          cost: number
          created_at: string
          current_stock: number
          deleted_at: string | null
          id: string
          image_url: string | null
          min_stock: number
          name: string
          price: number
          sku: string | null
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          business_id: string
          category_id?: string | null
          cost?: number
          created_at?: string
          current_stock?: number
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name: string
          price?: number
          sku?: string | null
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          business_id?: string
          category_id?: string | null
          cost?: number
          created_at?: string
          current_stock?: number
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name?: string
          price?: number
          sku?: string | null
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_party_balances"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          business_id: string
          receipt_footer: string | null
          receipt_header: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          receipt_footer?: string | null
          receipt_header?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          receipt_footer?: string | null
          receipt_header?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_items: {
        Row: {
          id: string
          product_id: string
          quantity: number
          subtotal: number
          transaction_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          product_id: string
          quantity: number
          subtotal: number
          transaction_id: string
          unit_price: number
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          subtotal?: number
          transaction_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          attachments: string[] | null
          branch_id: string
          business_id: string
          category: string | null
          created_at: string
          created_by: string | null
          discount: number
          id: string
          notes: string | null
          party_id: string | null
          reference: string | null
          state: Database["public"]["Enums"]["transaction_state"]
          subtotal: number
          total_amount: number
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          attachments?: string[] | null
          branch_id: string
          business_id: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          notes?: string | null
          party_id?: string | null
          reference?: string | null
          state?: Database["public"]["Enums"]["transaction_state"]
          subtotal?: number
          total_amount: number
          transaction_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          attachments?: string[] | null
          branch_id?: string
          business_id?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          notes?: string | null
          party_id?: string | null
          reference?: string | null
          state?: Database["public"]["Enums"]["transaction_state"]
          subtotal?: number
          total_amount?: number
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "v_party_balances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_party_balances: {
        Row: {
          address: string | null
          business_id: string | null
          created_at: string | null
          current_due: number | null
          email: string | null
          id: string | null
          name: string | null
          opening_balance: number | null
          phone: string | null
          type: Database["public"]["Enums"]["party_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "parties_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      complete_onboarding: {
        Args: {
          p_business_name: string
          p_category: string
          p_opening_balances: number[]
          p_owner_name: string
          p_payment_methods: string[]
        }
        Returns: string
      }
      get_dashboard_summary: {
        Args: {
          p_business_id: string
          p_end_date: string
          p_start_date: string
        }
        Returns: Json
      }
      is_business_member: { Args: { biz_id: string }; Returns: boolean }
      process_pos_sale: {
        Args: {
          p_branch_id: string
          p_business_id: string
          p_discount: number
          p_items: Json
          p_notes: string
          p_party_id: string
          p_payments: Json
          p_subtotal: number
          p_total_amount: number
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      inventory_movement_type: "in" | "out" | "adjustment"
      party_type: "customer" | "supplier" | "both"
      transaction_state: "pending" | "completed" | "cancelled" | "reversed"
      transaction_type:
        | "sale"
        | "purchase"
        | "expense"
        | "income"
        | "transfer"
        | "payment_in"
        | "payment_out"
        | "opening_balance"
      user_role: "owner" | "manager" | "cashier"
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
      inventory_movement_type: ["in", "out", "adjustment"],
      party_type: ["customer", "supplier", "both"],
      transaction_state: ["pending", "completed", "cancelled", "reversed"],
      transaction_type: [
        "sale",
        "purchase",
        "expense",
        "income",
        "transfer",
        "payment_in",
        "payment_out",
        "opening_balance",
      ],
      user_role: ["owner", "manager", "cashier"],
    },
  },
} as const
