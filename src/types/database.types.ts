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
      ai_draft_resolutions: {
        Row: {
          id: string
          tenant_id: string
          mailbox_id: string | null
          thread_id: string | null
          message_id: string | null
          outcome: Database["public"]["Enums"]["ai_draft_resolution_outcome"]
          resolved_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          mailbox_id?: string | null
          thread_id?: string | null
          message_id?: string | null
          outcome: Database["public"]["Enums"]["ai_draft_resolution_outcome"]
          resolved_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          mailbox_id?: string | null
          thread_id?: string | null
          message_id?: string | null
          outcome?: Database["public"]["Enums"]["ai_draft_resolution_outcome"]
          resolved_at?: string
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
      contacts: {
        Row: {
          alt_phone: string | null
          company_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          id: string
          is_archived: boolean
          last_name: string | null
          notes: string | null
          phone: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["contact_type"]
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          alt_phone?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_archived?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          tenant_id: string
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          alt_phone?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_archived?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
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
      invoices: {
        Row: {
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
          contact_id: string
          created_at: string
          created_by: string | null
          destination_address_id: string | null
          estimated_volume: number | null
          id: string
          is_archived: boolean
          notes: string | null
          origin_address_id: string | null
          preferred_move_date: string | null
          source: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          destination_address_id?: string | null
          estimated_volume?: number | null
          id?: string
          is_archived?: boolean
          notes?: string | null
          origin_address_id?: string | null
          preferred_move_date?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          destination_address_id?: string | null
          estimated_volume?: number | null
          id?: string
          is_archived?: boolean
          notes?: string | null
          origin_address_id?: string | null
          preferred_move_date?: string | null
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
            foreignKeyName: "mailboxes_tenant_id_fkey"
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
      pricing_settings: {
        Row: {
          base_rate: number
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
          computed_price: number | null
          contact_id: string
          created_at: string
          created_by: string | null
          deposit_amount: number | null
          final_price: number | null
          id: string
          lead_id: string | null
          public_token: string | null
          signature_data: string | null
          signature_name: string | null
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
          computed_price?: number | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          final_price?: number | null
          id?: string
          lead_id?: string | null
          public_token?: string | null
          signature_data?: string | null
          signature_name?: string | null
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
          computed_price?: number | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          final_price?: number | null
          id?: string
          lead_id?: string | null
          public_token?: string | null
          signature_data?: string | null
          signature_name?: string | null
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
          balance_due_days_before_move: number
          company_legal_name: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          onboarding_state: string | null
          phone: string | null
          primary_color: string | null
          tenant_id: string
          terms_template: string | null
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
          balance_due_days_before_move?: number
          company_legal_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          onboarding_state?: string | null
          phone?: string | null
          primary_color?: string | null
          tenant_id: string
          terms_template?: string | null
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
          balance_due_days_before_move?: number
          company_legal_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          onboarding_state?: string | null
          phone?: string | null
          primary_color?: string | null
          tenant_id?: string
          terms_template?: string | null
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
      internal_get_crew_contact_ids: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      internal_get_customer_contact_ids: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      is_super_admin: { Args: never; Returns: boolean }
      process_domain_event_for_activities: {
        Args: { p_event_id: string }
        Returns: undefined
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
    }
    Enums: {
      activity_type:
        | "note"
        | "status_change"
        | "email"
        | "call"
        | "task"
        | "system"
      ai_draft_resolution_outcome: "approved_unedited" | "approved_edited" | "discarded"
      ai_quoting_mode: "off" | "assist" | "quote_review" | "auto_send"
      assignment_role: "driver" | "porter" | "lead_crew" | "supervisor"
      contact_type: "residential" | "commercial" | "property_manager"
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
      payment_method: "card" | "apple_pay" | "google_pay" | "bank_transfer"
      payment_status: "pending" | "succeeded" | "failed" | "refunded"
      priority_level: "low" | "medium" | "high"
      quote_status: "draft" | "sent" | "accepted" | "declined" | "expired"
      saas_pricing_interval: "month" | "year"
      schedule_status: "pending" | "paid" | "overdue"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
      tenant_role: "tenant_admin" | "dispatcher" | "crew" | "customer"
      tenant_status:
        | "trialing"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled"
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
      ],
      ai_draft_resolution_outcome: ["approved_unedited", "approved_edited", "discarded"],
      ai_quoting_mode: ["off", "assist", "quote_review", "auto_send"],
      assignment_role: ["driver", "porter", "lead_crew", "supervisor"],
      contact_type: ["residential", "commercial", "property_manager"],
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
      payment_method: ["card", "apple_pay", "google_pay", "bank_transfer"],
      payment_status: ["pending", "succeeded", "failed", "refunded"],
      priority_level: ["low", "medium", "high"],
      quote_status: ["draft", "sent", "accepted", "declined", "expired"],
      saas_pricing_interval: ["month", "year"],
      schedule_status: ["pending", "paid", "overdue"],
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
    },
  },
} as const
