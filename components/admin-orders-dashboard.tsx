"use client";

import { useState, useTransition } from "react";
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
};

export function AdminOrdersDashboard({
  initialOrders,
  initialLoadError = null,
}: AdminOrdersDashboardProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialOrders[0]?.id ?? null
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(initialLoadError ? { type: "error", message: initialLoadError } : null);
  const [isPending, startTransition] = useTransition();

  const counts = countOrdersByStatus(orders);
  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) ?? orders[0] ?? null;

  const nextStatus = selectedOrder ? getNextOrderStatus(selectedOrder.status) : null;

  function handleSelectOrder(orderId: string) {
    setSelectedOrderId(orderId);
    setFeedback(null);
  }

  function handleProgressOrder() {
    if (!selectedOrder || !selectedOrder.status || !nextStatus || isPending) return;

    const currentOrderId = selectedOrder.id;
    const currentStatus = selectedOrder.status;

    startTransition(async () => {
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
          order.id === currentOrderId
            ? {
                ...order,
                status: result.nextStatus,
                statusLabel: result.nextStatusLabel,
                rawStatus: result.nextStatus,
              }
            : order
        )
      );
      setFeedback({
        type: "success",
        message: `Pedido atualizado para ${result.nextStatusLabel}.`,
      });
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

    setFeedback({ type: "error", message: result.message });
  }

  if (orders.length === 0 && initialLoadError) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
        <SummaryCards counts={counts} />
        <FeedbackBanner type="error" message={initialLoadError} />
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

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <section className="rounded-lg border border-border bg-background">
          <header className="border-b border-border px-4 py-3">
            <h1 className="text-lg font-semibold text-foreground">Pedidos</h1>
            <p className="text-xs text-muted-foreground">
              Ordenados do mais antigo para o mais recente
            </p>
          </header>

          <ul className="max-h-[65vh] overflow-auto">
            {orders.map((order) => {
              const isSelected = selectedOrder?.id === order.id;

              return (
                <li key={order.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => handleSelectOrder(order.id)}
                    className={[
                      "w-full px-4 py-3 text-left transition-colors",
                      "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      isSelected ? "bg-accent" : "",
                    ].join(" ")}
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
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-background">
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

              <div className="grid gap-6 p-5 md:grid-cols-2">
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Cliente
                  </h3>
                  <dl className="space-y-2">
                    <DetailRow label="Nome" value={selectedOrder.customerName} />
                    <DetailRow label="Telefone" value={selectedOrder.customerPhone} />
                    <DetailRow label="E-mail" value={selectedOrder.customerEmail} />
                  </dl>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Itens do pedido
                  </h3>
                  {selectedOrder.items.length > 0 ? (
                    <ul className="space-y-2">
                      {selectedOrder.items.map((item, index) => (
                        <li
                          key={`${selectedOrder.id}-${item.name}-${index}`}
                          className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                        >
                          <span className="text-foreground">{item.name}</span>
                          <span className="text-muted-foreground">
                            {item.quantity}x
                          </span>
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

              {selectedOrder.notes && (
                <section className="px-5 pb-5">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Observações
                  </h3>
                  <p className="rounded-md border border-border px-3 py-2 text-sm text-foreground">
                    {selectedOrder.notes}
                  </p>
                </section>
              )}

              <footer className="mt-auto border-t border-border px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {nextStatus
                      ? `Próximo status: ${getOrderStatusLabel(nextStatus)}`
                      : "Este pedido não pode avançar mais."}
                  </p>
                  <Button
                    type="button"
                    onClick={handleProgressOrder}
                    disabled={!nextStatus || !selectedOrder.status || isPending}
                  >
                    {isPending
                      ? "Atualizando..."
                      : nextStatus
                        ? "Avançar status"
                        : "Sem próxima etapa"}
                  </Button>
                </div>
              </footer>
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
