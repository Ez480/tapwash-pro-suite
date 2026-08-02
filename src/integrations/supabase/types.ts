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
      employees: {
        Row: {
          branch: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          job_title: string | null
          phone: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          branch?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          job_title?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          branch?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          job_title?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      nfc_cards: {
        Row: {
          activation_date: string | null
          card_type: Database["public"]["Enums"]["card_type"]
          created_at: string
          customer_id: string | null
          id: string
          serial_number: string
          status: Database["public"]["Enums"]["card_status"]
          uid: string
          updated_at: string
        }
        Insert: {
          activation_date?: string | null
          card_type?: Database["public"]["Enums"]["card_type"]
          created_at?: string
          customer_id?: string | null
          id?: string
          serial_number: string
          status?: Database["public"]["Enums"]["card_status"]
          uid: string
          updated_at?: string
        }
        Update: {
          activation_date?: string | null
          card_type?: Database["public"]["Enums"]["card_type"]
          created_at?: string
          customer_id?: string | null
          id?: string
          serial_number?: string
          status?: Database["public"]["Enums"]["card_status"]
          uid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfc_cards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          is_read: boolean
          message: string
          title: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          is_read?: boolean
          message?: string
          title: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          end_date: string | null
          id: string
          image_url: string | null
          new_price: number | null
          old_price: number | null
          start_date: string
          status: Database["public"]["Enums"]["entity_status"]
          title_ar: string
          title_en: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          new_price?: number | null
          old_price?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["entity_status"]
          title_ar: string
          title_en: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          new_price?: number | null
          old_price?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["entity_status"]
          title_ar?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          duration_days: number
          features_ar: string[]
          features_en: string[]
          id: string
          image_url: string | null
          price: number
          sort_order: number
          status: Database["public"]["Enums"]["entity_status"]
          title_ar: string
          title_en: string
          updated_at: string
          washes_count: number
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          duration_days?: number
          features_ar?: string[]
          features_en?: string[]
          id?: string
          image_url?: string | null
          price?: number
          sort_order?: number
          status?: Database["public"]["Enums"]["entity_status"]
          title_ar: string
          title_en: string
          updated_at?: string
          washes_count?: number
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          duration_days?: number
          features_ar?: string[]
          features_en?: string[]
          id?: string
          image_url?: string | null
          price?: number
          sort_order?: number
          status?: Database["public"]["Enums"]["entity_status"]
          title_ar?: string
          title_en?: string
          updated_at?: string
          washes_count?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          method: string
          paid_at: string
          reference: string | null
          status: string
          subscription_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_id: string
          id?: string
          method?: string
          paid_at?: string
          reference?: string | null
          status?: string
          subscription_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          method?: string
          paid_at?: string
          reference?: string | null
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          language: string
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          language?: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          language?: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
        }
        Relationships: []
      }
      site_pages: {
        Row: {
          blocks: Json
          content_ar: string | null
          content_en: string | null
          created_at: string
          id: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          subtitle_ar: string | null
          subtitle_en: string | null
          title_ar: string
          title_en: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          content_ar?: string | null
          content_en?: string | null
          created_at?: string
          id?: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          subtitle_ar?: string | null
          subtitle_en?: string | null
          title_ar: string
          title_en: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          content_ar?: string | null
          content_en?: string | null
          created_at?: string
          id?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          subtitle_ar?: string | null
          subtitle_en?: string | null
          title_ar?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          address_ar: string | null
          address_en: string | null
          company_name_ar: string
          company_name_en: string
          email: string | null
          facebook_url: string | null
          id: number
          instagram_url: string | null
          logo_url: string | null
          phone: string | null
          primary_color: string
          secondary_color: string
          tiktok_url: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          company_name_ar?: string
          company_name_en?: string
          email?: string | null
          facebook_url?: string | null
          id?: number
          instagram_url?: string | null
          logo_url?: string | null
          phone?: string | null
          primary_color?: string
          secondary_color?: string
          tiktok_url?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          company_name_ar?: string
          company_name_en?: string
          email?: string | null
          facebook_url?: string | null
          id?: number
          instagram_url?: string | null
          logo_url?: string | null
          phone?: string | null
          primary_color?: string
          secondary_color?: string
          tiktok_url?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          customer_id: string
          end_date: string
          id: string
          package_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          total_washes: number
          updated_at: string
          used_washes: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          end_date?: string
          id?: string
          package_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          total_washes?: number
          updated_at?: string
          used_washes?: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          end_date?: string
          id?: string
          package_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          total_washes?: number
          updated_at?: string
          used_washes?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
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
          role: Database["public"]["Enums"]["app_role"]
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
      washes: {
        Row: {
          branch: string | null
          created_at: string
          customer_id: string
          id: string
          note: string | null
          subscription_id: string | null
          washed_at: string
        }
        Insert: {
          branch?: string | null
          created_at?: string
          customer_id: string
          id?: string
          note?: string | null
          subscription_id?: string | null
          washed_at?: string
        }
        Update: {
          branch?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          note?: string | null
          subscription_id?: string | null
          washed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "washes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "washes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
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
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee" | "customer"
      card_status: "available" | "assigned" | "blocked"
      card_type: "card" | "sticker" | "keychain"
      customer_status: "active" | "suspended"
      entity_status: "active" | "inactive"
      subscription_status: "active" | "expired" | "cancelled" | "pending"
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
      app_role: ["admin", "employee", "customer"],
      card_status: ["available", "assigned", "blocked"],
      card_type: ["card", "sticker", "keychain"],
      customer_status: ["active", "suspended"],
      entity_status: ["active", "inactive"],
      subscription_status: ["active", "expired", "cancelled", "pending"],
    },
  },
} as const
