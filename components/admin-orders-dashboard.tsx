"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHOD_OPTIONS, type PaymentMethod } from "@/lib/payment-methods";
import type { MenuItem } from "@/lib/menu";
import {
  countOrdersByStatus,
  getNextOrderStatus,
  getOrderStatusLabel,
  ORDER_STATUS_SEQUENCE,
  type AdminOrder,
  type OrderStatus,
} from "@/lib/orders";
import {
  progressOrderStatus,
  type ProgressOrderResult,
  updateOrderDetails,
  type UpdateOrderDetailsResult,
} from "@/app/admin/actions";

type AdminOrdersDashboardProps = {
  initialOrders: AdminOrder[];
  menuItems?: MenuItem[];
  initialLoadError?: string | null;
  enablePolling?: boolean;
};

type FeedbackState = {
  type: "success" | "error";
  message: string;
};

type OrderEditDraft = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
  paymentMethod: PaymentMethod | "";
  items: Array<{
    id: string;
    menuItemId: string;
    name: string;
    quantity: number;
    unitPriceCents?: number;
    lineTotalCents?: number;
    extras?: Array<{
      id?: string;
      name: string;
      priceCents?: number;
    }>;
    removedIngredients?: Array<{
      id?: string;
      name: string;
    }>;
  }>;
};

const ORDER_LIST_SORT_DESCRIPTION =
  "Ordenados por status e depois do mais antigo para o mais recente";
const POLLING_QUERY_KEY = ["admin", "orders", "dashboard"] as const;
const POLLING_INTERVAL_MS = 10_000;
const MOBILE_VIEWPORT_MEDIA_QUERY = "(max-width: 767px)";
const POLLING_REFRESH_ERROR_MESSAGE =
  "Não foi possível atualizar os pedidos automaticamente. Exibindo os últimos dados carregados.";
const EDIT_ORDER_NON_OPERATIONAL_MESSAGE =
  "Este pedido não está mais disponível para edição.";
const EDIT_ORDER_LEGACY_ITEMS_MESSAGE =
  "Não foi possível editar este pedido porque alguns itens não possuem identificação do cardápio.";
const ORDER_LIST_BUTTON_BASE_CLASS =
  "w-full px-4 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";
const STATUS_VISUAL_STYLES: Record<
  OrderStatus,
  {
    chip: string;
    summaryContainer: string;
    summaryLabel: string;
    summaryValue: string;
  }
> = {
  aguardando_confirmacao: {
    chip: "bg-amber-500/15 text-amber-700",
    summaryContainer: "border-amber-300 bg-amber-50/80",
    summaryLabel: "text-amber-800",
    summaryValue: "text-amber-900",
  },
  em_preparo: {
    chip: "bg-blue-500/15 text-blue-700",
    summaryContainer: "border-blue-300 bg-blue-50/80",
    summaryLabel: "text-blue-800",
    summaryValue: "text-blue-900",
  },
  pronto_para_retirada: {
    chip: "bg-cyan-500/15 text-cyan-700",
    summaryContainer: "border-cyan-300 bg-cyan-50/80",
    summaryLabel: "text-cyan-800",
    summaryValue: "text-cyan-900",
  },
  saiu_para_entrega: {
    chip: "bg-orange-500/15 text-orange-700",
    summaryContainer: "border-orange-300 bg-orange-50/80",
    summaryLabel: "text-orange-800",
    summaryValue: "text-orange-900",
  },
  entregue: {
    chip: "bg-green-600/15 text-green-700",
    summaryContainer: "border-green-300 bg-green-50/80",
    summaryLabel: "text-green-800",
    summaryValue: "text-green-900",
  },
};

export function AdminOrdersDashboard({
  initialOrders,
  menuItems = [],
  initialLoadError = null,
  enablePolling = false,
}: AdminOrdersDashboardProps) {
  return (
    <AdminOrdersDashboardPolling
      initialOrders={initialOrders}
      menuItems={menuItems}
      initialLoadError={initialLoadError}
      enablePolling={enablePolling}
    />
  );
}

function AdminOrdersDashboardPolling({
  initialOrders,
  menuItems,
  initialLoadError,
  enablePolling = false,
}: AdminOrdersDashboardProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AdminOrdersDashboardContent
        initialOrders={initialOrders}
        menuItems={menuItems}
        initialLoadError={initialLoadError}
        enablePolling={enablePolling}
      />
    </QueryClientProvider>
  );
}

