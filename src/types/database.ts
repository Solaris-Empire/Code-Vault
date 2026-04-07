export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          buyer_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          license_key: string
          license_type: string | null
          product_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          license_key: string
          license_type?: string | null
          product_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          license_key?: string
          license_type?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_cents: number
          buyer_id: string
          created_at: string | null
          id: string
          license_id: string | null
          platform_fee_cents: number
          product_id: string
          seller_payout_cents: number
          status: string | null
          stripe_payment_id: string | null
        }
        Insert: {
          amount_cents: number
          buyer_id: string
          created_at?: string | null
          id?: string
          license_id?: string | null
          platform_fee_cents: number
          product_id: string
          seller_payout_cents: number
          status?: string | null
          stripe_payment_id?: string | null
        }
        Update: {
          amount_cents?: number
          buyer_id?: string
          created_at?: string | null
          id?: string
          license_id?: string | null
          platform_fee_cents?: number
          product_id?: string
          seller_payout_cents?: number
          status?: string | null
          stripe_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount_cents: number
          created_at: string | null
          id: string
          seller_id: string
          status: string | null
          stripe_payout_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          id?: string
          seller_id: string
          status?: string | null
          stripe_payout_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          id?: string
          seller_id?: string
          status?: string | null
          stripe_payout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_files: {
        Row: {
          changelog: string | null
          created_at: string | null
          file_name: string
          file_size_bytes: number | null
          file_url: string
          id: string
          is_current: boolean | null
          product_id: string
          version: string
        }
        Insert: {
          changelog?: string | null
          created_at?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          is_current?: boolean | null
          product_id: string
          version?: string
        }
        Update: {
          changelog?: string | null
          created_at?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          is_current?: boolean | null
          product_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_files_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          avg_rating: number | null
          category_id: string | null
          created_at: string | null
          demo_url: string | null
          description: string | null
          download_count: number | null
          id: string
          is_featured: boolean | null
          price_cents: number
          review_count: number | null
          seller_id: string
          short_description: string | null
          slug: string
          status: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          avg_rating?: number | null
          category_id?: string | null
          created_at?: string | null
          demo_url?: string | null
          description?: string | null
          download_count?: number | null
          id?: string
          is_featured?: boolean | null
          price_cents: number
          review_count?: number | null
          seller_id: string
          short_description?: string | null
          slug: string
          status?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          avg_rating?: number | null
          category_id?: string | null
          created_at?: string | null
          demo_url?: string | null
          description?: string | null
          download_count?: number | null
          id?: string
          is_featured?: boolean | null
          price_cents?: number
          review_count?: number | null
          seller_id?: string
          short_description?: string | null
          slug?: string
          status?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          buyer_id: string
          comment: string | null
          created_at: string | null
          id: string
          product_id: string
          rating: number
          updated_at: string | null
        }
        Insert: {
          buyer_id: string
          comment?: string | null
          created_at?: string | null
          id?: string
          product_id: string
          rating: number
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          product_id?: string
          rating?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          email: string
          id: string
          role: string | null
          stripe_account_id: string | null
          stripe_onboarding_complete: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          email: string
          id: string
          role?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
          role?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_loyalty_points: {
        Args: {
          p_description?: string
          p_expires_in_days?: number
          p_points: number
          p_reference_id?: string
          p_reference_type?: string
          p_type: string
          p_user_id: string
        }
        Returns: number
      }
      add_ticket_message: {
        Args: {
          p_attachments?: Json
          p_is_internal?: boolean
          p_message: string
          p_sender_id: string
          p_sender_type: string
          p_ticket_id: string
        }
        Returns: string
      }
      apply_coupon: {
        Args: {
          p_coupon_id: string
          p_discount_pence: number
          p_order_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      check_chat_availability: {
        Args: never
        Returns: {
          available_agents: number
          estimated_wait_minutes: number
          is_available: boolean
        }[]
      }
      clear_recently_viewed: { Args: { p_user_id: string }; Returns: undefined }
      close_chat_conversation: {
        Args: {
          p_conversation_id: string
          p_feedback?: string
          p_rating?: number
          p_status?: string
        }
        Returns: boolean
      }
      create_notification: {
        Args: {
          p_action_url?: string
          p_data?: Json
          p_image_url?: string
          p_message: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      create_support_ticket: {
        Args: {
          p_category_id: string
          p_guest_email?: string
          p_guest_name?: string
          p_message: string
          p_order_id?: string
          p_priority?: string
          p_subject: string
          p_user_id: string
        }
        Returns: {
          message: string
          success: boolean
          ticket_id: string
          ticket_number: string
        }[]
      }
      decrement_stock: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      ensure_profile_exists: { Args: never; Returns: undefined }
      generate_gift_card_code: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
      get_active_deal: {
        Args: { p_product_id: string }
        Returns: {
          claimed_quantity: number
          deal_price_pence: number
          discount_percentage: number
          ends_at: string
          id: string
          max_quantity: number
        }[]
      }
      get_newsletter_stats: {
        Args: never
        Returns: {
          active_subscribers: number
          subscribed_this_month: number
          total_subscribers: number
          unsubscribed: number
          unsubscribed_this_month: number
        }[]
      }
      get_product_view_stats: {
        Args: { p_days?: number; p_product_id: string }
        Returns: {
          total_views: number
          unique_sessions: number
          unique_users: number
          views_by_day: Json
        }[]
      }
      get_recently_viewed_products: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          avg_rating: number
          category_name: string
          image_url: string
          name: string
          original_price_pence: number
          price_pence: number
          product_id: string
          review_count: number
          slug: string
          view_count: number
          viewed_at: string
        }[]
      }
      get_trending_products: {
        Args: { p_hours?: number; p_limit?: number }
        Returns: {
          image_url: string
          name: string
          price_pence: number
          product_id: string
          slug: string
          unique_viewers: number
          view_count: number
        }[]
      }
      get_unread_notification_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_user_ticket_stats: {
        Args: { p_user_id: string }
        Returns: {
          open_tickets: number
          resolved_tickets: number
          total_tickets: number
          unread_tickets: number
        }[]
      }
      has_purchased_product: {
        Args: { p_product_id: string; p_user_id: string }
        Returns: boolean
      }
      haversine_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      log_audit_action: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_name?: string
          p_entity_type: string
          p_metadata?: Json
          p_new_values?: Json
          p_old_values?: Json
          p_user_id: string
        }
        Returns: string
      }
      mark_notifications_read: {
        Args: { p_notification_ids?: string[]; p_user_id: string }
        Returns: number
      }
      match_chatbot_intent: {
        Args: { p_message: string }
        Returns: {
          card_data: Json
          confidence: number
          follow_up_intent: string
          intent_name: string
          quick_replies: Json
          response_text: string
          response_type: string
        }[]
      }
      redeem_loyalty_points: {
        Args: { p_order_id?: string; p_rule_id: string; p_user_id: string }
        Returns: {
          message: string
          reward_type: string
          reward_value: number
          success: boolean
        }[]
      }
      search_chatbot_faqs: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          answer: string
          category: string
          id: string
          question: string
          relevance: number
        }[]
      }
      send_chat_message: {
        Args: {
          p_attachments?: Json
          p_content?: string
          p_conversation_id: string
          p_message_type?: string
          p_metadata?: Json
          p_sender_id?: string
          p_sender_name?: string
          p_sender_type: string
        }
        Returns: string
      }
      start_chat_conversation:
        | {
            Args: {
              p_department?: string
              p_guest_email?: string
              p_guest_name?: string
              p_initial_message?: string
              p_metadata?: Json
              p_session_id?: string
              p_subject?: string
              p_user_id?: string
            }
            Returns: {
              conversation_id: string
              message_id: string
            }[]
          }
        | {
            Args: {
              p_channel_type?: string
              p_department?: string
              p_guest_email?: string
              p_guest_name?: string
              p_initial_message?: string
              p_metadata?: Json
              p_session_id?: string
              p_subject?: string
              p_user_id?: string
              p_vendor_id?: string
            }
            Returns: {
              conversation_id: string
              message_id: string
            }[]
          }
      subscribe_to_newsletter: {
        Args: {
          p_email: string
          p_first_name?: string
          p_ip_address?: string
          p_preferences?: Json
          p_source?: string
        }
        Returns: {
          message: string
          subscriber_id: string
          success: boolean
        }[]
      }
      track_product_view: {
        Args: {
          p_ip_address?: string
          p_product_id: string
          p_referrer?: string
          p_session_id?: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: undefined
      }
      unsubscribe_from_newsletter: {
        Args: { p_email: string; p_reason?: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      update_loyalty_tier: { Args: { p_user_id: string }; Returns: undefined }
      validate_coupon: {
        Args: { p_code: string; p_subtotal_pence: number; p_user_id: string }
        Returns: {
          coupon_id: string
          discount_pence: number
          discount_type: string
          discount_value: number
          error_message: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      refund_method:
        | "original_payment"
        | "store_credit"
        | "bank_transfer"
        | "replacement"
      return_reason:
        | "damaged"
        | "wrong_item"
        | "not_as_described"
        | "quality_issue"
        | "changed_mind"
        | "expired"
        | "missing_items"
        | "other"
      return_status:
        | "pending"
        | "approved"
        | "rejected"
        | "items_received"
        | "inspecting"
        | "refund_processing"
        | "refunded"
        | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      refund_method: [
        "original_payment",
        "store_credit",
        "bank_transfer",
        "replacement",
      ],
      return_reason: [
        "damaged",
        "wrong_item",
        "not_as_described",
        "quality_issue",
        "changed_mind",
        "expired",
        "missing_items",
        "other",
      ],
      return_status: [
        "pending",
        "approved",
        "rejected",
        "items_received",
        "inspecting",
        "refund_processing",
        "refunded",
        "cancelled",
      ],
    },
  },
} as const

