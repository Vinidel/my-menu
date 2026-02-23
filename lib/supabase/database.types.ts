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
      orders: {
        Row: {
          id: string;
          reference: string;
          customer_name: string;
          customer_email: string;
          customer_phone: string;
          items: Json;
          status: "aguardando_confirmacao" | "em_preparo" | "entregue";
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference?: string;
          customer_name: string;
          customer_email: string;
          customer_phone: string;
          items?: Json;
          status?: "aguardando_confirmacao" | "em_preparo" | "entregue";
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference?: string;
          customer_name?: string;
          customer_email?: string;
          customer_phone?: string;
          items?: Json;
          status?: "aguardando_confirmacao" | "em_preparo" | "entregue";
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
