export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      menu_import_jobs: {
        Row: {
          id: string;
          created_by: string | null;
          status:
            | "uploaded"
            | "processing"
            | "ready"
            | "ready_with_issues"
            | "failed"
            | "published"
            | "discarded";
          storage_bucket: string;
          storage_path: string;
          storage_mime: string;
          storage_size_bytes: number;
          storage_pages: Json;
          menu_version_id: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          created_by?: string | null;
          status?:
            | "uploaded"
            | "processing"
            | "ready"
            | "ready_with_issues"
            | "failed"
            | "published"
            | "discarded";
          storage_bucket: string;
          storage_path: string;
          storage_mime: string;
          storage_size_bytes: number;
          storage_pages?: Json;
          menu_version_id?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          created_by?: string | null;
          status?:
            | "uploaded"
            | "processing"
            | "ready"
            | "ready_with_issues"
            | "failed"
            | "published"
            | "discarded";
          storage_bucket?: string;
          storage_path?: string;
          storage_mime?: string;
          storage_size_bytes?: number;
          storage_pages?: Json;
          menu_version_id?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_import_jobs_menu_version_id_fkey";
            columns: ["menu_version_id"];
            isOneToOne: false;
            referencedRelation: "menu_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_versions: {
        Row: {
          id: string;
          source: "seed_json" | "image_import";
          status: "draft" | "active" | "archived";
          data: Json;
          created_by: string | null;
          published_by: string | null;
          import_job_id: string | null;
          image_bucket: string | null;
          image_path: string | null;
          image_mime: string | null;
          image_size_bytes: number | null;
          image_pages: Json;
          extraction_provider: string | null;
          extraction_issues: Json;
          notes: string | null;
          created_at: string;
          published_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source?: "seed_json" | "image_import";
          status?: "draft" | "active" | "archived";
          data: Json;
          created_by?: string | null;
          published_by?: string | null;
          import_job_id?: string | null;
          image_bucket?: string | null;
          image_path?: string | null;
          image_mime?: string | null;
          image_size_bytes?: number | null;
          image_pages?: Json;
          extraction_provider?: string | null;
          extraction_issues?: Json;
          notes?: string | null;
          created_at?: string;
          published_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source?: "seed_json" | "image_import";
          status?: "draft" | "active" | "archived";
          data?: Json;
          created_by?: string | null;
          published_by?: string | null;
          import_job_id?: string | null;
          image_bucket?: string | null;
          image_path?: string | null;
          image_mime?: string | null;
          image_size_bytes?: number | null;
          image_pages?: Json;
          extraction_provider?: string | null;
          extraction_issues?: Json;
          notes?: string | null;
          created_at?: string;
          published_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_versions_import_job_id_fkey";
            columns: ["import_job_id"];
            isOneToOne: false;
            referencedRelation: "menu_import_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string;
          email_normalized: string | null;
          phone_normalized: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone: string;
          email_normalized?: string | null;
          phone_normalized: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          phone?: string;
          email_normalized?: string | null;
          phone_normalized?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          reference: string;
          customer_id: string | null;
          customer_name: string;
          customer_email: string | null;
          customer_phone: string;
          payment_method: string | null;
          fulfillment_type: string | null;
          delivery_fee_cents: number | null;
          items: Json;
          status:
            | "aguardando_confirmacao"
            | "em_preparo"
            | "pronto_para_retirada"
            | "saiu_para_entrega"
            | "entregue";
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference?: string;
          customer_id?: string | null;
          customer_name: string;
          customer_email?: string | null;
          customer_phone: string;
          payment_method?: string | null;
          fulfillment_type?: string | null;
          delivery_fee_cents?: number | null;
          items?: Json;
          status?:
            | "aguardando_confirmacao"
            | "em_preparo"
            | "pronto_para_retirada"
            | "saiu_para_entrega"
            | "entregue";
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference?: string;
          customer_id?: string | null;
          customer_name?: string;
          customer_email?: string | null;
          customer_phone?: string;
          payment_method?: string | null;
          fulfillment_type?: string | null;
          delivery_fee_cents?: number | null;
          items?: Json;
          status?:
            | "aguardando_confirmacao"
            | "em_preparo"
            | "pronto_para_retirada"
            | "saiu_para_entrega"
            | "entregue";
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {};
    Functions: {
      menu_import_queue_enqueue: {
        Args: {
          p_job_id: string;
          p_version_id: string;
        };
        Returns: number;
      };
      menu_import_queue_read: {
        Args: {
          p_visibility_timeout_seconds?: number;
          p_limit?: number;
        };
        Returns: {
          msg_id: number;
          read_ct: number;
          enqueued_at: string;
          vt: string;
          message: Json;
        }[];
      };
      menu_import_queue_delete: {
        Args: {
          p_msg_id: number;
        };
        Returns: boolean;
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
};
