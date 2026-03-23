"use server";

import { revalidatePath } from "next/cache";
import type { FulfillmentType } from "@/lib/fulfillment-types";
import { getMenuItemMap, type MenuItem } from "@/lib/menu";
import { validateAndBuildOrderPayload, type OrderSubmitInput } from "@/lib/order-submit-validation";
import { createRequestClient } from "@/lib/request-client";
import type { Database } from "@/lib/supabase/database.types";

const SETUP_ERROR_MESSAGE =
  "Pedidos indisponíveis no momento. Verifique a configuração do Supabase.";
const SUBMIT_ERROR_MESSAGE =
  "Não foi possível enviar seu pedido agora. Tente novamente em instantes.";

export type SubmitCustomerOrderInput = OrderSubmitInput;

export type SubmitCustomerOrderResult =
  | { ok: true; orderReference: string }
  | {
      ok: false;
      code: "setup" | "validation" | "unknown";
      message: string;
    };

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
type OrderStatus = Database["public"]["Tables"]["orders"]["Row"]["status"];
type CustomerIdRow = Pick<CustomerRow, "id">;
type SupabaseTableError = { message: string; code?: string | null } | null;
type CustomerMaybeSingleResult = Promise<{
  data: CustomerIdRow | null;
  error: SupabaseTableError;
}>;
type OrdersTablesClient = {
  from: (table: "customers" | "orders") => unknown;
};
export async function submitCustomerOrder(
  input: SubmitCustomerOrderInput
): Promise<SubmitCustomerOrderResult> {
  const supabase = await createRequestClient();
  if (!supabase) {
    return submitErrorResult("setup", SETUP_ERROR_MESSAGE);
  }

  return submitCustomerOrderWithClient(input, supabase);
}

export async function submitCustomerOrderWithClient(
  input: SubmitCustomerOrderInput,
  supabase: OrdersTablesClient,
  menuMapOverride?: Map<string, MenuItem>
): Promise<SubmitCustomerOrderResult> {
  const menuMap = menuMapOverride ?? getMenuItemMap();
  const validation = validateAndBuildOrderPayload(input, menuMap);

  if (!validation.ok) {
    return submitErrorResult("validation", validation.message);
  }

  const { payload } = validation;
  const normalizedEmail = normalizeOptionalEmail(payload.customer_email);

  try {
    const customerId = await findOrCreateCustomer(supabase, {
      name: payload.customer_name,
      email: payload.customer_email,
      phone: payload.customer_phone,
      email_normalized: normalizedEmail,
      phone_normalized: payload.customer_phone,
    });

    if (!customerId) {
      console.error("[customer/orders] failed to resolve customer id");
      return submitUnknownError();
    }

    const orderPayload: OrderInsert = {
      customer_id: customerId,
      customer_name: payload.customer_name,
      customer_email: payload.customer_email,
      customer_phone: payload.customer_phone,
      payment_method: payload.payment_method,
      fulfillment_type: payload.fulfillment_type,
      delivery_fee_cents: payload.delivery_fee_cents,
      notes: payload.notes,
      items: payload.items,
      status: "aguardando_confirmacao" satisfies OrderStatus,
    };

    const orderInsert = asOrdersInsertChain(supabase.from("orders"));
    const { data: orderRow, error: orderError } = await orderInsert
      .insert(orderPayload)
      .select("reference")
      .single();

    if (orderError || !orderRow?.reference) {
      console.error("[customer/orders] failed to create order", {
        message: orderError?.message ?? "missing order reference",
        code: orderError?.code,
      });
      return submitUnknownError();
    }

    revalidatePath("/admin");

    return { ok: true, orderReference: orderRow.reference };
  } catch (error) {
    console.error("[customer/orders] unexpected error during order submission", {
      message: error instanceof Error ? error.message : String(error),
    });
    return submitUnknownError();
  }
}

type FindOrCreateCustomerInput = CustomerInsert;

