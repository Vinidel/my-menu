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
      customers: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string;
          email_normalized: string;
          phone_normalized: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone: string;
          email_normalized: string;
          phone_normalized: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          phone?: string;
          email_normalized?: string;
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
          customer_email: string;
          customer_phone: string;
          payment_method: string | null;
          items: Json;
          status: "aguardando_confirmacao" | "em_preparo" | "entregue";
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference?: string;
          customer_id?: string | null;
          customer_name: string;
          customer_email: string;
          customer_phone: string;
          payment_method?: string | null;
          items?: Json;
          status?: "aguardando_confirmacao" | "em_preparo" | "entregue";
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference?: string;
          customer_id?: string | null;
          customer_name?: string;
          customer_email?: string;
          customer_phone?: string;
          payment_method?: string | null;
          items?: Json;
          status?: "aguardando_confirmacao" | "em_preparo" | "entregue";
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
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
