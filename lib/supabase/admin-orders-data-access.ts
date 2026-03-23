import type {
  AdminOrderStatusSnapshot,
  AdminOrdersDataAccess,
  AdminOrdersDataAccessError,
  AdminOrdersDataAccessResult,
  AdminOrderStatusUpdateRecord,
  ProgressAdminOrderStatusInput,
  UpdateAdminOrderInput,
  UpdateAdminOrderRecord,
} from "@/lib/admin-orders-data-access";
import { ADMIN_ORDERS_SELECT_COLUMNS } from "@/lib/admin-orders-query";
import { parseAdminOrders } from "@/lib/orders";
import type { Database } from "@/lib/supabase/database.types";

const ADMIN_ORDER_STATUS_SNAPSHOT_COLUMNS = "status, fulfillment_type";
const ADMIN_ORDER_STATUS_UPDATE_COLUMNS = "id, status";
const ORDERS_TABLE_NAME = "orders";
const ACTIVE_ORDER_FILTER_COLUMN = "is_deleted";

type OrdersRow = Database["public"]["Tables"]["orders"]["Row"];

type OrdersListChain = {
  select: (columns: string) => {
    eq: (column: "is_deleted", value: false) => {
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
};

type OrdersStatusLookupChain = {
  select: (columns: "status, fulfillment_type") => {
    eq: (column: "is_deleted", value: false) => {
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
};

type OrdersStatusUpdateChain = {
  update: (values: Database["public"]["Tables"]["orders"]["Update"]) => {
    eq: (column: "id", value: string) => {
      eq: (column: "status", value: string) => {
        eq: (column: "is_deleted", value: false) => {
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
};

type OrdersEditUpdateChain = {
  update: (values: Record<string, unknown>) => {
    eq: (column: "id", value: string) => {
      eq: (column: "is_deleted", value: false) => {
        select: (columns: "id") => {
          maybeSingle: () => Promise<{
            data: UpdateAdminOrderRecord | null;
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
      const ordersTable = getOrdersListTable(supabase);
      const { data, error } = await ordersTable
        .select(ADMIN_ORDERS_SELECT_COLUMNS)
        .eq(ACTIVE_ORDER_FILTER_COLUMN, false)
        .order("created_at", { ascending: true });

      if (error) {
        return errorResult(error);
      }

      return successResult(parseAdminOrders(Array.isArray(data) ? data : []));
    },

    async getAdminOrderStatusSnapshot(orderId: string) {
      const ordersTable = getOrdersStatusLookupTable(supabase);
      const { data, error } = await ordersTable
        .select(ADMIN_ORDER_STATUS_SNAPSHOT_COLUMNS)
        .eq(ACTIVE_ORDER_FILTER_COLUMN, false)
        .eq("id", orderId)
        .maybeSingle();

      if (error) {
        return errorResult(error);
      }

      return successResult(
        data
          ? {
              status: data.status,
              fulfillmentType: data.fulfillment_type ?? null,
            }
          : null
      );
    },

    async progressAdminOrderStatusConditionally(input: ProgressAdminOrderStatusInput) {
      const ordersTable = getOrdersStatusUpdateTable(supabase);
      const { data, error } = await ordersTable
        .update({ status: input.nextStatus })
        .eq("id", input.orderId)
        .eq("status", input.currentStatus)
        .eq(ACTIVE_ORDER_FILTER_COLUMN, false)
        .select(ADMIN_ORDER_STATUS_UPDATE_COLUMNS)
        .maybeSingle();

      if (error) {
        return errorResult(error);
      }

      return successResult(data);
    },

    async updateAdminOrder(input: UpdateAdminOrderInput) {
      const ordersTable = getOrdersEditUpdateTable(supabase);
      const { data, error } = await ordersTable
        .update({
          customer_name: input.payload.customer_name,
          customer_email: input.payload.customer_email,
          customer_phone: input.payload.customer_phone,
          payment_method: input.payload.payment_method,
          fulfillment_type: input.payload.fulfillment_type,
          delivery_fee_cents: input.payload.delivery_fee_cents,
          notes: input.payload.notes,
          items: input.payload.items,
        })
        .eq("id", input.orderId)
        .eq(ACTIVE_ORDER_FILTER_COLUMN, false)
        .select("id")
        .maybeSingle();

      if (error) {
        return errorResult(error);
      }

      return successResult(data);
    },
  };
}

function getOrdersListTable(supabase: { from: (table: string) => unknown }) {
  return asOrdersListChain(supabase.from(ORDERS_TABLE_NAME));
}

function getOrdersStatusLookupTable(supabase: { from: (table: string) => unknown }) {
  return asOrdersStatusLookupChain(supabase.from(ORDERS_TABLE_NAME));
}

function getOrdersStatusUpdateTable(supabase: { from: (table: string) => unknown }) {
  return asOrdersStatusUpdateChain(supabase.from(ORDERS_TABLE_NAME));
}

function getOrdersEditUpdateTable(supabase: { from: (table: string) => unknown }) {
  return asOrdersEditUpdateChain(supabase.from(ORDERS_TABLE_NAME));
}

function asOrdersEditUpdateChain(value: unknown): OrdersEditUpdateChain {
  return value as OrdersEditUpdateChain;
}

function successResult<T>(data: T): AdminOrdersDataAccessResult<T> {
  return { data, error: null };
}

function errorResult<T>(error: AdminOrdersDataAccessError): AdminOrdersDataAccessResult<T> {
  return { data: null, error };
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