type CustomersSelectChain = {
  select: (columns: "id") => {
    eq: (column: "email_normalized" | "phone_normalized" | "id", value: string) => {
      eq: (column: "phone_normalized" | "id", value: string) => {
        is: (
          column: "email_normalized",
          value: null
        ) => {
          maybeSingle: () => CustomerMaybeSingleResult;
        };
        maybeSingle: () => CustomerMaybeSingleResult;
      };
      is: (
        column: "email_normalized",
        value: null
      ) => {
        maybeSingle: () => CustomerMaybeSingleResult;
      };
    };
    is: (
      column: "email_normalized",
      value: null
    ) => {
      maybeSingle: () => CustomerMaybeSingleResult;
    };
  };
};

type CustomersInsertChain = {
  insert: (values: CustomerInsert) => {
    select: (columns: "id") => {
      single: () => Promise<{
        data: CustomerIdRow | null;
        error: SupabaseTableError;
      }>;
    };
  };
};

type CustomersUpdateChain = {
  update: (values: Database["public"]["Tables"]["customers"]["Update"]) => {
    eq: (column: "id", value: string) => {
      is: (
        column: "email_normalized",
        value: null
      ) => {
        select: (columns: "id") => {
          maybeSingle: () => CustomerMaybeSingleResult;
        };
      };
    };
  };
};

type OrdersInsertChain = {
  insert: (values: OrderInsert) => {
    select: (columns: "reference") => {
      single: () => Promise<{
        data: { reference: string } | null;
        error: SupabaseTableError;
      }>;
    };
  };
};

async function findOrCreateCustomer(
  supabase: OrdersTablesClient,
  input: FindOrCreateCustomerInput
): Promise<string | null> {
  const hasEmail = Boolean(input.email_normalized);

  if (hasEmail && input.email_normalized) {
    const { data: customerByEmailAndPhone, error: byEmailError } =
      await findCustomerByNormalizedContact(
        supabase,
        input.email_normalized,
        input.phone_normalized
      );
    if (byEmailError) {
      console.error("[customer/orders] failed to query customers by email+phone", {
        message: byEmailError.message,
        code: byEmailError.code,
      });
      return null;
    }
    if (customerByEmailAndPhone?.id) {
      return customerByEmailAndPhone.id;
    }

    const { data: phoneOnlyCustomer, error: phoneOnlyError } =
      await findCustomerByPhoneWithoutEmail(supabase, input.phone_normalized);
    if (phoneOnlyError) {
      console.error("[customer/orders] failed to query phone-only customer for upgrade", {
        message: phoneOnlyError.message,
        code: phoneOnlyError.code,
      });
      return null;
    }

    if (phoneOnlyCustomer?.id && input.email && input.email_normalized) {
      const upgradedCustomer = await upgradePhoneOnlyCustomerWithEmail(
        supabase,
        phoneOnlyCustomer.id,
        input.email_normalized,
        input.email_normalized
      );
      if (upgradedCustomer?.id) {
        return upgradedCustomer.id;
      }

      const { data: retriedByEmail, error: retriedByEmailError } =
        await findCustomerByNormalizedContact(
          supabase,
          input.email_normalized,
          input.phone_normalized
        );
      if (retriedByEmailError) {
        console.error("[customer/orders] failed to retry customer query after upgrade", {
          message: retriedByEmailError.message,
          code: retriedByEmailError.code,
        });
        return null;
      }
      if (retriedByEmail?.id) {
        return retriedByEmail.id;
      }
    }
  } else {
    const { data: phoneOnlyCustomer, error: phoneOnlyError } =
      await findCustomerByPhoneWithoutEmail(supabase, input.phone_normalized);
    if (phoneOnlyError) {
      console.error("[customer/orders] failed to query phone-only customer", {
        message: phoneOnlyError.message,
        code: phoneOnlyError.code,
      });
      return null;
    }

    if (phoneOnlyCustomer?.id) {
      return phoneOnlyCustomer.id;
    }
  }

  const customersInsert = asCustomersInsertChain(supabase.from("customers"));
  const { data: insertedCustomer, error: insertError } = await customersInsert
    .insert(input)
    .select("id")
    .single();

  if (!insertError && insertedCustomer?.id) {
    return insertedCustomer.id;
  }

  if (insertError?.code === "23505") {
    // Another request inserted/updated the same customer between select and insert.
    if (hasEmail && input.email_normalized) {
      const { data: retriedByEmailAndPhone, error: retryByEmailError } =
        await findCustomerByNormalizedContact(
          supabase,
          input.email_normalized,
          input.phone_normalized
        );

      if (!retryByEmailError && retriedByEmailAndPhone?.id) {
        return retriedByEmailAndPhone.id;
      }

      console.error("[customer/orders] duplicate customer insert retry failed", {
        insertCode: insertError.code,
        retryCode: retryByEmailError?.code,
        retryMessage: retryByEmailError?.message,
      });
      return null;
    }

    const { data: retriedByPhoneOnly, error: retryByPhoneError } =
      await findCustomerByPhoneWithoutEmail(supabase, input.phone_normalized);

    if (!retryByPhoneError && retriedByPhoneOnly?.id) {
      return retriedByPhoneOnly.id;
    }

    console.error("[customer/orders] duplicate customer insert retry failed", {
      insertCode: insertError.code,
      retryCode: retryByPhoneError?.code,
      retryMessage: retryByPhoneError?.message,
    });
    return null;
  }

  console.error("[customer/orders] failed to insert customer", {
    message: insertError?.message ?? "unknown",
    code: insertError?.code,
  });
  return null;
}