function AdminOrdersDashboardContent({
  initialOrders,
  menuItems = [],
  initialLoadError = null,
  enablePolling = false,
}: AdminOrdersDashboardProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<OrderEditDraft | null>(null);
  const [pendingSaveOrderId, setPendingSaveOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialOrders[0]?.id ?? null
  );
  const [mobileExpandedOrderId, setMobileExpandedOrderId] = useState<string | null>(null);
  const [pendingProgressOrderId, setPendingProgressOrderId] = useState<string | null>(null);
  const [pollingRefreshErrorMessage, setPollingRefreshErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(
    initialLoadError ? { type: "error", message: initialLoadError } : null
  );
  const [isPending, startTransition] = useTransition();
  const menuItemsById = useMemo(
    () => new Map(menuItems.map((item) => [item.id, item])),
    [menuItems]
  );
  const menuItemIdByName = useMemo(
    () => buildMenuItemIdByNameIndex(menuItems),
    [menuItems]
  );
  const isMobileViewport = useIsMobileViewport();
  const isPageVisible = useDocumentVisible();
  const pollingQuery = useQuery({
    queryKey: POLLING_QUERY_KEY,
    queryFn: createPollingOrdersQueryFn(setPollingRefreshErrorMessage),
    initialData: initialOrders,
    enabled: enablePolling,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: getPollingInterval(enablePolling, isPageVisible),
    refetchIntervalInBackground: false,
    retry: false,
  });
  const wasPageVisibleRef = useRef(isPageVisible);

  const sortedOrders = useMemo(() => sortOrdersForDashboard(orders), [orders]);
  const showPollingErrorBanner =
    enablePolling &&
    orders.length > 0 &&
    !pollingQuery.isFetching &&
    Boolean(pollingRefreshErrorMessage);

  const counts = countOrdersByStatus(orders);
  const selectedOrder = findOrderById(sortedOrders, selectedOrderId) ?? sortedOrders[0] ?? null;
  const isEditingSelectedOrder = Boolean(selectedOrder && editingOrderId === selectedOrder.id);
  const hasUnsavedEditChanges =
    isEditingSelectedOrder && selectedOrder && editDraft
      ? !isOrderEditDraftEqual(
          editDraft,
          createOrderEditDraft(selectedOrder, menuItemsById, menuItemIdByName)
        )
      : false;

  const nextStatus = selectedOrder
    ? getNextOrderStatus(selectedOrder.status, selectedOrder.fulfillmentType)
    : null;

  useEffect(() => {
    if (!enablePolling) return;

    const nextOrders = pollingQuery.data;
    if (!Array.isArray(nextOrders)) return;

    setOrders((currentOrders) =>
      mergePolledOrdersIntoLocalState(
        currentOrders,
        nextOrders,
        pendingProgressOrderId,
        editingOrderId
      )
    );
  }, [editingOrderId, enablePolling, pendingProgressOrderId, pollingQuery.data]);

  useEffect(() => {
    if (!enablePolling) return;

    const wasVisible = wasPageVisibleRef.current;
    wasPageVisibleRef.current = isPageVisible;

    if (!wasVisible && isPageVisible) {
      void pollingQuery.refetch();
    }
  }, [enablePolling, isPageVisible, pollingQuery]);

  useEffect(() => {
    if (!selectedOrder) {
      setSelectedOrderId(null);
      setMobileExpandedOrderId(null);
      return;
    }

    setSelectedOrderId((current) => current ?? selectedOrder.id);
    setMobileExpandedOrderId((current) =>
      current && hasOrderWithId(sortedOrders, current) ? current : null
    );
  }, [selectedOrder, sortedOrders]);

  function handleSelectOrder(orderId: string) {
    if (editingOrderId && editingOrderId !== orderId) {
      setEditingOrderId(null);
      setEditDraft(null);
    }
    setSelectedOrderId(orderId);
    if (isMobileViewport) {
      setMobileExpandedOrderId((current) => (current === orderId ? null : orderId));
    }
    setFeedback(null);
  }

  function handleStartEdit(order: AdminOrder) {
    setEditingOrderId(order.id);
    setEditDraft(createOrderEditDraft(order, menuItemsById, menuItemIdByName));
    setFeedback(null);
  }

  function handleCancelEdit() {
    setEditingOrderId(null);
    setEditDraft(null);
    setFeedback(null);
  }

  function handleEditDraftField(
    field: keyof OrderEditDraft,
    value: string
  ) {
    if (field === "items") return;
    setEditDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        [field]:
          field === "paymentMethod"
            ? (value as OrderEditDraft["paymentMethod"])
            : value,
      };
    });
  }

  function handleEditItemQuantity(itemId: string, quantityValue: string) {
    setEditDraft((current) => {
      if (!current) return current;
      const parsedQuantity = Number.parseInt(quantityValue, 10);
      if (!Number.isFinite(parsedQuantity)) return current;
      const quantity = Math.max(1, parsedQuantity);
      return {
        ...current,
        items: current.items.map((item) =>
          item.id === itemId ? { ...item, quantity } : item
        ),
      };
    });
  }

  function handleRemoveItem(itemId: string) {
    setEditDraft((current) => {
      if (!current) return current;
      if (current.items.length <= 1) return current;
      return {
        ...current,
        items: current.items.filter((item) => item.id !== itemId),
      };
    });
  }

  function handleToggleItemExtra(itemId: string, extraId: string) {
    setEditDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) => {
          if (item.id !== itemId) return item;
          const menuItem = menuItemsById.get(item.menuItemId);
          const currentIds = (item.extras ?? [])
            .map((extra) => extra.id)
            .filter((id): id is string => typeof id === "string" && id.length > 0);
          const nextIds = currentIds.includes(extraId)
            ? currentIds.filter((id) => id !== extraId)
            : [...currentIds, extraId];
          const extrasById = new Map((menuItem?.extras ?? []).map((extra) => [extra.id, extra]));
          return {
            ...item,
            extras: normalizeCustomizationIds(nextIds).map((id) => {
              const extra = extrasById.get(id);
              return {
                id,
                name: extra?.name ?? id,
                ...(typeof extra?.priceCents === "number" ? { priceCents: extra.priceCents } : {}),
              };
            }),
          };
        }),
      };
    });
  }

  function handleToggleItemRemovedIngredient(itemId: string, ingredientId: string) {
    setEditDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) => {
          if (item.id !== itemId) return item;
          const menuItem = menuItemsById.get(item.menuItemId);
          const currentIds = (item.removedIngredients ?? [])
            .map((ingredient) => ingredient.id)
            .filter((id): id is string => typeof id === "string" && id.length > 0);
          const nextIds = currentIds.includes(ingredientId)
            ? currentIds.filter((id) => id !== ingredientId)
            : [...currentIds, ingredientId];
          const ingredientsById = new Map(
            (menuItem?.removableIngredients ?? []).map((ingredient) => [ingredient.id, ingredient])
          );
          return {
            ...item,
            removedIngredients: normalizeCustomizationIds(nextIds).map((id) => {
              const ingredient = ingredientsById.get(id);
              return { id, name: ingredient?.name ?? id };
            }),
          };
        }),
      };
    });
  }

  function handleSaveOrderDetails(order: AdminOrder) {
    if (!editDraft || pendingSaveOrderId || isPending) return;
    const draftToSave = editDraft;
    const expectedUpdatedAt = order.updatedAtIso;
    if (!expectedUpdatedAt) {
      setFeedback(errorFeedback(EDIT_ORDER_NON_OPERATIONAL_MESSAGE));
      return;
    }
    if (draftToSave.items.some((item) => !item.menuItemId)) {
      setFeedback(errorFeedback(EDIT_ORDER_LEGACY_ITEMS_MESSAGE));
      return;
    }

    startTransition(async () => {
      setPendingSaveOrderId(order.id);
      try {
        const result = await updateOrderDetails({
          orderId: order.id,
          expectedUpdatedAt,
          customerName: draftToSave.customerName,
          customerPhone: draftToSave.customerPhone,
          customerEmail: toOptionalString(draftToSave.customerEmail),
          notes: toOptionalString(draftToSave.notes),
          paymentMethod: toOptionalString(draftToSave.paymentMethod),
          items: draftToSave.items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            ...(item.extras
              ? {
                  extraIds: item.extras
                    .map((extra) => extra.id)
                    .filter((id): id is string => typeof id === "string" && id.length > 0),
                }
              : {}),
            ...(item.removedIngredients
              ? {
                  removedIngredientIds: item.removedIngredients
                    .map((ingredient) => ingredient.id)
                    .filter(
                      (id): id is string => typeof id === "string" && id.length > 0
                    ),
                }
              : {}),
          })),
        });

        if (!result.ok) {
          handleFailedOrderDetailsUpdate(result, order.id);
          return;
        }

        setOrders((previousOrders) =>
          previousOrders.map((existing) =>
            existing.id === order.id ? result.order : existing
          )
        );
        setEditingOrderId(null);
        setEditDraft(null);
        setFeedback(successFeedback("Dados do pedido atualizados com sucesso."));
      } finally {
        setPendingSaveOrderId(null);
      }
    });
  }

  function handleProgressOrder(targetOrder: AdminOrder) {
    const targetNextStatus = getNextOrderStatus(
      targetOrder.status,
      targetOrder.fulfillmentType
    );
    if (!targetOrder.status || !targetNextStatus || isPending) return;

    const currentOrderId = targetOrder.id;
    const currentStatus = targetOrder.status;

    startTransition(async () => {
      setPendingProgressOrderId(currentOrderId);
      try {
        const result = await progressOrderStatus({
          orderId: currentOrderId,
          currentStatus,
        });

        if (!result.ok) {
          handleFailedProgress(result, currentOrderId);
          return;
        }

        setOrders((previousOrders) =>
          previousOrders.map((order) =>
            updateOrderStatusLocally(order, currentOrderId, result.nextStatus, result.nextStatusLabel)
          )
        );
        setFeedback(successFeedback(`Pedido atualizado para ${result.nextStatusLabel}.`));
      } finally {
        setPendingProgressOrderId(null);
      }
    });
  }

  function handleFailedOrderDetailsUpdate(
    result: Extract<UpdateOrderDetailsResult, { ok: false }>,
    orderId: string
  ) {
    if (result.code === "stale") {
      if (result.currentOrder) {
        setOrders((previousOrders) =>
          previousOrders.map((existing) =>
            existing.id === orderId ? result.currentOrder : existing
          )
        );
        setEditDraft(
          createOrderEditDraft(result.currentOrder, menuItemsById, menuItemIdByName)
        );
      } else {
        setEditingOrderId(null);
        setEditDraft(null);
      }
    }

    setFeedback(errorFeedback(result.message));
  }

  function handleFailedProgress(
    result: Extract<ProgressOrderResult, { ok: false }>,
    orderId: string
  ) {
    if (result.code === "stale") {
      setOrders((previousOrders) =>
        previousOrders.map((order) => {
          if (order.id !== orderId) return order;
          return {
            ...order,
            status: result.currentStatus,
            statusLabel: result.currentStatusLabel,
            rawStatus: result.currentStatus ?? order.rawStatus,
          };
        })
      );
    }

    setFeedback(errorFeedback(result.message));
  }

  if (orders.length === 0 && initialLoadError) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
        <SummaryCards counts={counts} />
        <FeedbackBanner {...errorFeedback(initialLoadError)} />
        <section className="rounded-lg border border-border bg-background p-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            Falha ao carregar pedidos
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tente atualizar a página. Se o problema continuar, verifique a conexão com
            o Supabase.
          </p>
        </section>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
        <SummaryCards counts={counts} />
        {feedback && !initialLoadError && <FeedbackBanner {...feedback} />}
        <section className="rounded-lg border border-border bg-background p-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            Nenhum pedido no momento
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Quando novos pedidos chegarem, eles aparecerão aqui do mais antigo para
            o mais recente.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <SummaryCards counts={counts} />
      {feedback && <FeedbackBanner {...feedback} />}
      {showPollingErrorBanner ? (
        <FeedbackBanner type="error" message={pollingRefreshErrorMessage!} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <section className="rounded-lg border border-border bg-background">
          <header className="border-b border-border px-4 py-3">
            <h1 className="text-lg font-semibold text-foreground">Pedidos</h1>
            <p className="text-xs text-muted-foreground">{ORDER_LIST_SORT_DESCRIPTION}</p>
          </header>

          <ul className="max-h-[65vh] overflow-auto">
            {sortedOrders.map((order) => {
              const isSelected = selectedOrder?.id === order.id;
              const isExpandedMobile = isMobileViewport && mobileExpandedOrderId === order.id;
              const orderNextStatus = getNextOrderStatus(
                order.status,
                order.fulfillmentType
              );
              const mobilePanelId = mobileOrderPanelId(order.id);
              const triggerId = mobileOrderTriggerId(order.id);

              return (
                <li key={order.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => handleSelectOrder(order.id)}
                    aria-expanded={isMobileViewport ? isExpandedMobile : undefined}
                    aria-controls={isMobileViewport ? mobilePanelId : undefined}
                    className={[
                      ORDER_LIST_BUTTON_BASE_CLASS,
                      isSelected ? "bg-accent" : "",
                    ].join(" ")}
                    id={isMobileViewport ? triggerId : undefined}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {order.reference}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {order.customerName}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${statusChipClass(
                          order.status
                        )}`}
                      >
                        {order.statusLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {order.createdAtLabel}
                    </p>
                  </button>

                  {isExpandedMobile ? (
                    <div
                      id={mobilePanelId}
                      role="region"
                      aria-labelledby={triggerId}
                      className="border-t border-border bg-muted/20 p-4"
                    >
                      <OrderDetailsContent
                        order={order}
                        nextStatus={orderNextStatus}
                        isPending={isPending}
                        isSavingDetails={pendingSaveOrderId === order.id}
                        isEditing={editingOrderId === order.id}
                        hasUnsavedChanges={
                          editingOrderId === order.id && editDraft
                            ? !isOrderEditDraftEqual(
                                editDraft,
                                createOrderEditDraft(order, menuItemsById, menuItemIdByName)
                              )
                            : false
                        }
                        editDraft={editingOrderId === order.id ? editDraft : null}
                        onEditFieldChange={handleEditDraftField}
                        onEditItemQuantity={handleEditItemQuantity}
                        onRemoveItem={handleRemoveItem}
                        onToggleItemExtra={handleToggleItemExtra}
                        onToggleItemRemovedIngredient={handleToggleItemRemovedIngredient}
                        onStartEdit={() => handleStartEdit(order)}
                        onCancelEdit={handleCancelEdit}
                        onSaveDetails={() => handleSaveOrderDetails(order)}
                        onProgress={() => handleProgressOrder(order)}
                        menuItemsById={menuItemsById}
                        compact
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section
          className={[
            "rounded-lg border border-border bg-background",
            isMobileViewport ? "hidden lg:block" : "",
          ].join(" ")}
        >
          {selectedOrder ? (
            <div className="flex h-full flex-col">
              <header className="border-b border-border px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {selectedOrder.reference}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Criado em {selectedOrder.createdAtLabel}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${statusChipClass(
                      selectedOrder.status
                    )}`}
                  >
                    {selectedOrder.statusLabel}
                  </span>
                </div>
              </header>

              <OrderDetailsContent
                order={selectedOrder}
                nextStatus={nextStatus}
                isPending={isPending}
                isSavingDetails={pendingSaveOrderId === selectedOrder.id}
                isEditing={isEditingSelectedOrder}
                hasUnsavedChanges={Boolean(hasUnsavedEditChanges)}
                editDraft={isEditingSelectedOrder ? editDraft : null}
                onEditFieldChange={handleEditDraftField}
                onEditItemQuantity={handleEditItemQuantity}
                onRemoveItem={handleRemoveItem}
                onToggleItemExtra={handleToggleItemExtra}
                onToggleItemRemovedIngredient={handleToggleItemRemovedIngredient}
                onStartEdit={() => handleStartEdit(selectedOrder)}
                onCancelEdit={handleCancelEdit}
                onSaveDetails={() => handleSaveOrderDetails(selectedOrder)}
                onProgress={() => handleProgressOrder(selectedOrder)}
                menuItemsById={menuItemsById}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
              Selecione um pedido para ver os detalhes.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function successFeedback(message: string): FeedbackState {
  return { type: "success", message };
}

function errorFeedback(message: string): FeedbackState {
  return { type: "error", message };
}

function SummaryCards({ counts }: { counts: Record<OrderStatus, number> }) {
  return (
    <section
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
      aria-label="Resumo de pedidos por status"
    >
      {ORDER_STATUS_SEQUENCE.map((status) => {
        const style = STATUS_VISUAL_STYLES[status];
        return (
          <div
            key={status}
            className={`rounded-lg border px-4 py-4 ${style.summaryContainer}`}
          >
            <p className={`text-xs font-semibold uppercase tracking-wide ${style.summaryLabel}`}>
              {getOrderStatusLabel(status)}
            </p>
            <p className={`mt-2 text-3xl font-bold ${style.summaryValue}`}>{counts[status]}</p>
          </div>
        );
      })}
    </section>
  );
}

function OrderDetailsContent({
  order,
  nextStatus,
  isPending,
  isSavingDetails,
  isEditing,
  hasUnsavedChanges,
  editDraft,
  onEditFieldChange,
  onEditItemQuantity,
  onRemoveItem,
  onToggleItemExtra,
  onToggleItemRemovedIngredient,
  onStartEdit,
  onCancelEdit,
  onSaveDetails,
  onProgress,
  menuItemsById,
  compact = false,
}: {
  order: AdminOrder;
  nextStatus: OrderStatus | null;
  isPending: boolean;
  isSavingDetails: boolean;
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  editDraft: OrderEditDraft | null;
  onEditFieldChange: (field: keyof OrderEditDraft, value: string) => void;
  onEditItemQuantity: (itemId: string, quantityValue: string) => void;
  onRemoveItem: (itemId: string) => void;
  onToggleItemExtra: (itemId: string, extraId: string) => void;
  onToggleItemRemovedIngredient: (itemId: string, ingredientId: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveDetails: () => void;
  onProgress: () => void;
  menuItemsById: Map<string, MenuItem>;
  compact?: boolean;
}) {
  const isBusy = isPending || isSavingDetails;
  const customerNameValue = isEditing ? editDraft?.customerName ?? "" : order.customerName;
  const customerPhoneValue = isEditing ? editDraft?.customerPhone ?? "" : order.customerPhone;
  const customerEmailValue = isEditing ? editDraft?.customerEmail ?? "" : order.customerEmail;
  const paymentMethodValue = isEditing
    ? editDraft?.paymentMethod ?? ""
    : order.paymentMethod ?? "";
  const notesValue = isEditing ? editDraft?.notes ?? "" : order.notes ?? "";
  const itemRows = isEditing
    ? editDraft?.items ?? []
    : order.items.map((item, index) => ({
        ...item,
        id: `${order.id}-${index}`,
      }));

  return (
    <>
      <div className={compact ? "grid gap-4" : "grid gap-6 p-5 md:grid-cols-2"}>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Cliente
          </h3>
          <dl className="space-y-2">
            {isEditing ? (
              <EditField label="Nome">
                <input
                  type="text"
                  aria-label="Nome"
                  value={customerNameValue}
                  onChange={(event) => onEditFieldChange("customerName", event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={isBusy}
                />
              </EditField>
            ) : (
              <DetailRow label="Nome" value={order.customerName} />
            )}
            {isEditing ? (
              <EditField label="Telefone">
                <input
                  type="tel"
                  aria-label="Telefone"
                  value={customerPhoneValue}
                  onChange={(event) => onEditFieldChange("customerPhone", event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={isBusy}
                />
              </EditField>
            ) : (
              <DetailRow label="Telefone" value={order.customerPhone} />
            )}
            {isEditing ? (
              <EditField label="E-mail">
                <input
                  type="email"
                  aria-label="E-mail"
                  value={customerEmailValue}
                  onChange={(event) => onEditFieldChange("customerEmail", event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={isBusy}
                />
              </EditField>
            ) : (
              <DetailRow label="E-mail" value={order.customerEmail} />
            )}
            <DetailRow label="Tipo de entrega" value={order.fulfillmentTypeLabel} />
            {isEditing ? (
              <EditField label="Forma de pagamento">
                <select
                  aria-label="Forma de pagamento"
                  value={paymentMethodValue}
                  onChange={(event) => onEditFieldChange("paymentMethod", event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={isBusy}
                >
                  <option value="">Não informado</option>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </EditField>
            ) : (
              <DetailRow label="Forma de pagamento" value={order.paymentMethodLabel} />
            )}
            <DetailRow label="Total do pedido" value={order.totalAmountLabel ?? "Indisponível"} />
          </dl>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Itens do pedido
          </h3>
          {itemRows.length > 0 ? (
            <ul className="space-y-2">
              {itemRows.map((item, index) => (
                <li
                  key={`${order.id}-${item.name}-${index}`}
                  className="rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-foreground">{item.name}</span>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) =>
                            onEditItemQuantity(
                              item.id,
                              event.target.value
                            )
                          }
                          className="h-8 w-20 rounded-md border border-input bg-background px-2 text-right text-sm"
                          disabled={isBusy}
                          aria-label={`Quantidade de ${item.name}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onRemoveItem(item.id)}
                          disabled={isBusy || itemRows.length <= 1}
                        >
                          Remover
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{item.quantity}x</span>
                    )}
                  </div>
                  {item.extras && item.extras.length > 0 ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium">Extras:</span>{" "}
                      {item.extras.map((extra) => extra.name).join(", ")}
                    </div>
                  ) : null}
                  {item.removedIngredients && item.removedIngredients.length > 0 ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium">Sem:</span>{" "}
                      {item.removedIngredients.map((ingredient) => ingredient.name).join(", ")}
                    </div>
                  ) : null}
                  {isEditing ? (
                    <OrderLineCustomizationEditor
                      item={item}
                      menuItem={menuItemsById.get(item.menuItemId)}
                      onToggleExtra={(extraId) => onToggleItemExtra(item.id, extraId)}
                      onToggleRemovedIngredient={(ingredientId) =>
                        onToggleItemRemovedIngredient(item.id, ingredientId)
                      }
                      isBusy={isBusy}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              Itens não disponíveis neste registro.
            </p>
          )}
        </section>
      </div>

      {(order.notes || isEditing) && (
        <section className={compact ? "mt-4" : "px-5 pb-5"}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Observações
          </h3>
          {isEditing ? (
            <textarea
              aria-label="Observações"
              value={notesValue}
              onChange={(event) => onEditFieldChange("notes", event.target.value)}
              className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={isBusy}
            />
          ) : (
            <p className="rounded-md border border-border px-3 py-2 text-sm text-foreground">
              {order.notes}
            </p>
          )}
        </section>
      )}

      <footer
        className={
          compact
            ? "mt-4 border-t border-border pt-4"
            : "mt-auto border-t border-border px-5 py-4"
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {isEditing ? (
            <>
              <p className="text-sm text-muted-foreground">
                Revise os dados antes de salvar.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancelEdit}
                  disabled={isBusy}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={onSaveDetails}
                  disabled={isBusy || !hasUnsavedChanges}
                >
                  {isSavingDetails ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {nextStatus
                  ? `Próximo status: ${getOrderStatusLabel(nextStatus)}`
                  : "Este pedido não pode avançar mais."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={onStartEdit} disabled={isBusy}>
                  Editar pedido
                </Button>
                <Button
                  type="button"
                  onClick={onProgress}
                  disabled={!nextStatus || !order.status || isBusy}
                >
                  {isPending
                    ? "Atualizando..."
                    : nextStatus
                      ? "Avançar status"
                      : "Sem próxima etapa"}
                </Button>
              </div>
            </>
          )}
        </div>
      </footer>
    </>
  );
}

function EditField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 text-sm">
      <label className="text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function OrderLineCustomizationEditor({
  item,
  menuItem,
  onToggleExtra,
  onToggleRemovedIngredient,
  isBusy,
}: {
  item: OrderEditDraft["items"][number];
  menuItem: MenuItem | undefined;
  onToggleExtra: (extraId: string) => void;
  onToggleRemovedIngredient: (ingredientId: string) => void;
  isBusy: boolean;
}) {
  if (!menuItem) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Personalização indisponível para este item.
      </p>
    );
  }

  const extras = menuItem.extras ?? [];
  const removableIngredients = menuItem.removableIngredients ?? [];
  const selectedExtraIds = new Set(
    (item.extras ?? [])
      .map((extra) => extra.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
  const selectedRemovedIngredientIds = new Set(
    (item.removedIngredients ?? [])
      .map((ingredient) => ingredient.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );

  if (extras.length === 0 && removableIngredients.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Este item não possui opções de personalização.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-dashed border-border p-3">
      {extras.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Adicionar extras</p>
          <div className="flex flex-wrap gap-2">
            {extras.map((extra) => (
              <label key={extra.id} className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selectedExtraIds.has(extra.id)}
                  onChange={() => onToggleExtra(extra.id)}
                  disabled={isBusy}
                />
                <span>
                  {extra.name}
                  {typeof extra.priceCents === "number"
                    ? ` (+${formatCurrency(extra.priceCents)})`
                    : ""}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {removableIngredients.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Remover ingredientes</p>
          <div className="flex flex-wrap gap-2">
            {removableIngredients.map((ingredient) => (
              <label key={ingredient.id} className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selectedRemovedIngredientIds.has(ingredient.id)}
                  onChange={() => onToggleRemovedIngredient(ingredient.id)}
                  disabled={isBusy}
                />
                <span>Sem {ingredient.name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words text-foreground">{value}</dd>
    </div>
  );
}

function FeedbackBanner({
  type,
  message,
}: {
  type: "success" | "error";
  message: string;
}) {
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={[
        "rounded-md border px-4 py-3 text-sm",
        type === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-green-600/20 bg-green-600/10 text-green-700",
      ].join(" ")}
    >
      {message}
    </div>
  );
}

function statusChipClass(status: OrderStatus | null) {
  if (!status) return "bg-muted text-muted-foreground";
  return STATUS_VISUAL_STYLES[status].chip;
}

function findOrderById(orders: AdminOrder[], orderId: string | null) {
  if (!orderId) return null;
  return orders.find((order) => order.id === orderId) ?? null;
}

function hasOrderWithId(orders: AdminOrder[], orderId: string) {
  return orders.some((order) => order.id === orderId);
}

function updateOrderStatusLocally(
  order: AdminOrder,
  orderId: string,
  nextStatus: OrderStatus,
  nextStatusLabel: string
) {
  if (order.id !== orderId) return order;
  return {
    ...order,
    status: nextStatus,
    statusLabel: nextStatusLabel,
    rawStatus: nextStatus,
  };
}

function createOrderEditDraft(
  order: AdminOrder,
  menuItemsById: Map<string, MenuItem>,
  menuItemIdByName: Map<string, string | null>
): OrderEditDraft {
  return {
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail === "Não informado" ? "" : order.customerEmail,
    notes: order.notes ?? "",
    paymentMethod: order.paymentMethod ?? "",
    items: order.items.map((item, index) => ({
      id: `${order.id}-${index}`,
      menuItemId: resolveMenuItemId(
        item.menuItemId,
        item.name,
        menuItemsById,
        menuItemIdByName
      ),
      name: item.name,
      quantity: item.quantity,
      ...(typeof item.unitPriceCents === "number" ? { unitPriceCents: item.unitPriceCents } : {}),
      ...(typeof item.lineTotalCents === "number" ? { lineTotalCents: item.lineTotalCents } : {}),
      ...(item.extras ? { extras: item.extras } : {}),
      ...(item.removedIngredients ? { removedIngredients: item.removedIngredients } : {}),
    })),
  };
}

function isOrderEditDraftEqual(a: OrderEditDraft, b: OrderEditDraft) {
  return (
    a.customerName === b.customerName &&
    a.customerPhone === b.customerPhone &&
    a.customerEmail === b.customerEmail &&
    a.notes === b.notes &&
    a.paymentMethod === b.paymentMethod &&
    JSON.stringify(a.items) === JSON.stringify(b.items)
  );
}

function toOptionalString(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeCustomizationIds(ids: string[]) {
  return Array.from(
    new Set(
      ids
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function buildMenuItemIdByNameIndex(menuItems: MenuItem[]) {
  const index = new Map<string, string | null>();
  for (const item of menuItems) {
    const key = normalizeMenuName(item.name);
    if (!key) continue;
    const existing = index.get(key);
    if (!existing) {
      index.set(key, item.id);
      continue;
    }
    if (existing !== item.id) {
      index.set(key, null);
    }
  }
  return index;
}

function normalizeMenuName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function resolveMenuItemId(
  menuItemId: string | undefined,
  itemName: string,
  menuItemsById: Map<string, MenuItem>,
  menuItemIdByName: Map<string, string | null>
) {
  if (menuItemId) {
    return menuItemId;
  }

  const byName = menuItemIdByName.get(normalizeMenuName(itemName));
  if (byName && menuItemsById.has(byName)) {
    return byName;
  }

  return "";
}

function mergePolledOrdersIntoLocalState(
  currentOrders: AdminOrder[],
  polledOrders: AdminOrder[],
  pendingProgressOrderId: string | null,
  editingOrderId: string | null
) {
  if (!pendingProgressOrderId && !editingOrderId) {
    return polledOrders;
  }

  const protectedOrderIds = [pendingProgressOrderId, editingOrderId].filter(
    (value): value is string => Boolean(value)
  );
  if (protectedOrderIds.length === 0) return polledOrders;

  const currentProtectedOrders = protectedOrderIds
    .map((id) => findOrderById(currentOrders, id))
    .filter((order): order is AdminOrder => Boolean(order));

  if (currentProtectedOrders.length === 0) {
    return polledOrders;
  }

  const currentProtectedById = new Map(currentProtectedOrders.map((order) => [order.id, order]));

  const nextOrders = polledOrders.map((order) => currentProtectedById.get(order.id) ?? order);

  const missingProtected = currentProtectedOrders.filter(
    (order) => !hasOrderWithId(polledOrders, order.id)
  );
  if (missingProtected.length > 0) return [...nextOrders, ...missingProtected];

  return nextOrders;
}

function sortOrdersForDashboard(orders: AdminOrder[]) {
  return [...orders].sort((a, b) => {
    const statusDelta = getStatusSortRank(a.status) - getStatusSortRank(b.status);
    if (statusDelta !== 0) return statusDelta;

    const timeDelta = compareCreatedAtIso(a.createdAtIso, b.createdAtIso);
    if (timeDelta !== 0) return timeDelta;

    return a.reference.localeCompare(b.reference, "pt-BR");
  });
}

function getStatusSortRank(status: OrderStatus | null) {
  if (!status) return ORDER_STATUS_SEQUENCE.length;
  const index = ORDER_STATUS_SEQUENCE.indexOf(status);
  return index >= 0 ? index : ORDER_STATUS_SEQUENCE.length;
}

function compareCreatedAtIso(a: string | null, b: string | null) {
  if (a && b) return a.localeCompare(b);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY);
    const update = (matches: boolean) => setIsMobile(matches);
    update(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => update(event.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return isMobile;
}

function useDocumentVisible() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const update = () => setIsVisible(document.visibilityState !== "hidden");
    update();

    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return isVisible;
}

async function fetchAdminOrdersForDashboard(): Promise<AdminOrder[]> {
  const response = await fetch("/api/admin/orders", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; orders?: AdminOrder[]; message?: string }
    | null;

  if (!response.ok || !data?.ok || !Array.isArray(data.orders)) {
    throw new Error(data?.message ?? POLLING_REFRESH_ERROR_MESSAGE);
  }

  return data.orders;
}

function createPollingOrdersQueryFn(
  setPollingRefreshErrorMessage: (value: string | null) => void
) {
  return async function pollingOrdersQueryFn() {
    try {
      const orders = await fetchAdminOrdersForDashboard();
      setPollingRefreshErrorMessage(null);
      return orders;
    } catch (error) {
      setPollingRefreshErrorMessage(POLLING_REFRESH_ERROR_MESSAGE);
      throw error;
    }
  };
}

function getPollingInterval(enablePolling: boolean, isPageVisible: boolean) {
  return enablePolling && isPageVisible ? POLLING_INTERVAL_MS : false;
}

function mobileOrderPanelId(orderId: string) {
  return `admin-order-mobile-panel-${orderId}`;
}

function mobileOrderTriggerId(orderId: string) {
  return `admin-order-mobile-trigger-${orderId}`;
}

function formatCurrency(valueCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueCents / 100);
}
