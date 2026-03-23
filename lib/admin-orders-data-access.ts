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

export type AdminOrdersDataAccessResult<T> =
  | { data: T; error: null }
  | { data: null; error: AdminOrdersDataAccessError };

export type ProgressAdminOrderStatusInput = {
  orderId: string;
  currentStatus: OrderStatus;
  nextStatus: OrderStatus;
};

export type UpdateAdminOrderPayload = {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  payment_method: string;
  fulfillment_type: string;
  delivery_fee_cents: number;
  notes: string | null;
  items: unknown;
};

export type UpdateAdminOrderInput = {
  orderId: string;
  payload: UpdateAdminOrderPayload;
};

export type UpdateAdminOrderRecord = {
  id: string;
};

export interface AdminOrdersDataAccess {
  listAdminOrders(): Promise<AdminOrdersDataAccessResult<AdminOrder[]>>;
  getAdminOrderStatusSnapshot(
    orderId: string
  ): Promise<AdminOrdersDataAccessResult<AdminOrderStatusSnapshot | null>>;
  progressAdminOrderStatusConditionally(
    input: ProgressAdminOrderStatusInput
  ): Promise<AdminOrdersDataAccessResult<AdminOrderStatusUpdateRecord | null>>;
  updateAdminOrder(
    input: UpdateAdminOrderInput
  ): Promise<AdminOrdersDataAccessResult<UpdateAdminOrderRecord | null>>;
}

export function createAdminOrdersDataAccess(client: {
  from: (table: string) => unknown;
}): AdminOrdersDataAccess {
  return createSupabaseAdminOrdersDataAccess(client);
}
