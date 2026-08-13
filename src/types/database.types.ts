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
      activities: {
        Row: {
          contact_id: string | null
          content: string
          created_at: string
          created_by: string | null
          edited_at: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          source_event_id: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          contact_id?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          edited_at?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          source_event_id?: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          contact_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          edited_at?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          source_event_id?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: true
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_activity_contact"
            columns: ["contact_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "fk_activity_lead"
            columns: ["lead_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      addresses: {
        Row: {
          access_notes: string | null
          city: string
          country: string
          county: string | null
          created_at: string
          floor_level: number | null
          has_lift: boolean | null
          id: string
          lat: number | null
          line_1: string
          line_2: string | null
          lng: number | null
          parking_notes: string | null
          postcode: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          access_notes?: string | null
          city: string
          country?: string
          county?: string | null
          created_at?: string
          floor_level?: number | null
          has_lift?: boolean | null
          id?: string
          lat?: number | null
          line_1: string
          line_2?: string | null
          lng?: number | null
          parking_notes?: string | null
          postcode: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          access_notes?: string | null
          city?: string
          country?: string
          county?: string | null
          created_at?: string
          floor_level?: number | null
          has_lift?: boolean | null
          id?: string
          lat?: number | null
          line_1?: string
          line_2?: string | null
          lng?: number | null
          parking_notes?: string | null
          postcode?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_draft_resolutions: {
        Row: {
          id: string
          mailbox_id: string | null
          message_id: string | null
          outcome: Database["public"]["Enums"]["ai_draft_resolution_outcome"]
          resolved_at: string
          tenant_id: string
          thread_id: string | null
        }
        Insert: {
          id?: string
          mailbox_id?: string | null
          message_id?: string | null
          outcome: Database["public"]["Enums"]["ai_draft_resolution_outcome"]
          resolved_at?: string
          tenant_id: string
          thread_id?: string | null
        }
        Update: {
          id?: string
          mailbox_id?: string | null
          message_id?: string | null
          outcome?: Database["public"]["Enums"]["ai_draft_resolution_outcome"]
          resolved_at?: string
          tenant_id?: string
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_draft_resolutions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          end_time: string
          id: string
          start_time: string
          status: string
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          start_time: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          start_time?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_workflow_actions: {
        Row: {
          action_config: Json
          action_type: Database["public"]["Enums"]["workflow_action_type"]
          created_at: string
          id: string
          sort_order: number
          tenant_id: string
          workflow_id: string
        }
        Insert: {
          action_config?: Json
          action_type: Database["public"]["Enums"]["workflow_action_type"]
          created_at?: string
          id?: string
          sort_order: number
          tenant_id: string
          workflow_id: string
        }
        Update: {
          action_config?: Json
          action_type?: Database["public"]["Enums"]["workflow_action_type"]
          created_at?: string
          id?: string
          sort_order?: number
          tenant_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_workflow_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_workflow_actions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "automation_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_workflow_execution_log: {
        Row: {
          created_at: string
          event_id: string
          id: string
          logs: Json
          status: Database["public"]["Enums"]["workflow_execution_status"]
          tenant_id: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          logs?: Json
          status: Database["public"]["Enums"]["workflow_execution_status"]
          tenant_id: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          logs?: Json
          status?: Database["public"]["Enums"]["workflow_execution_status"]
          tenant_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_workflow_execution_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_workflow_execution_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_workflow_execution_log_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "automation_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_workflows: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          trigger_conditions: Json
          trigger_event_type: Database["public"]["Enums"]["workflow_trigger_event_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          trigger_conditions?: Json
          trigger_event_type: Database["public"]["Enums"]["workflow_trigger_event_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          trigger_conditions?: Json
          trigger_event_type?: Database["public"]["Enums"]["workflow_trigger_event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_workflows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_county: string | null
          address_line_1: string | null
          address_line_2: string | null
          address_postcode: string | null
          bank_details: string | null
          created_at: string
          email: string | null
          id: string
          is_default: boolean
          logo_url: string | null
          name: string
          phone: string | null
          public_widget_key: string
          tenant_id: string
          terms_text: string | null
          updated_at: string | null
          vat_number: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_county?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          address_postcode?: string | null
          bank_details?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_default?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          public_widget_key?: string
          tenant_id: string
          terms_text?: string | null
          updated_at?: string | null
          vat_number?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_county?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          address_postcode?: string | null
          bank_details?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_default?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          public_widget_key?: string
          tenant_id?: string
          terms_text?: string | null
          updated_at?: string | null
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_social_accounts: {
        Row: {
          aggregator_profile_id: string
          connected_at: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          platform: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          aggregator_profile_id: string
          connected_at?: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          platform: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          aggregator_profile_id?: string
          connected_at?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          platform?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connected_social_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_addresses: {
        Row: {
          address_id: string
          contact_id: string
          created_at: string
          id: string
          label: string | null
          tenant_id: string
        }
        Insert: {
          address_id: string
          contact_id: string
          created_at?: string
          id?: string
          label?: string | null
          tenant_id: string
        }
        Update: {
          address_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          label?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_addresses_address_fk"
            columns: ["address_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "contact_addresses_contact_fk"
            columns: ["contact_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "contact_addresses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_pricing_overrides: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          discount_percent: number
          id: string
          is_active: boolean
          notes: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          discount_percent: number
          id?: string
          is_active?: boolean
          notes?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          discount_percent?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_pricing_overrides_contact_fk"
            columns: ["contact_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "contact_pricing_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_pricing_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          alt_phone: string | null
          best_time_to_call: string | null
          company_name: string | null
          created_at: string
          created_by: string | null
          default_payment_method_id: string | null
          email: string | null
          first_name: string
          id: string
          is_archived: boolean
          last_name: string | null
          notes: string | null
          phone: string | null
          preferred_contact_method:
            | Database["public"]["Enums"]["contact_method"]
            | null
          stripe_customer_id: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["contact_type"]
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          alt_phone?: string | null
          best_time_to_call?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          default_payment_method_id?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_archived?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact_method?:
            | Database["public"]["Enums"]["contact_method"]
            | null
          stripe_customer_id?: string | null
          tenant_id: string
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          alt_phone?: string | null
          best_time_to_call?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          default_payment_method_id?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_archived?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact_method?:
            | Database["public"]["Enums"]["contact_method"]
            | null
          stripe_customer_id?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_user_fk"
            columns: ["user_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      crate_charges: {
        Row: {
          amount: number
          charge_type: Database["public"]["Enums"]["crate_charge_type"]
          crate_id: string
          created_at: string
          error: string | null
          id: string
          invoice_id: string | null
          period_start: string
          status: Database["public"]["Enums"]["crate_charge_status"]
          stripe_payment_intent_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          charge_type: Database["public"]["Enums"]["crate_charge_type"]
          crate_id: string
          created_at?: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          period_start: string
          status?: Database["public"]["Enums"]["crate_charge_status"]
          stripe_payment_intent_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          charge_type?: Database["public"]["Enums"]["crate_charge_type"]
          crate_id?: string
          created_at?: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          period_start?: string
          status?: Database["public"]["Enums"]["crate_charge_status"]
          stripe_payment_intent_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crate_charges_crate_fk"
            columns: ["crate_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "crates"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "crate_charges_invoice_fk"
            columns: ["invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "crate_charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crates: {
        Row: {
          contact_id: string | null
          crate_number: string
          created_at: string
          expected_return_date: string | null
          id: string
          job_id: string | null
          rented_since: string | null
          status: Database["public"]["Enums"]["crate_status"]
          storage_unit_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          contact_id?: string | null
          crate_number: string
          created_at?: string
          expected_return_date?: string | null
          id?: string
          job_id?: string | null
          rented_since?: string | null
          status?: Database["public"]["Enums"]["crate_status"]
          storage_unit_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          contact_id?: string | null
          crate_number?: string
          created_at?: string
          expected_return_date?: string | null
          id?: string
          job_id?: string | null
          rented_since?: string | null
          status?: Database["public"]["Enums"]["crate_status"]
          storage_unit_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crates_contact_fk"
            columns: ["contact_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "crates_job_fk"
            columns: ["job_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "crates_storage_unit_fk"
            columns: ["storage_unit_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "storage_units"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "crates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_run_log: {
        Row: {
          completed_at: string
          created_at: string
          error_message: string | null
          id: string
          job_name: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          error_message?: string | null
          id?: string
          job_name: string
          started_at: string
          status: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          error_message?: string | null
          id?: string
          job_name?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      domain_events: {
        Row: {
          event_type: string
          id: string
          occurred_at: string
          payload: Json
          processed_at: string | null
          source_module: string
          tenant_id: string
        }
        Insert: {
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          source_module: string
          tenant_id: string
        }
        Update: {
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          source_module?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_label_assignments: {
        Row: {
          applied_at: string
          applied_by: string | null
          id: string
          label_id: string
          tenant_id: string
          thread_id: string
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          id?: string
          label_id: string
          tenant_id: string
          thread_id: string
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          id?: string
          label_id?: string
          tenant_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_label_assignments_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_label_assignments_label_fk"
            columns: ["label_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "email_labels"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "email_label_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_label_assignments_thread_fk"
            columns: ["thread_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      email_label_suggestions: {
        Row: {
          id: string
          label_id: string
          model: string
          suggested_at: string
          tenant_id: string
          thread_id: string
        }
        Insert: {
          id?: string
          label_id: string
          model: string
          suggested_at?: string
          tenant_id: string
          thread_id: string
        }
        Update: {
          id?: string
          label_id?: string
          model?: string
          suggested_at?: string
          tenant_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_label_suggestions_label_fk"
            columns: ["label_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "email_labels"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "email_label_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_label_suggestions_thread_fk"
            columns: ["thread_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      email_labels: {
        Row: {
          color_hex: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          color_hex: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          color_hex?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_labels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          ai_metadata: Json | null
          authored_by: Database["public"]["Enums"]["email_authored_by"]
          body_html: string | null
          body_text: string | null
          claimed_at: string | null
          created_at: string
          direction: Database["public"]["Enums"]["email_direction"]
          from_address: string
          id: string
          mailbox_id: string | null
          occurred_at: string | null
          received_at: string | null
          requires_approval: boolean
          sent_at: string | null
          source_message_id: string | null
          tenant_id: string
          thread_id: string
          to_addresses: string[] | null
        }
        Insert: {
          ai_metadata?: Json | null
          authored_by: Database["public"]["Enums"]["email_authored_by"]
          body_html?: string | null
          body_text?: string | null
          claimed_at?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["email_direction"]
          from_address: string
          id?: string
          mailbox_id?: string | null
          occurred_at?: string | null
          received_at?: string | null
          requires_approval?: boolean
          sent_at?: string | null
          source_message_id?: string | null
          tenant_id: string
          thread_id: string
          to_addresses?: string[] | null
        }
        Update: {
          ai_metadata?: Json | null
          authored_by?: Database["public"]["Enums"]["email_authored_by"]
          body_html?: string | null
          body_text?: string | null
          claimed_at?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["email_direction"]
          from_address?: string
          id?: string
          mailbox_id?: string | null
          occurred_at?: string | null
          received_at?: string | null
          requires_approval?: boolean
          sent_at?: string | null
          source_message_id?: string | null
          tenant_id?: string
          thread_id?: string
          to_addresses?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_mailbox_fk"
            columns: ["mailbox_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "email_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_thread_fk"
            columns: ["thread_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      email_threads: {
        Row: {
          brand_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          lead_id: string | null
          mailbox_id: string
          participant_addresses: string[] | null
          provider_thread_id: string | null
          subject: string | null
          tenant_id: string
        }
        Insert: {
          brand_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          mailbox_id: string
          participant_addresses?: string[] | null
          provider_thread_id?: string | null
          subject?: string | null
          tenant_id: string
        }
        Update: {
          brand_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          mailbox_id?: string
          participant_addresses?: string[] | null
          provider_thread_id?: string | null
          subject?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_contact_fk"
            columns: ["contact_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "email_threads_lead_fk"
            columns: ["lead_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "email_threads_mailbox_fk"
            columns: ["mailbox_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "email_threads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          default_volume: number
          id: string
          is_active: boolean
          name: string
          room: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          default_volume?: number
          id?: string
          is_active?: boolean
          name: string
          room?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          default_volume?: number
          id?: string
          is_active?: boolean
          name?: string
          room?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          tenant_id: string
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          tenant_id: string
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          tenant_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_fk"
            columns: ["invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "invoice_line_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          layout_blocks: Json
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          layout_blocks?: Json
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          layout_blocks?: Json
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_templates_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          brand_id: string
          brand_snapshot: Json
          contact_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          issued_at: string | null
          job_id: string | null
          notes: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tenant_id: string
          total: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          brand_id: string
          brand_snapshot: Json
          contact_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          job_id?: string | null
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          total?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          brand_id?: string
          brand_snapshot?: Json
          contact_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          job_id?: string | null
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          total?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contact_fk"
            columns: ["contact_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_fk"
            columns: ["job_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_crew_assignments: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          assignment_role: Database["public"]["Enums"]["assignment_role"]
          created_at: string
          id: string
          job_id: string
          notes: string | null
          scheduled_end: string
          scheduled_start: string
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          assignment_role?: Database["public"]["Enums"]["assignment_role"]
          created_at?: string
          id?: string
          job_id: string
          notes?: string | null
          scheduled_end: string
          scheduled_start: string
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          assignment_role?: Database["public"]["Enums"]["assignment_role"]
          created_at?: string
          id?: string
          job_id?: string
          notes?: string | null
          scheduled_end?: string
          scheduled_start?: string
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_crew_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_crew_job_fk"
            columns: ["job_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "job_crew_user_fk"
            columns: ["user_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      job_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          job_id: string
          storage_path: string
          taken_at: string
          tenant_id: string
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          job_id: string
          storage_path: string
          taken_at?: string
          tenant_id: string
          uploaded_by: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          job_id?: string
          storage_path?: string
          taken_at?: string
          tenant_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_signoffs: {
        Row: {
          captured_by: string | null
          created_at: string
          document_hash: string
          id: string
          ip_address: string | null
          job_id: string
          signature_name: string
          signature_storage_path: string
          signed_at: string
          tenant_id: string
        }
        Insert: {
          captured_by?: string | null
          created_at?: string
          document_hash: string
          id?: string
          ip_address?: string | null
          job_id: string
          signature_name: string
          signature_storage_path: string
          signed_at?: string
          tenant_id: string
        }
        Update: {
          captured_by?: string | null
          created_at?: string
          document_hash?: string
          id?: string
          ip_address?: string | null
          job_id?: string
          signature_name?: string
          signature_storage_path?: string
          signed_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_signoffs_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_signoffs_job_fk"
            columns: ["job_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "job_signoffs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_vehicle_assignments: {
        Row: {
          created_at: string
          id: string
          job_id: string
          notes: string | null
          scheduled_end: string
          scheduled_start: string
          tenant_id: string
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          notes?: string | null
          scheduled_end: string
          scheduled_start: string
          tenant_id: string
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          notes?: string | null
          scheduled_end?: string
          scheduled_start?: string
          tenant_id?: string
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_vehicle_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_vehicle_job_fk"
            columns: ["job_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "job_vehicle_vehicle_fk"
            columns: ["vehicle_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      jobs: {
        Row: {
          brand_id: string
          completion_summary: Json | null
          completion_summary_generated_at: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          customer_notes: string | null
          destination_address_id: string | null
          id: string
          internal_notes: string | null
          move_date: string | null
          origin_address_id: string | null
          quote_id: string | null
          status: Database["public"]["Enums"]["job_status"]
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          brand_id: string
          completion_summary?: Json | null
          completion_summary_generated_at?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          customer_notes?: string | null
          destination_address_id?: string | null
          id?: string
          internal_notes?: string | null
          move_date?: string | null
          origin_address_id?: string | null
          quote_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          brand_id?: string
          completion_summary?: Json | null
          completion_summary_generated_at?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          customer_notes?: string | null
          destination_address_id?: string | null
          id?: string
          internal_notes?: string | null
          move_date?: string | null
          origin_address_id?: string | null
          quote_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_contact_fk"
            columns: ["contact_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_destination_address_fk"
            columns: ["destination_address_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "jobs_origin_address_fk"
            columns: ["origin_address_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "jobs_quote_fk"
            columns: ["quote_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          brand_id: string
          contact_id: string
          created_at: string
          created_by: string | null
          destination_address_id: string | null
          estimated_crew_size: number | null
          estimated_hours: number | null
          estimated_volume: number | null
          id: string
          is_archived: boolean
          notes: string | null
          origin_address_id: string | null
          preferred_move_date: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          source: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          brand_id: string
          contact_id: string
          created_at?: string
          created_by?: string | null
          destination_address_id?: string | null
          estimated_crew_size?: number | null
          estimated_hours?: number | null
          estimated_volume?: number | null
          id?: string
          is_archived?: boolean
          notes?: string | null
          origin_address_id?: string | null
          preferred_move_date?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          brand_id?: string
          contact_id?: string
          created_at?: string
          created_by?: string | null
          destination_address_id?: string | null
          estimated_crew_size?: number | null
          estimated_hours?: number | null
          estimated_volume?: number | null
          id?: string
          is_archived?: boolean
          notes?: string | null
          origin_address_id?: string | null
          preferred_move_date?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fk"
            columns: ["assigned_to", "tenant_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "leads_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_fk"
            columns: ["contact_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_destination_address_fk"
            columns: ["destination_address_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "leads_origin_address_fk"
            columns: ["origin_address_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mailbox_sync_lock: {
        Row: {
          id: boolean
          is_running: boolean
          started_at: string | null
        }
        Insert: {
          id?: boolean
          is_running?: boolean
          started_at?: string | null
        }
        Update: {
          id?: boolean
          is_running?: boolean
          started_at?: string | null
        }
        Relationships: []
      }
      mailboxes: {
        Row: {
          brand_id: string | null
          connection_method: Database["public"]["Enums"]["mailbox_connection_method"]
          created_at: string
          encrypted_credential: string | null
          id: string
          imap_host: string | null
          imap_port: number | null
          is_active: boolean
          last_sync_error: string | null
          last_synced_at: string | null
          mailbox_address: string | null
          provider: Database["public"]["Enums"]["mailbox_provider"]
          smtp_host: string | null
          smtp_port: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          connection_method: Database["public"]["Enums"]["mailbox_connection_method"]
          created_at?: string
          encrypted_credential?: string | null
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          is_active?: boolean
          last_sync_error?: string | null
          last_synced_at?: string | null
          mailbox_address?: string | null
          provider: Database["public"]["Enums"]["mailbox_provider"]
          smtp_host?: string | null
          smtp_port?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          connection_method?: Database["public"]["Enums"]["mailbox_connection_method"]
          created_at?: string
          encrypted_credential?: string | null
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          is_active?: boolean
          last_sync_error?: string | null
          last_synced_at?: string | null
          mailbox_address?: string | null
          provider?: Database["public"]["Enums"]["mailbox_provider"]
          smtp_host?: string | null
          smtp_port?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mailboxes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mailboxes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          dedup_key: string | null
          id: string
          message: string
          notification_type: Database["public"]["Enums"]["notification_type_enum"]
          read_at: string | null
          source_event_id: string | null
          target_user_id: string
          tenant_id: string
          title: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          dedup_key?: string | null
          id?: string
          message: string
          notification_type: Database["public"]["Enums"]["notification_type_enum"]
          read_at?: string | null
          source_event_id?: string | null
          target_user_id: string
          tenant_id: string
          title: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          dedup_key?: string | null
          id?: string
          message?: string
          notification_type?: Database["public"]["Enums"]["notification_type_enum"]
          read_at?: string | null
          source_event_id?: string | null
          target_user_id?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedules: {
        Row: {
          amount: number
          created_at: string
          description: string
          due_date: string
          id: string
          invoice_id: string
          status: Database["public"]["Enums"]["schedule_status"]
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          due_date: string
          id?: string
          invoice_id: string
          status?: Database["public"]["Enums"]["schedule_status"]
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          invoice_id?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_invoice_fk"
            columns: ["invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "payment_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string | null
          payment_schedule_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          payment_schedule_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          payment_schedule_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_fk"
            columns: ["invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "payments_schedule_fk"
            columns: ["payment_schedule_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "payment_schedules"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string
          dismissible: boolean
          ends_at: string | null
          id: string
          severity: Database["public"]["Enums"]["announcement_severity_enum"]
          starts_at: string | null
          target_ids: string[]
          target_type: Database["public"]["Enums"]["announcement_target_type_enum"]
          title: string
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          dismissible?: boolean
          ends_at?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["announcement_severity_enum"]
          starts_at?: string | null
          target_ids?: string[]
          target_type?: Database["public"]["Enums"]["announcement_target_type_enum"]
          title: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          dismissible?: boolean
          ends_at?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["announcement_severity_enum"]
          starts_at?: string | null
          target_ids?: string[]
          target_type?: Database["public"]["Enums"]["announcement_target_type_enum"]
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_mrr_snapshots: {
        Row: {
          active_tenant_count: number
          created_at: string
          id: string
          mrr: number
          snapshot_date: string
        }
        Insert: {
          active_tenant_count: number
          created_at?: string
          id?: string
          mrr: number
          snapshot_date: string
        }
        Update: {
          active_tenant_count?: number
          created_at?: string
          id?: string
          mrr?: number
          snapshot_date?: string
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          base_rate: number
          crate_lost_fee: number
          crate_overdue_rate_per_day: number
          created_at: string
          id: string
          labor_hourly_rate: number
          labour_hours_per_cubicft: number
          per_cubic_foot_rate: number
          per_mile_rate: number
          surcharges: Json | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          base_rate?: number
          crate_lost_fee?: number
          crate_overdue_rate_per_day?: number
          created_at?: string
          id?: string
          labor_hourly_rate?: number
          labour_hours_per_cubicft?: number
          per_cubic_foot_rate?: number
          per_mile_rate?: number
          surcharges?: Json | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          base_rate?: number
          crate_lost_fee?: number
          crate_overdue_rate_per_day?: number
          created_at?: string
          id?: string
          labor_hourly_rate?: number
          labour_hours_per_cubicft?: number
          per_cubic_foot_rate?: number
          per_mile_rate?: number
          surcharges?: Json | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      public_lead_submission_log: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          outcome: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          outcome: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          outcome?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_lead_submission_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      public_signup_log: {
        Row: {
          created_at: string | null
          id: string
          ip_address: unknown
          outcome: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address: unknown
          outcome: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: unknown
          outcome?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_signup_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_inventory: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          item_name: string
          quantity: number
          quote_id: string
          room: string | null
          tenant_id: string
          volume: number
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          item_name: string
          quantity?: number
          quote_id: string
          room?: string | null
          tenant_id: string
          volume?: number
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          item_name?: string
          quantity?: number
          quote_id?: string
          room?: string | null
          tenant_id?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_inventory_item_fk"
            columns: ["inventory_item_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "quote_inventory_quote_fk"
            columns: ["quote_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "quote_inventory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_line_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          quantity: number
          quote_id: string
          sort_order: number
          tenant_id: string
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          quantity?: number
          quote_id: string
          sort_order?: number
          tenant_id: string
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          quote_id?: string
          sort_order?: number
          tenant_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_quote_fk"
            columns: ["quote_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "quote_line_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_signatures: {
        Row: {
          created_at: string
          document_hash: string
          id: string
          ip_address: string | null
          quote_id: string
          signature_name: string
          signature_storage_path: string
          signed_at: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          document_hash: string
          id?: string
          ip_address?: string | null
          quote_id: string
          signature_name: string
          signature_storage_path: string
          signed_at?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          document_hash?: string
          id?: string
          ip_address?: string | null
          quote_id?: string
          signature_name?: string
          signature_storage_path?: string
          signed_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_signatures_quote_fk"
            columns: ["quote_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "quote_signatures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_surcharges: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          quote_id: string
          surcharge_key: string
          surcharge_label: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          quote_id: string
          surcharge_key: string
          surcharge_label?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          quote_id?: string
          surcharge_key?: string
          surcharge_label?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_surcharges_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_surcharges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          brand_id: string
          computed_price: number | null
          contact_id: string
          created_at: string
          created_by: string | null
          deposit_amount: number | null
          final_price: number | null
          id: string
          lead_id: string | null
          negotiated_discount_percent: number | null
          public_token: string | null
          signature_data: string | null
          signature_name: string | null
          standard_price: number | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          surcharge_total: number
          tenant_id: string
          terms: string | null
          total_price: number
          total_volume: number | null
          travel_distance_miles: number | null
          travel_time_minutes: number | null
          updated_at: string | null
          updated_by: string | null
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          brand_id: string
          computed_price?: number | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          final_price?: number | null
          id?: string
          lead_id?: string | null
          negotiated_discount_percent?: number | null
          public_token?: string | null
          signature_data?: string | null
          signature_name?: string | null
          standard_price?: number | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          surcharge_total?: number
          tenant_id: string
          terms?: string | null
          total_price?: number
          total_volume?: number | null
          travel_distance_miles?: number | null
          travel_time_minutes?: number | null
          updated_at?: string | null
          updated_by?: string | null
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          brand_id?: string
          computed_price?: number | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          final_price?: number | null
          id?: string
          lead_id?: string | null
          negotiated_discount_percent?: number | null
          public_token?: string | null
          signature_data?: string | null
          signature_name?: string | null
          standard_price?: number | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          surcharge_total?: number
          tenant_id?: string
          terms?: string | null
          total_price?: number
          total_volume?: number | null
          travel_distance_miles?: number | null
          travel_time_minutes?: number | null
          updated_at?: string | null
          updated_by?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_contact_fk"
            columns: ["contact_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_lead_fk"
            columns: ["lead_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      route_cache: {
        Row: {
          created_at: string
          destination_key: string
          distance_meters: number
          duration_seconds: number
          id: string
          origin_key: string
        }
        Insert: {
          created_at?: string
          destination_key: string
          distance_meters: number
          duration_seconds: number
          id?: string
          origin_key: string
        }
        Update: {
          created_at?: string
          destination_key?: string
          distance_meters?: number
          duration_seconds?: number
          id?: string
          origin_key?: string
        }
        Relationships: []
      }
      saas_plans: {
        Row: {
          created_at: string | null
          description: string | null
          entitlements: Json | null
          id: string
          is_active: boolean | null
          name: string
          stripe_product_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          entitlements?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          entitlements?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      saas_prices: {
        Row: {
          created_at: string | null
          currency: string | null
          id: string
          interval: Database["public"]["Enums"]["saas_pricing_interval"] | null
          is_active: boolean | null
          plan_id: string | null
          stripe_price_id: string
          unit_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          id?: string
          interval?: Database["public"]["Enums"]["saas_pricing_interval"] | null
          is_active?: boolean | null
          plan_id?: string | null
          stripe_price_id: string
          unit_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          id?: string
          interval?: Database["public"]["Enums"]["saas_pricing_interval"] | null
          is_active?: boolean | null
          plan_id?: string | null
          stripe_price_id?: string
          unit_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saas_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_posts: {
        Row: {
          account_ids: string[]
          claimed_at: string | null
          content: string
          created_at: string
          id: string
          publish_results: Json | null
          scheduled_for: string
          status: Database["public"]["Enums"]["scheduled_post_status"]
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          account_ids: string[]
          claimed_at?: string | null
          content: string
          created_at?: string
          id?: string
          publish_results?: Json | null
          scheduled_for: string
          status?: Database["public"]["Enums"]["scheduled_post_status"]
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          account_ids?: string[]
          claimed_at?: string | null
          content?: string
          created_at?: string
          id?: string
          publish_results?: Json | null
          scheduled_for?: string
          status?: Database["public"]["Enums"]["scheduled_post_status"]
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_units: {
        Row: {
          capacity_cubic_feet: number
          created_at: string
          id: string
          is_available: boolean
          location_notes: string | null
          tenant_id: string
          unit_number: string
          updated_at: string | null
        }
        Insert: {
          capacity_cubic_feet: number
          created_at?: string
          id?: string
          is_available?: boolean
          location_notes?: string | null
          tenant_id: string
          unit_number: string
          updated_at?: string | null
        }
        Update: {
          capacity_cubic_feet?: number
          created_at?: string
          id?: string
          is_available?: boolean
          location_notes?: string | null
          tenant_id?: string
          unit_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_units_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_task_assignee"
            columns: ["assigned_to", "tenant_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "fk_task_contact"
            columns: ["contact_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "fk_task_lead"
            columns: ["lead_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "platform_announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_announcement_dismissals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_announcement_dismissals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_form_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          label: string | null
          last_used_at: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string | null
          last_used_at?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string | null
          last_used_at?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_form_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invoice_sequences: {
        Row: {
          created_at: string
          last_number: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          last_number?: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          last_number?: number
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invoice_sequences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_modules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module_key: string
          settings: Json | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key: string
          settings?: Json | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key?: string
          settings?: Json | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_county: string | null
          address_line_1: string | null
          address_line_2: string | null
          address_postcode: string | null
          ai_quoting_mode: Database["public"]["Enums"]["ai_quoting_mode"]
          ayrshare_profile_key: string | null
          balance_due_days_before_move: number
          company_legal_name: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          onboarding_state: string | null
          phone: string | null
          primary_color: string | null
          social_aggregator_profile_id: string | null
          tenant_id: string
          terms_template: string | null
          ui_theme: Database["public"]["Enums"]["ui_theme"]
          updated_at: string | null
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_county?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          address_postcode?: string | null
          ai_quoting_mode?: Database["public"]["Enums"]["ai_quoting_mode"]
          ayrshare_profile_key?: string | null
          balance_due_days_before_move?: number
          company_legal_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          onboarding_state?: string | null
          phone?: string | null
          primary_color?: string | null
          social_aggregator_profile_id?: string | null
          tenant_id: string
          terms_template?: string | null
          ui_theme?: Database["public"]["Enums"]["ui_theme"]
          updated_at?: string | null
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_county?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          address_postcode?: string | null
          ai_quoting_mode?: Database["public"]["Enums"]["ai_quoting_mode"]
          ayrshare_profile_key?: string | null
          balance_due_days_before_move?: number
          company_legal_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          onboarding_state?: string | null
          phone?: string | null
          primary_color?: string | null
          social_aggregator_profile_id?: string | null
          tenant_id?: string
          terms_template?: string | null
          ui_theme?: Database["public"]["Enums"]["ui_theme"]
          updated_at?: string | null
          vat_number?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          id: string
          manually_suspended: boolean
          past_due_since: string | null
          price_id: string | null
          status: Database["public"]["Enums"]["tenant_status"]
          stripe_subscription_id: string | null
          suspension_reason: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          manually_suspended?: boolean
          past_due_since?: string | null
          price_id?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          stripe_subscription_id?: string | null
          suspension_reason?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          manually_suspended?: boolean
          past_due_since?: string | null
          price_id?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          stripe_subscription_id?: string | null
          suspension_reason?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "saas_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          base_currency: string
          created_at: string
          id: string
          name: string
          public_widget_key: string
          settings: Json | null
          slug: string
          stripe_connected_account_id: string | null
          stripe_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          base_currency?: string
          created_at?: string
          id?: string
          name: string
          public_widget_key?: string
          settings?: Json | null
          slug: string
          stripe_connected_account_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          base_currency?: string
          created_at?: string
          id?: string
          name?: string
          public_widget_key?: string
          settings?: Json | null
          slug?: string
          stripe_connected_account_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["tenant_role"] | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["tenant_role"] | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["tenant_role"] | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_documents: {
        Row: {
          document_type: Database["public"]["Enums"]["vehicle_document_type"]
          expiry_date: string | null
          file_path: string
          id: string
          tenant_id: string
          uploaded_at: string
          uploaded_by: string
          vehicle_id: string
        }
        Insert: {
          document_type: Database["public"]["Enums"]["vehicle_document_type"]
          expiry_date?: string | null
          file_path: string
          id?: string
          tenant_id: string
          uploaded_at?: string
          uploaded_by: string
          vehicle_id: string
        }
        Update: {
          document_type?: Database["public"]["Enums"]["vehicle_document_type"]
          expiry_date?: string | null
          file_path?: string
          id?: string
          tenant_id?: string
          uploaded_at?: string
          uploaded_by?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_documents_vehicle_fk"
            columns: ["vehicle_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      vehicle_maintenance_records: {
        Row: {
          cost: number | null
          created_at: string
          id: string
          logged_by: string
          maintenance_type: Database["public"]["Enums"]["vehicle_maintenance_type"]
          next_due_date: string | null
          notes: string | null
          performed_at: string
          tenant_id: string
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          id?: string
          logged_by: string
          maintenance_type: Database["public"]["Enums"]["vehicle_maintenance_type"]
          next_due_date?: string | null
          notes?: string | null
          performed_at: string
          tenant_id: string
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          id?: string
          logged_by?: string
          maintenance_type?: Database["public"]["Enums"]["vehicle_maintenance_type"]
          next_due_date?: string | null
          notes?: string | null
          performed_at?: string
          tenant_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_records_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_records_vehicle_fk"
            columns: ["vehicle_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      vehicles: {
        Row: {
          capacity_cubic: number | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          registration: string | null
          tenant_id: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          capacity_cubic?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          registration?: string | null
          tenant_id: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          capacity_cubic?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          registration?: string | null
          tenant_id?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_rate_limits: {
        Row: {
          count: number | null
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          widget_key: string | null
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          widget_key?: string | null
        }
        Update: {
          count?: number | null
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          widget_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "widget_rate_limits_widget_key_fkey"
            columns: ["widget_key"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["public_widget_key"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_quote_transaction:
        | {
            Args: {
              p_contact_id: string
              p_destination_address_id: string
              p_lead_id: string
              p_move_date: string
              p_origin_address_id: string
              p_quote_id: string
              p_tenant_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_balance_schedule?: Json
              p_contact_id: string
              p_deposit_schedule?: Json
              p_destination_address_id: string
              p_invoice_subtotal?: number
              p_invoice_tax_amount?: number
              p_invoice_total?: number
              p_lead_id: string
              p_line_items?: Json
              p_move_date: string
              p_origin_address_id: string
              p_quote_id: string
              p_stripe_payment_intent_id?: string
              p_tenant_id: string
            }
            Returns: Json
          }
      calculate_quote_price: {
        Args: {
          p_distance_meters: number
          p_quote_id: string
          p_selected_surcharge_keys: string[]
          p_tenant_id: string
          p_total_volume: number
        }
        Returns: {
          computed_price: number
          distance_cost: number
          final_total: number
          labour_cost: number
          minimum_adjustment: number
          subtotal: number
          surcharge_total: number
          volume_cost: number
        }[]
      }
      create_crate_charge_invoice: {
        Args: {
          p_amount: number
          p_charge_type: Database["public"]["Enums"]["crate_charge_type"]
          p_contact_id: string
          p_crate_id: string
          p_description: string
          p_period_start: string
          p_tenant_id: string
        }
        Returns: Json
      }
      create_manual_job_transaction:
        | {
            Args: {
              p_brand_id: string
              p_contact_id: string
              p_destination_address_id: string
              p_invoice_subtotal: number
              p_invoice_tax_amount: number
              p_invoice_total: number
              p_line_items: Json
              p_move_date: string
              p_origin_address_id: string
              p_tenant_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_contact_id: string
              p_destination_address_id: string
              p_invoice_subtotal: number
              p_invoice_tax_amount: number
              p_invoice_total: number
              p_line_items: Json
              p_move_date: string
              p_origin_address_id: string
              p_tenant_id: string
            }
            Returns: Json
          }
      current_tenant_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      emit_domain_event: {
        Args: {
          p_event_type: string
          p_payload?: Json
          p_source_module: string
          p_tenant_id?: string
        }
        Returns: string
      }
      generate_invoice_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      generate_proposal_token: { Args: never; Returns: string }
      get_contact_ltv: {
        Args: { p_contact_id: string; p_tenant_id: string }
        Returns: number
      }
      get_conversion_funnel: {
        Args: { p_end_date: string; p_start_date: string; p_tenant_id: string }
        Returns: Json
      }
      get_crate_stats: {
        Args: { p_tenant_id: string }
        Returns: {
          available_crates: number
          in_use_crates: number
          total_crates: number
        }[]
      }
      get_repeat_customers: {
        Args: { p_tenant_id: string }
        Returns: {
          completed_jobs_count: number
          contact_id: string
        }[]
      }
      get_tenant_new_clients_over_time: {
        Args: { p_end_date: string; p_start_date: string; p_tenant_id: string }
        Returns: {
          bucket_date: string
          new_clients: number
          period: string
        }[]
      }
      get_tenant_quotes_bookings_over_time: {
        Args: { p_end_date: string; p_start_date: string; p_tenant_id: string }
        Returns: {
          bucket_date: string
          confirmed_bookings: number
          conversion_rate: number
          period: string
          quotes_sent: number
        }[]
      }
      get_tenant_revenue_over_time: {
        Args: { p_end_date: string; p_start_date: string; p_tenant_id: string }
        Returns: {
          bucket_date: string
          collected_revenue: number
          invoiced_revenue: number
          period: string
        }[]
      }
      get_tenant_status_transitions: {
        Args: never
        Returns: {
          changed_at: string
          new_status: string
          old_status: string
          tenant_id: string
        }[]
      }
      internal_create_invoice_snapshot:
        | {
            Args: {
              p_balance_schedule: Json
              p_brand_id: string
              p_contact_id: string
              p_deposit_schedule: Json
              p_invoice_subtotal: number
              p_invoice_tax_amount: number
              p_invoice_total: number
              p_job_id: string
              p_line_items: Json
              p_tenant_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_balance_schedule: Json
              p_contact_id: string
              p_deposit_schedule: Json
              p_invoice_subtotal: number
              p_invoice_tax_amount: number
              p_invoice_total: number
              p_job_id: string
              p_line_items: Json
              p_tenant_id: string
            }
            Returns: string
          }
      internal_get_crew_contact_ids: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      internal_get_customer_contact_ids: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      is_super_admin: { Args: never; Returns: boolean }
      mark_crate_charge_failed: {
        Args: {
          p_crate_charge_id: string
          p_error: string
          p_status: Database["public"]["Enums"]["crate_charge_status"]
          p_tenant_id: string
        }
        Returns: undefined
      }
      process_domain_event_for_activities: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      record_crate_charge_payment: {
        Args: {
          p_amount: number
          p_crate_charge_id: string
          p_stripe_intent_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
      record_invoice_payment: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_schedule_id: string
          p_stripe_intent_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
      save_quote_inventory: {
        Args: {
          p_items: Database["public"]["CompositeTypes"]["quote_inventory_input"][]
          p_quote_id: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      save_workflow_transaction: {
        Args: {
          p_actions: Json
          p_is_active: boolean
          p_name: string
          p_tenant_id: string
          p_trigger_conditions: Json
          p_trigger_event_type: Database["public"]["Enums"]["workflow_trigger_event_type"]
          p_workflow_id: string
        }
        Returns: Json
      }
      set_staff_status: {
        Args: {
          p_new_is_active?: boolean
          p_new_role?: Database["public"]["Enums"]["tenant_role"]
          p_target_user_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
      sync_tenant_subscription_from_webhook: {
        Args: {
          p_cancel_at_period_end?: boolean
          p_clear_price_id?: boolean
          p_current_period_end?: string
          p_event_id: string
          p_event_type: string
          p_price_id?: string
          p_status?: Database["public"]["Enums"]["tenant_status"]
          p_stripe_subscription_id?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      update_draft_invoice: {
        Args: {
          p_invoice_id: string
          p_line_items: Json
          p_notes: string
          p_tenant_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      activity_type:
        | "note"
        | "status_change"
        | "email"
        | "call"
        | "task"
        | "system"
        | "stage_change"
      ai_draft_resolution_outcome:
        | "approved_unedited"
        | "approved_edited"
        | "discarded"
      ai_quoting_mode: "off" | "assist" | "quote_review" | "auto_send"
      announcement_severity_enum: "info" | "warning" | "critical"
      announcement_target_type_enum:
        | "all_tenants"
        | "specific_tenants"
        | "by_plan"
      assignment_role: "driver" | "porter" | "lead_crew" | "supervisor"
      contact_method: "phone" | "email" | "text"
      contact_type: "residential" | "commercial" | "property_manager"
      crate_charge_status: "pending" | "charged" | "failed" | "requires_action"
      crate_charge_type: "overdue_fee" | "lost_fee"
      crate_status:
        | "in_warehouse"
        | "reserved"
        | "with_customer"
        | "returned"
        | "lost"
        | "damaged"
      email_authored_by: "human" | "ai_draft_pending" | "ai_sent"
      email_direction: "inbound" | "outbound"
      invoice_status:
        | "draft"
        | "sent"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "void"
      job_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      lead_stage:
        | "inquiry"
        | "survey_scheduled"
        | "quote_sent"
        | "follow_up"
        | "confirmed_booking"
        | "completed"
        | "archived"
      mailbox_connection_method: "oauth" | "imap_password"
      mailbox_provider: "gmail" | "outlook" | "imap_generic"
      notification_type_enum:
        | "new_lead"
        | "quote_accepted"
        | "task_assigned"
        | "trial_expiring_soon"
      payment_method: "card" | "apple_pay" | "google_pay" | "bank_transfer"
      payment_status: "pending" | "succeeded" | "failed" | "refunded"
      priority_level: "low" | "medium" | "high"
      quote_status: "draft" | "sent" | "accepted" | "declined" | "expired"
      saas_pricing_interval: "month" | "year"
      schedule_status: "pending" | "paid" | "overdue"
      scheduled_post_status:
        | "pending"
        | "published"
        | "partial"
        | "failed"
        | "cancelled"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
      tenant_role: "tenant_admin" | "dispatcher" | "crew" | "customer"
      tenant_status:
        | "trialing"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled"
      ui_theme: "default" | "dark"
      vehicle_document_type:
        | "insurance"
        | "mot"
        | "registration"
        | "service_invoice"
        | "other"
      vehicle_maintenance_type:
        | "service"
        | "repair"
        | "tyre_change"
        | "inspection"
        | "other"
      workflow_action_type: "create_task" | "update_lead_stage"
      workflow_execution_status: "pending" | "success" | "partial" | "failed"
      workflow_trigger_event_type:
        | "lead.created"
        | "lead.stage_changed"
        | "lead.updated"
        | "task.completed"
        | "email.received"
        | "email.label_added"
    }
    CompositeTypes: {
      quote_inventory_input: {
        inventory_item_id: string | null
        room: string | null
        quantity: number | null
        item_name: string | null
        volume: number | null
      }
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
      activity_type: [
        "note",
        "status_change",
        "email",
        "call",
        "task",
        "system",
        "stage_change",
      ],
      ai_draft_resolution_outcome: [
        "approved_unedited",
        "approved_edited",
        "discarded",
      ],
      ai_quoting_mode: ["off", "assist", "quote_review", "auto_send"],
      announcement_severity_enum: ["info", "warning", "critical"],
      announcement_target_type_enum: [
        "all_tenants",
        "specific_tenants",
        "by_plan",
      ],
      assignment_role: ["driver", "porter", "lead_crew", "supervisor"],
      contact_method: ["phone", "email", "text"],
      contact_type: ["residential", "commercial", "property_manager"],
      crate_charge_status: ["pending", "charged", "failed", "requires_action"],
      crate_charge_type: ["overdue_fee", "lost_fee"],
      crate_status: [
        "in_warehouse",
        "reserved",
        "with_customer",
        "returned",
        "lost",
        "damaged",
      ],
      email_authored_by: ["human", "ai_draft_pending", "ai_sent"],
      email_direction: ["inbound", "outbound"],
      invoice_status: [
        "draft",
        "sent",
        "partially_paid",
        "paid",
        "overdue",
        "void",
      ],
      job_status: ["scheduled", "in_progress", "completed", "cancelled"],
      lead_stage: [
        "inquiry",
        "survey_scheduled",
        "quote_sent",
        "follow_up",
        "confirmed_booking",
        "completed",
        "archived",
      ],
      mailbox_connection_method: ["oauth", "imap_password"],
      mailbox_provider: ["gmail", "outlook", "imap_generic"],
      notification_type_enum: [
        "new_lead",
        "quote_accepted",
        "task_assigned",
        "trial_expiring_soon",
      ],
      payment_method: ["card", "apple_pay", "google_pay", "bank_transfer"],
      payment_status: ["pending", "succeeded", "failed", "refunded"],
      priority_level: ["low", "medium", "high"],
      quote_status: ["draft", "sent", "accepted", "declined", "expired"],
      saas_pricing_interval: ["month", "year"],
      schedule_status: ["pending", "paid", "overdue"],
      scheduled_post_status: [
        "pending",
        "published",
        "partial",
        "failed",
        "cancelled",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["pending", "in_progress", "completed", "cancelled"],
      tenant_role: ["tenant_admin", "dispatcher", "crew", "customer"],
      tenant_status: [
        "trialing",
        "active",
        "past_due",
        "suspended",
        "cancelled",
      ],
      ui_theme: ["default", "dark"],
      vehicle_document_type: [
        "insurance",
        "mot",
        "registration",
        "service_invoice",
        "other",
      ],
      vehicle_maintenance_type: [
        "service",
        "repair",
        "tyre_change",
        "inspection",
        "other",
      ],
      workflow_action_type: ["create_task", "update_lead_stage"],
      workflow_execution_status: ["pending", "success", "partial", "failed"],
      workflow_trigger_event_type: [
        "lead.created",
        "lead.stage_changed",
        "lead.updated",
        "task.completed",
        "email.received",
        "email.label_added",
      ],
    },
  },
} as const
