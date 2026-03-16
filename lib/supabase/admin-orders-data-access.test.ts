import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminOrdersDataAccess } from "./admin-orders-data-access";

vi.mock("@/lib/orders", () => ({
  parseAdminOrders: vi.fn((rows: unknown[]) => rows),
}));

import { parseAdminOrders } from "@/lib/orders";

describe("createSupabaseAdminOrdersDataAccess", () => {
  beforeEach(() => {
    vi.mocked(parseAdminOrders).mockClear();
  });

  it("lists only active admin orders with the shared select columns and oldest-first ordering", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: "1", reference: "PED-1" }],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const dataAccess = createSupabaseAdminOrdersDataAccess({ from });

    const result = await dataAccess.listAdminOrders();

    expect(from).toHaveBeenCalledWith("orders");
    expect(select).toHaveBeenCalledWith(
      "id, reference, customer_name, customer_email, customer_phone, payment_method, fulfillment_type, delivery_fee_cents, items, status, notes, created_at"
    );
    expect(eq).toHaveBeenCalledWith("is_deleted", false);
    expect(order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(parseAdminOrders).toHaveBeenCalledWith([{ id: "1", reference: "PED-1" }]);
    expect(result).toEqual({
      data: [{ id: "1", reference: "PED-1" }],
      error: null,
    });
  });

  it("loads order status snapshots and maps fulfillment_type to fulfillmentType", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { status: "em_preparo", fulfillment_type: "entrega" },
      error: null,
    });
    const eqId = vi.fn().mockReturnValue({ maybeSingle });
    const eqActive = vi.fn().mockReturnValue({ eq: eqId });
    const select = vi.fn().mockReturnValue({ eq: eqActive });
    const from = vi.fn().mockReturnValue({ select });
    const dataAccess = createSupabaseAdminOrdersDataAccess({ from });

    const result = await dataAccess.getAdminOrderStatusSnapshot("order-1");

    expect(from).toHaveBeenCalledWith("orders");
    expect(select).toHaveBeenCalledWith("status, fulfillment_type");
    expect(eqActive).toHaveBeenCalledWith("is_deleted", false);
    expect(eqId).toHaveBeenCalledWith("id", "order-1");
    expect(result).toEqual({
      data: { status: "em_preparo", fulfillmentType: "entrega" },
      error: null,
    });
  });

  it("performs conditional status progression only for active rows using the expected optimistic write shape", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "order-1", status: "pronto_para_retirada" },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eqActive = vi.fn().mockReturnValue({ select });
    const eqStatus = vi.fn().mockReturnValue({ eq: eqActive });
    const eqId = vi.fn().mockReturnValue({ eq: eqStatus });
    const update = vi.fn().mockReturnValue({ eq: eqId });
    const from = vi.fn().mockReturnValue({ update });
    const dataAccess = createSupabaseAdminOrdersDataAccess({ from });

    const result = await dataAccess.progressAdminOrderStatusConditionally({
      orderId: "order-1",
      currentStatus: "em_preparo",
      nextStatus: "pronto_para_retirada",
    });

    expect(from).toHaveBeenCalledWith("orders");
    expect(update).toHaveBeenCalledWith({ status: "pronto_para_retirada" });
    expect(eqId).toHaveBeenCalledWith("id", "order-1");
    expect(eqStatus).toHaveBeenCalledWith("status", "em_preparo");
    expect(eqActive).toHaveBeenCalledWith("is_deleted", false);
    expect(select).toHaveBeenCalledWith("id, status");
    expect(result).toEqual({
      data: { id: "order-1", status: "pronto_para_retirada" },
      error: null,
    });
  });

  it("returns adapter errors without parsing when list lookup fails", async () => {
    const order = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "boom", code: "500" },
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const dataAccess = createSupabaseAdminOrdersDataAccess({ from });

    const result = await dataAccess.listAdminOrders();

    expect(parseAdminOrders).not.toHaveBeenCalled();
    expect(result).toEqual({
      data: null,
      error: { message: "boom", code: "500" },
    });
  });
});
