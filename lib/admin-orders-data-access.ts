import type { AdminOrder, OrderStatus } from "@/lib/orders";

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

export interface AdminOrdersDataAccess {
  listAdminOrders(): Promise<AdminOrdersDataAccessResult<AdminOrder[]>>;
  getAdminOrderStatusSnapshot(
    orderId: string
  ): Promise<AdminOrdersDataAccessResult<AdminOrderStatusSnapshot | null>>;
  progressAdminOrderStatusConditionally(
    input: ProgressAdminOrderStatusInput
  ): Promise<AdminOrdersDataAccessResult<AdminOrderStatusUpdateRecord | null>>;
}
