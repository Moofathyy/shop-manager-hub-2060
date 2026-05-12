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
      audit_log: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          metadata: Json | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          metadata?: Json | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      banners: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string | null
          id: string
          image_desktop_url: string | null
          image_mobile_url: string | null
          link_url: string | null
          sort_order: number
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          image_desktop_url?: string | null
          image_mobile_url?: string | null
          link_url?: string | null
          sort_order?: number
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          image_desktop_url?: string | null
          image_mobile_url?: string | null
          link_url?: string | null
          sort_order?: number
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
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
      coupon_redemptions: {
        Row: {
          coupon_id: string
          discount_applied: number
          id: string
          order_id: string | null
          redeemed_at: string
          shopper_id: string
        }
        Insert: {
          coupon_id: string
          discount_applied: number
          id?: string
          order_id?: string | null
          redeemed_at?: string
          shopper_id: string
        }
        Update: {
          coupon_id?: string
          discount_applied?: number
          id?: string
          order_id?: string | null
          redeemed_at?: string
          shopper_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applicable_categories: string[]
          applicable_sellers: string[]
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at: string | null
          id: string
          max_uses: number | null
          min_order_value: number
          status: Database["public"]["Enums"]["coupon_status"]
          updated_at: string
          used_count: number
        }
        Insert: {
          applicable_categories?: string[]
          applicable_sellers?: string[]
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_order_value?: number
          status?: Database["public"]["Enums"]["coupon_status"]
          updated_at?: string
          used_count?: number
        }
        Update: {
          applicable_categories?: string[]
          applicable_sellers?: string[]
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_order_value?: number
          status?: Database["public"]["Enums"]["coupon_status"]
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      disputes: {
        Row: {
          created_at: string
          id: string
          order_id: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          seller_id: string
          shopper_id: string
          status: Database["public"]["Enums"]["dispute_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id: string
          shopper_id: string
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id?: string
          shopper_id?: string
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_slots: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string | null
          entity_id: string
          id: string
          position: number
          slot_type: Database["public"]["Enums"]["featured_slot_type"]
          starts_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          entity_id: string
          id?: string
          position?: number
          slot_type: Database["public"]["Enums"]["featured_slot_type"]
          starts_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          entity_id?: string
          id?: string
          position?: number
          slot_type?: Database["public"]["Enums"]["featured_slot_type"]
          starts_at?: string | null
        }
        Relationships: []
      }
      flash_sales: {
        Row: {
          created_at: string
          description: string | null
          discount_percentage: number
          ends_at: string
          id: string
          product_ids: string[]
          starts_at: string
          status: Database["public"]["Enums"]["flash_sale_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percentage: number
          ends_at: string
          id?: string
          product_ids?: string[]
          starts_at: string
          status?: Database["public"]["Enums"]["flash_sale_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percentage?: number
          ends_at?: string
          id?: string
          product_ids?: string[]
          starts_at?: string
          status?: Database["public"]["Enums"]["flash_sale_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_adjustments: {
        Row: {
          admin_id: string | null
          created_at: string
          delta: number
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          delta: number
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_config: {
        Row: {
          expiry_months: number
          id: number
          points_per_dollar: number
          redemption_rate: number
          updated_at: string
        }
        Insert: {
          expiry_months?: number
          id?: number
          points_per_dollar?: number
          redemption_rate?: number
          updated_at?: string
        }
        Update: {
          expiry_months?: number
          id?: number
          points_per_dollar?: number
          redemption_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_points: {
        Row: {
          balance: number
          lifetime_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          lifetime_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          lifetime_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      merchant_applications: {
        Row: {
          business_type: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          documents: Json
          id: string
          kyc_result: Json | null
          seller_id: string
          status: Database["public"]["Enums"]["approval_status"]
        }
        Insert: {
          business_type?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          documents?: Json
          id?: string
          kyc_result?: Json | null
          seller_id: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Update: {
          business_type?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          documents?: Json
          id?: string
          kyc_result?: Json | null
          seller_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          key: string
          name: string
          subject: string | null
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          key: string
          name: string
          subject?: string | null
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          key?: string
          name?: string
          subject?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          audience: Database["public"]["Enums"]["notification_audience"]
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          click_count: number
          created_at: string
          created_by: string | null
          id: string
          open_count: number
          recipient_count: number
          scheduled_for: string | null
          segment_filter: Json | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string | null
          template_key: string | null
        }
        Insert: {
          audience: Database["public"]["Enums"]["notification_audience"]
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          click_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          open_count?: number
          recipient_count?: number
          scheduled_for?: string | null
          segment_filter?: Json | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string | null
          template_key?: string | null
        }
        Update: {
          audience?: Database["public"]["Enums"]["notification_audience"]
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          click_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          open_count?: number
          recipient_count?: number
          scheduled_for?: string | null
          segment_filter?: Json | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string | null
          template_key?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          price: number
          product_id: string
          qty: number
        }
        Insert: {
          id?: string
          order_id: string
          price: number
          product_id: string
          qty: number
        }
        Update: {
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          carrier: string | null
          created_at: string
          discount: number
          id: string
          notes: string | null
          payment_method: string | null
          payment_status: string
          seller_id: string
          shipping: number
          shipping_address: Json | null
          shipping_status: string
          shopper_id: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          discount?: number
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          seller_id: string
          shipping?: number
          shipping_address?: Json | null
          shipping_status?: string
          shopper_id: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          discount?: number
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          seller_id?: string
          shipping?: number
          shipping_address?: Json | null
          shipping_status?: string
          shopper_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          hold_reason: string | null
          id: string
          notes: string | null
          processed_at: string | null
          scheduled_for: string | null
          seller_id: string
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          hold_reason?: string | null
          id?: string
          notes?: string | null
          processed_at?: string | null
          scheduled_for?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          hold_reason?: string | null
          id?: string
          notes?: string | null
          processed_at?: string | null
          scheduled_for?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          images: Json
          price: number
          rating: number | null
          rejection_reason: string | null
          sales_count: number
          seller_id: string
          sku: string | null
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          price: number
          rating?: number | null
          rejection_reason?: string | null
          sales_count?: number
          seller_id: string
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          price?: number
          rating?: number | null
          rejection_reason?: string | null
          sales_count?: number
          seller_id?: string
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          last_login: string | null
          phone: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          last_login?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_login?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      referral_config: {
        Row: {
          expiry_days: number
          id: number
          max_per_user: number
          referee_reward: number
          referrer_reward: number
          updated_at: string
        }
        Insert: {
          expiry_days?: number
          id?: number
          max_per_user?: number
          referee_reward?: number
          referrer_reward?: number
          updated_at?: string
        }
        Update: {
          expiry_days?: number
          id?: number
          max_per_user?: number
          referee_reward?: number
          referrer_reward?: number
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          referee_id: string
          referrer_id: string
          reward_paid: number
          status: Database["public"]["Enums"]["referral_status"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          referee_id: string
          referrer_id: string
          reward_paid?: number
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          referee_id?: string
          referrer_id?: string
          reward_paid?: number
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          notes: string | null
          order_id: string
          reason: string
          requested_by: string | null
          status: Database["public"]["Enums"]["refund_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          notes?: string | null
          order_id: string
          reason: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          reason?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          content: string | null
          created_at: string
          flag_reason: string | null
          id: string
          order_id: string | null
          rating: number
          removed_reason: string | null
          reviewer_id: string
          status: Database["public"]["Enums"]["review_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["review_target"]
        }
        Insert: {
          content?: string | null
          created_at?: string
          flag_reason?: string | null
          id?: string
          order_id?: string | null
          rating: number
          removed_reason?: string | null
          reviewer_id: string
          status?: Database["public"]["Enums"]["review_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["review_target"]
        }
        Update: {
          content?: string | null
          created_at?: string
          flag_reason?: string | null
          id?: string
          order_id?: string | null
          rating?: number
          removed_reason?: string | null
          reviewer_id?: string
          status?: Database["public"]["Enums"]["review_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["review_target"]
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          created_by: string | null
          frequency: string
          id: string
          last_run_at: string | null
          name: string
          next_run_at: string | null
          recipient_email: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          created_by?: string | null
          frequency: string
          id?: string
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          recipient_email: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          created_by?: string | null
          frequency?: string
          id?: string
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          recipient_email?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_profiles: {
        Row: {
          address: string | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          business_name: string | null
          commission_rate: number
          created_at: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          logo_url: string | null
          payout_balance: number
          rating: number | null
          store_name: string
          tax_id: string | null
          total_revenue: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          business_name?: string | null
          commission_rate?: number
          created_at?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          logo_url?: string | null
          payout_balance?: number
          rating?: number | null
          store_name: string
          tax_id?: string | null
          total_revenue?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          business_name?: string | null
          commission_rate?: number
          created_at?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          logo_url?: string | null
          payout_balance?: number
          rating?: number | null
          store_name?: string
          tax_id?: string | null
          total_revenue?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          internal_notes: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          related_order_id: string | null
          sla_due_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          internal_notes?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          related_order_id?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          internal_notes?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          related_order_id?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          flag_reason: string | null
          flagged: boolean
          id: string
          order_id: string | null
          provider: string | null
          provider_ref: string | null
          status: Database["public"]["Enums"]["txn_status"]
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          order_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          type: Database["public"]["Enums"]["txn_type"]
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          order_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          type?: Database["public"]["Enums"]["txn_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_finance_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "finance_admin"
        | "support_agent"
        | "moderator"
        | "marketing_admin"
        | "shopper"
        | "seller"
      approval_status: "pending" | "approved" | "rejected" | "needs_info"
      coupon_status: "active" | "paused" | "expired"
      discount_type: "percentage" | "fixed"
      dispute_status:
        | "open"
        | "in_review"
        | "resolved_shopper"
        | "resolved_seller"
        | "resolved_split"
        | "closed"
      featured_slot_type: "product" | "seller" | "category"
      flash_sale_status: "scheduled" | "active" | "ended" | "paused"
      kyc_status: "not_submitted" | "submitted" | "verified" | "failed"
      notification_audience: "all_shoppers" | "all_sellers" | "segment"
      notification_channel: "push" | "email"
      notification_status: "draft" | "scheduled" | "sent"
      order_status:
        | "pending"
        | "confirmed"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "returned"
        | "disputed"
      payout_status: "pending" | "processing" | "paid" | "on_hold" | "failed"
      product_status:
        | "pending"
        | "approved"
        | "rejected"
        | "unpublished"
        | "out_of_stock"
      referral_status: "pending" | "completed" | "expired"
      refund_status: "pending" | "approved" | "rejected" | "processed"
      review_status: "published" | "flagged" | "removed"
      review_target: "product" | "seller"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "waiting" | "resolved" | "closed"
      txn_status: "pending" | "succeeded" | "failed" | "cancelled"
      txn_type: "payment" | "payout" | "refund" | "chargeback"
      user_status: "active" | "suspended" | "banned"
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
      app_role: [
        "super_admin",
        "finance_admin",
        "support_agent",
        "moderator",
        "marketing_admin",
        "shopper",
        "seller",
      ],
      approval_status: ["pending", "approved", "rejected", "needs_info"],
      coupon_status: ["active", "paused", "expired"],
      discount_type: ["percentage", "fixed"],
      dispute_status: [
        "open",
        "in_review",
        "resolved_shopper",
        "resolved_seller",
        "resolved_split",
        "closed",
      ],
      featured_slot_type: ["product", "seller", "category"],
      flash_sale_status: ["scheduled", "active", "ended", "paused"],
      kyc_status: ["not_submitted", "submitted", "verified", "failed"],
      notification_audience: ["all_shoppers", "all_sellers", "segment"],
      notification_channel: ["push", "email"],
      notification_status: ["draft", "scheduled", "sent"],
      order_status: [
        "pending",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
        "returned",
        "disputed",
      ],
      payout_status: ["pending", "processing", "paid", "on_hold", "failed"],
      product_status: [
        "pending",
        "approved",
        "rejected",
        "unpublished",
        "out_of_stock",
      ],
      referral_status: ["pending", "completed", "expired"],
      refund_status: ["pending", "approved", "rejected", "processed"],
      review_status: ["published", "flagged", "removed"],
      review_target: ["product", "seller"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "in_progress", "waiting", "resolved", "closed"],
      txn_status: ["pending", "succeeded", "failed", "cancelled"],
      txn_type: ["payment", "payout", "refund", "chargeback"],
      user_status: ["active", "suspended", "banned"],
    },
  },
} as const