function findCustomerByNormalizedContact(
  supabase: OrdersTablesClient,
  emailNormalized: string,
  phoneNormalized: string
) {
  const customersSelect = asCustomersSelectChain(supabase.from("customers"));

  return customersSelect
    .select("id")
    .eq("email_normalized", emailNormalized)
    .eq("phone_normalized", phoneNormalized)
    .maybeSingle();
}

function findCustomerByPhoneWithoutEmail(
  supabase: OrdersTablesClient,
  phoneNormalized: string
) {
  const customersSelect = asCustomersSelectChain(supabase.from("customers"));

  return customersSelect
    .select("id")
    .eq("phone_normalized", phoneNormalized)
    .is("email_normalized", null)
    .maybeSingle();
}

async function upgradePhoneOnlyCustomerWithEmail(
  supabase: OrdersTablesClient,
  customerId: string,
  email: string,
  emailNormalized: string
) {
  const customersUpdate = asCustomersUpdateChain(supabase.from("customers"));
  const { data: upgradedCustomer, error: upgradeError } = await customersUpdate
    .update({
      email,
      email_normalized: emailNormalized,
    })
    .eq("id", customerId)
    .is("email_normalized", null)
    .select("id")
    .maybeSingle();

  if (upgradeError) {
    if (upgradeError.code === "23505") {
      return null;
    }
    console.error("[customer/orders] failed to upgrade phone-only customer with email", {
      message: upgradeError.message,
      code: upgradeError.code,
    });
    return null;
  }

  return upgradedCustomer;
}

function normalizeOptionalEmail(value: string | null): string | null {
  if (!value) return null;
  return value.trim().toLowerCase();
}

function asCustomersSelectChain(value: unknown): CustomersSelectChain {
  return value as CustomersSelectChain;
}

function asCustomersInsertChain(value: unknown): CustomersInsertChain {
  return value as CustomersInsertChain;
}

function asCustomersUpdateChain(value: unknown): CustomersUpdateChain {
  return value as CustomersUpdateChain;
}

function asOrdersInsertChain(value: unknown): OrdersInsertChain {
  return value as OrdersInsertChain;
}

function submitUnknownError(): Extract<
  SubmitCustomerOrderResult,
  { ok: false }
> {
  return submitErrorResult("unknown", SUBMIT_ERROR_MESSAGE);
}

function submitErrorResult(
  code: "setup" | "validation" | "unknown",
  message: string
): Extract<
  SubmitCustomerOrderResult,
  { ok: false }
> {
  return { ok: false, code, message };
}
