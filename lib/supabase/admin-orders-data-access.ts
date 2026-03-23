import type {
  AdminOrderEditSnapshot,
  AdminOrderStatusSnapshot,
  AdminOrdersDataAccess,
  AdminOrdersDataAccessError,
  AdminOrdersDataAccessResult,
  AdminOrderStatusUpdateRecord,
  ProgressAdminOrderStatusInput,
  UpdateAdminOrderDetailsInput,
} from "@/lib/admin-orders-data-access";
import { ADMIN_ORDERS_SELECT_COLUMNS } from "@/lib/admin-orders-query";
import { parseAdminOrder, parseAdminOrders } from "@/lib/orders";
import type { Database } from "@/lib/supabase/database.types";

const ADMIN_ORDER_STATUS_SNAPSHOT_COLUMNS = "status, fulfillment_type";
const ADMIN_ORDER_EDIT_SNAPSHOT_COLUMNS = "updated_at";
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

type OrdersByIdLookupChain = {
  select: (columns: string) => {
    eq: (column: "is_deleted", value: false) => {
      eq: (column: "id", value: string) => {
        maybeSingle: () => Promise<{
          data: OrdersRow | null;
          error?: {
            message?: string;
            code?: string;
          } | null;
        }>;
      };
    };
  };
};

type OrdersEditLookupChain = {
  select: (columns: "updated_at") => {
    eq: (column: "is_deleted", value: false) => {
      eq: (column: "id", value: string) => {
        maybeSingle: () => Promise<{
          data:
            | {
                updated_at?: string | null;
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
  update: (values: Database["public"]["Tables"]["orders"]["Update"]) => {
    eq: (column: "id", value: string) => {
      eq: (column: "updated_at", value: string) => {
        eq: (column: "is_deleted", value: false) => {
          select: (columns: string) => {
            maybeSingle: () => Promise<{
              data: OrdersRow | null;
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

    async getAdminOrderById(orderId: string) {
      const ordersTable = getOrdersByIdLookupTable(supabase);
      const { data, error } = await ordersTable
        .select(ADMIN_ORDERS_SELECT_COLUMNS)
        .eq(ACTIVE_ORDER_FILTER_COLUMN, false)
        .eq("id", orderId)
        .maybeSingle();

      if (error) {
        return errorResult(error);
      }

      return successResult(data ? parseAdminOrder(data) : null);
    },

    async getAdminOrderEditSnapshot(orderId: string) {
      const ordersTable = getOrdersEditLookupTable(supabase);
      const { data, error } = await ordersTable
        .select(ADMIN_ORDER_EDIT_SNAPSHOT_COLUMNS)
        .eq(ACTIVE_ORDER_FILTER_COLUMN, false)
        .eq("id", orderId)
        .maybeSingle();

      if (error) {
        return errorResult(error);
      }

      return successResult<AdminOrderEditSnapshot | null>(
        data ? { updatedAt: data.updated_at ?? null } : null
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

    async updateAdminOrderDetailsConditionally(input: UpdateAdminOrderDetailsInput) {
      const ordersTable = getOrdersEditUpdateTable(supabase);
      const { data, error } = await ordersTable
        .update({
          customer_name: input.customerName,
          customer_email: input.customerEmail,
          customer_phone: input.customerPhone,
          notes: input.notes,
          payment_method: input.paymentMethod,
          items: input.items,
        })
        .eq("id", input.orderId)
        .eq("updated_at", input.expectedUpdatedAt)
        .eq(ACTIVE_ORDER_FILTER_COLUMN, false)
        .select(ADMIN_ORDERS_SELECT_COLUMNS)
        .maybeSingle();

      if (error) {
        return errorResult(error);
      }

      return successResult(data ? parseAdminOrder(data) : null);
    },
  };
}

function getOrdersListTable(supabase: { from: (table: string) => unknown }) {
  return asOrdersListChain(supabase.from(ORDERS_TABLE_NAME));
}

function getOrdersStatusLookupTable(supabase: { from: (table: string) => unknown }) {
  return asOrdersStatusLookupChain(supabase.from(ORDERS_TABLE_NAME));
}

function getOrdersByIdLookupTable(supabase: { from: (table: string) => unknown }) {
  return asOrdersByIdLookupChain(supabase.from(ORDERS_TABLE_NAME));
}

function getOrdersEditLookupTable(supabase: { from: (table: string) => unknown }) {
  return asOrdersEditLookupChain(supabase.from(ORDERS_TABLE_NAME));
}

function getOrdersStatusUpdateTable(supabase: { from: (table: string) => unknown }) {
  return asOrdersStatusUpdateChain(supabase.from(ORDERS_TABLE_NAME));
}

function getOrdersEditUpdateTable(supabase: { from: (table: string) => unknown }) {
  return asOrdersEditUpdateChain(supabase.from(ORDERS_TABLE_NAME));
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

function asOrdersByIdLookupChain(value: unknown): OrdersByIdLookupChain {
  return value as OrdersByIdLookupChain;
}

function asOrdersEditLookupChain(value: unknown): OrdersEditLookupChain {
  return value as OrdersEditLookupChain;
}

function asOrdersStatusUpdateChain(value: unknown): OrdersStatusUpdateChain {
  return value as OrdersStatusUpdateChain;
}

function asOrdersEditUpdateChain(value: unknown): OrdersEditUpdateChain {
  return value as OrdersEditUpdateChain;
}
