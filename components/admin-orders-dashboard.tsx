"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
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
} from "@/app/admin/actions";

type AdminOrdersDashboardProps = {
  initialOrders: AdminOrder[];
  initialLoadError?: string | null;
  enablePolling?: boolean;
};

type FeedbackState = {
  type: "success" | "error";
  message: string;
};

const ORDER_LIST_SORT_DESCRIPTION =
  "Ordenados por status e depois do mais antigo para o mais recente";
const POLLING_QUERY_KEY = ["admin", "orders", "dashboard"] as const;
const POLLING_INTERVAL_MS = 10_000;
const MOBILE_VIEWPORT_MEDIA_QUERY = "(max-width: 767px)";
const POLLING_REFRESH_ERROR_MESSAGE =
  "Não foi possível atualizar os pedidos automaticamente. Exibindo os últimos dados carregados.";
const ORDER_LIST_BUTTON_BASE_CLASS =
  "w-full px-4 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

export function AdminOrdersDashboard({
  initialOrders,
  initialLoadError = null,
  enablePolling = false,
}: AdminOrdersDashboardProps) {
  return (
    <AdminOrdersDashboardPolling
      initialOrders={initialOrders}
      initialLoadError={initialLoadError}
      enablePolling={enablePolling}
    />
  );
}

function AdminOrdersDashboardPolling({
  initialOrders,
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
        initialLoadError={initialLoadError}
        enablePolling={enablePolling}
      />
    </QueryClientProvider>
  );
}

function AdminOrdersDashboardContent({
  initialOrders,
  initialLoadError = null,
  enablePolling = false,
}: AdminOrdersDashboardProps) {
  const [orders, setOrders] = useState(initialOrders);
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
  const isMobileViewport = useIsMobileViewport();
  const isPageVisible = useDocumentVisible();
  const pollingQuery = useQuery({
    queryKey: POLLING_QUERY_KEY,
    queryFn: createPollingOrdersQueryFn(setPollingRefreshErrorMessage),
    initialData: initialOrders,
    enabled: enablePolling,
    refetchOnWindowFocus: false,
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

  const nextStatus = selectedOrder ? getNextOrderStatus(selectedOrder.status) : null;

  useEffect(() => {
    if (!enablePolling) return;

    const nextOrders = pollingQuery.data;
    if (!Array.isArray(nextOrders)) return;

    setOrders((currentOrders) =>
      mergePolledOrdersIntoLocalState(currentOrders, nextOrders, pendingProgressOrderId)
    );
  }, [enablePolling, pendingProgressOrderId, pollingQuery.data]);

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
    setSelectedOrderId(orderId);
    if (isMobileViewport) {
      setMobileExpandedOrderId((current) => (current === orderId ? null : orderId));
    }
    setFeedback(null);
  }

  function handleProgressOrder(targetOrder: AdminOrder) {
    const targetNextStatus = getNextOrderStatus(targetOrder.status);
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
              const orderNextStatus = getNextOrderStatus(order.status);
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
                        onProgress={() => handleProgressOrder(order)}
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
                onProgress={() => handleProgressOrder(selectedOrder)}
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
      className="grid gap-4 sm:grid-cols-3"
      aria-label="Resumo de pedidos por status"
    >
      {ORDER_STATUS_SEQUENCE.map((status) => (
        <div
          key={status}
          className="rounded-lg border border-border bg-background px-4 py-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {getOrderStatusLabel(status)}
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground">{counts[status]}</p>
        </div>
      ))}
    </section>
  );
}

function OrderDetailsContent({
  order,
  nextStatus,
  isPending,
  onProgress,
  compact = false,
}: {
  order: AdminOrder;
  nextStatus: OrderStatus | null;
  isPending: boolean;
  onProgress: () => void;
  compact?: boolean;
}) {
  return (
    <>
      <div className={compact ? "grid gap-4" : "grid gap-6 p-5 md:grid-cols-2"}>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Cliente
          </h3>
          <dl className="space-y-2">
            <DetailRow label="Nome" value={order.customerName} />
            <DetailRow label="Telefone" value={order.customerPhone} />
            <DetailRow label="E-mail" value={order.customerEmail} />
          </dl>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Itens do pedido
          </h3>
          {order.items.length > 0 ? (
            <ul className="space-y-2">
              {order.items.map((item, index) => (
                <li
                  key={`${order.id}-${item.name}-${index}`}
                  className="rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-foreground">{item.name}</span>
                    <span className="text-muted-foreground">{item.quantity}x</span>
                  </div>
                  {item.extras && item.extras.length > 0 ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium">Extras:</span>{" "}
                      {item.extras.map((extra) => extra.name).join(", ")}
                    </div>
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

      {order.notes && (
        <section className={compact ? "mt-4" : "px-5 pb-5"}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Observações
          </h3>
          <p className="rounded-md border border-border px-3 py-2 text-sm text-foreground">
            {order.notes}
          </p>
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
          <p className="text-sm text-muted-foreground">
            {nextStatus
              ? `Próximo status: ${getOrderStatusLabel(nextStatus)}`
              : "Este pedido não pode avançar mais."}
          </p>
          <Button
            type="button"
            onClick={onProgress}
            disabled={!nextStatus || !order.status || isPending}
          >
            {isPending
              ? "Atualizando..."
              : nextStatus
                ? "Avançar status"
                : "Sem próxima etapa"}
          </Button>
        </div>
      </footer>
    </>
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
  switch (status) {
    case "aguardando_confirmacao":
      return "bg-amber-500/15 text-amber-700";
    case "em_preparo":
      return "bg-blue-500/15 text-blue-700";
    case "entregue":
      return "bg-green-600/15 text-green-700";
    default:
      return "bg-muted text-muted-foreground";
  }
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

function mergePolledOrdersIntoLocalState(
  currentOrders: AdminOrder[],
  polledOrders: AdminOrder[],
  pendingProgressOrderId: string | null
) {
  if (!pendingProgressOrderId) {
    return polledOrders;
  }

  const currentPendingOrder = findOrderById(currentOrders, pendingProgressOrderId);
  if (!currentPendingOrder) {
    return polledOrders;
  }

  const nextOrders = polledOrders.map((order) =>
    order.id === pendingProgressOrderId ? currentPendingOrder : order
  );

  if (!hasOrderWithId(polledOrders, pendingProgressOrderId)) {
    return [...nextOrders, currentPendingOrder];
  }

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
