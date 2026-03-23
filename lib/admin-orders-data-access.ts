import type { AdminOrder, OrderStatus } from "@/lib/orders";
import { createSupabaseAdminOrdersDataAccess } from "@/lib/supabase/admin-orders-data-access";

export type AdminOrdersDataAccessError = {
  message?: string;
  code?: string;
};

export type AdminOrderStatusSnapshot = {
  status: string | null;
  fulfillmentType: string | null;
};

export type AdminOrderStatusUpdateRecord = {
  id: string;
  status: string;
};

export type AdminOrderEditSnapshot = {
  updatedAt: string | null;
};

export type UpdateAdminOrderDetailsInput = {
  orderId: string;
  expectedUpdatedAt: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  notes: string | null;
  paymentMethod: string | null;
  items: AdminOrder["items"];
};

export type AdminOrdersDataAccessResult<T> =
  | { data: T; error: null }
  | { data: null; error: AdminOrdersDataAccessError };

export type ProgressAdminOrderStatusInput = {
  orderId: string;
  currentStatus: OrderStatus;
  nextStatus: OrderStatus;
};

export interface AdminOrdersDataAccess {
  listAdminOrders(): Promise<AdminOrdersDataAccessResult<AdminOrder[]>>;
  getAdminOrderById(orderId: string): Promise<AdminOrdersDataAccessResult<AdminOrder | null>>;
  getAdminOrderStatusSnapshot(
    orderId: string
  ): Promise<AdminOrdersDataAccessResult<AdminOrderStatusSnapshot | null>>;
  getAdminOrderEditSnapshot(
    orderId: string
  ): Promise<AdminOrdersDataAccessResult<AdminOrderEditSnapshot | null>>;
  progressAdminOrderStatusConditionally(
    input: ProgressAdminOrderStatusInput
  ): Promise<AdminOrdersDataAccessResult<AdminOrderStatusUpdateRecord | null>>;
  updateAdminOrderDetailsConditionally(
    input: UpdateAdminOrderDetailsInput
  ): Promise<AdminOrdersDataAccessResult<AdminOrder | null>>;
}

export function createAdminOrdersDataAccess(client: {
  from: (table: string) => unknown;
}): AdminOrdersDataAccess {
  return createSupabaseAdminOrdersDataAccess(client);
}
