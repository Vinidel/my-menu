import type {
  AdminOrderStatusSnapshot,
  AdminOrdersDataAccess,
  AdminOrdersDataAccessResult,
  AdminOrderStatusUpdateRecord,
  ProgressAdminOrderStatusInput,
} from "@/lib/admin-orders-data-access";
import { ADMIN_ORDERS_SELECT_COLUMNS } from "@/lib/admin-orders-query";
import { parseAdminOrders } from "@/lib/orders";
import type { Database } from "@/lib/supabase/database.types";

const ADMIN_ORDER_STATUS_SNAPSHOT_COLUMNS = "status, fulfillment_type";
const ORDERS_TABLE_NAME = "orders";

type OrdersRow = Database["public"]["Tables"]["orders"]["Row"];

type OrdersListChain = {
  select: (columns: string) => {
    order: (
      column: "created_at",
      options: { ascending: true }
    ) => Promise<{
      data: OrdersRow[] | null;
      error?: {
        message?: string;
        code?: string;
      } | null;
    }>;
  };
};

type OrdersStatusLookupChain = {
  select: (columns: "status, fulfillment_type") => {
    eq: (column: "id", value: string) => {
      maybeSingle: () => Promise<{
        data:
          | {
              status: string | null;
              fulfillment_type?: string | null;
            }
          | null;
        error?: {
          message?: string;
          code?: string;
        } | null;
      }>;
    };
  };
};

type OrdersStatusUpdateChain = {
  update: (values: Database["public"]["Tables"]["orders"]["Update"]) => {
    eq: (column: "id", value: string) => {
      eq: (column: "status", value: string) => {
        select: (columns: "id, status") => {
          maybeSingle: () => Promise<{
            data: AdminOrderStatusUpdateRecord | null;
            error?: {
              message?: string;
              code?: string;
            } | null;
          }>;
        };
      };
    };
  };
};

export function createSupabaseAdminOrdersDataAccess(supabase: {
  from: (table: string) => unknown;
}): AdminOrdersDataAccess {
  return {
    async listAdminOrders() {
      const ordersTable = asOrdersListChain(supabase.from(ORDERS_TABLE_NAME));
      const { data, error } = await ordersTable
        .select(ADMIN_ORDERS_SELECT_COLUMNS)
        .order("created_at", { ascending: true });

      if (error) {
        return { data: null, error };
      }

      return {
        data: parseAdminOrders(Array.isArray(data) ? data : []),
        error: null,
      };
    },

    async getAdminOrderStatusSnapshot(orderId: string) {
      const ordersTable = asOrdersStatusLookupChain(supabase.from(ORDERS_TABLE_NAME));
      const { data, error } = await ordersTable
        .select(ADMIN_ORDER_STATUS_SNAPSHOT_COLUMNS)
        .eq("id", orderId)
        .maybeSingle();

      if (error) {
        return { data: null, error };
      }

      return {
        data: data
          ? {
              status: data.status,
              fulfillmentType: data.fulfillment_type ?? null,
            }
          : null,
        error: null,
      };
    },

    async progressAdminOrderStatusConditionally(input: ProgressAdminOrderStatusInput) {
      const ordersTable = asOrdersStatusUpdateChain(supabase.from(ORDERS_TABLE_NAME));
      const { data, error } = await ordersTable
        .update({ status: input.nextStatus })
        .eq("id", input.orderId)
        .eq("status", input.currentStatus)
        .select("id, status")
        .maybeSingle();

      if (error) {
        return { data: null, error };
      }

      return { data, error: null };
    },
  };
}

function asOrdersListChain(value: unknown): OrdersListChain {
  return value as OrdersListChain;
}

function asOrdersStatusLookupChain(value: unknown): OrdersStatusLookupChain {
  return value as OrdersStatusLookupChain;
}

function asOrdersStatusUpdateChain(value: unknown): OrdersStatusUpdateChain {
  return value as OrdersStatusUpdateChain;
}
