"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  DEFAULT_FULFILLMENT_TYPE,
  FULFILLMENT_TYPE_OPTIONS,
  getDeliveryFeeCentsForFulfillmentType,
  type FulfillmentType,
} from "@/lib/fulfillment-types";
import type { MenuExtra, MenuItem, MenuRemovableIngredient } from "@/lib/menu";
import { formatBrazilPhoneMask } from "@/lib/phone";
import {
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
} from "@/lib/payment-methods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateOrder, type UpdateOrderResult } from "@/app/admin/actions";
import type { AdminOrder, AdminOrderItem } from "@/lib/orders";

type EditLine = {
  lineId: string;
  menuItemId: string;
  quantity: number;
  extraIds: string[];
  removedIngredientIds: string[];
};

type AdminOrderEditSheetProps = {
  order: AdminOrder;
  menuItems: MenuItem[];
  onClose: () => void;
  onSuccess: () => void;
};

function buildLineId() {
  return `edit-line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeIdSet(ids: string[]): string[] {
  return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function isBasicEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function AdminOrderEditSheet({
  order,
  menuItems,
  onClose,
  onSuccess,
}: AdminOrderEditSheetProps) {
  const menuMap = useMemo(
    () => new Map(menuItems.map((item) => [item.id, item])),
    [menuItems]
  );

  const initialLines = useMemo(() => {
    const lines: EditLine[] = [];
    for (const item of order.items) {
      const raw = (item as AdminOrderItem & { menuItemId?: string }).menuItemId;
      const rawId = typeof raw === "string" && raw.trim() ? raw.trim() : null;
      const nameMatchId =
        menuItems.find(
          (m) => m.name.trim().toLowerCase() === (item.name ?? "").trim().toLowerCase()
        )?.id ?? null;
      /** Prefer menu-backed id; keep raw id so admin can see/remove lines no longer on the menu. */
      const menuItemId =
        (rawId && menuMap.has(rawId) ? rawId : null) ?? nameMatchId ?? rawId ?? null;
      if (!menuItemId) continue;

      const extraIds = (item.extras ?? []).map((e) => e.id ?? e.name).filter(Boolean);
      const removedIngredientIds = (item.removedIngredients ?? [])
        .map((r) => r.id ?? r.name)
        .filter(Boolean);

      lines.push({
        lineId: buildLineId(),
        menuItemId,
        quantity: item.quantity,
        extraIds: normalizeIdSet(extraIds as string[]),
        removedIngredientIds: normalizeIdSet(removedIngredientIds as string[]),
      });
    }
    return lines;
  }, [order.items, menuMap, menuItems]);

  const [lines, setLines] = useState<EditLine[]>(initialLines);
  const [customerName, setCustomerName] = useState(order.customerName);
  const [customerEmail, setCustomerEmail] = useState(
    order.customerEmail === "Não informado" ? "" : order.customerEmail
  );
  const [customerPhone, setCustomerPhone] = useState(order.customerPhone);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    (order.paymentMethod as PaymentMethod) ?? "dinheiro"
  );
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>(
    (order.fulfillmentType as FulfillmentType) ?? DEFAULT_FULFILLMENT_TYPE
  );
  const [notes, setNotes] = useState(order.notes ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  const addOrMergeLine = useCallback(
    (menuItemId: string, quantity: number, extraIds: string[], removedIngredientIds: string[]) => {
      const normExtra = normalizeIdSet(extraIds);
      const normRemoved = normalizeIdSet(removedIngredientIds);
      const key = JSON.stringify([menuItemId, normExtra, normRemoved]);

      setLines((current) => {
        const existing = current.find(
          (l) =>
            l.menuItemId === menuItemId &&
            JSON.stringify([l.extraIds, l.removedIngredientIds]) ===
              JSON.stringify([normExtra, normRemoved])
        );
        if (existing) {
          return current.map((l) =>
            l.lineId === existing.lineId
              ? { ...l, quantity: l.quantity + quantity }
              : l
          );
        }
        return [
          ...current,
          {
            lineId: buildLineId(),
            menuItemId,
            quantity,
            extraIds: normExtra,
            removedIngredientIds: normRemoved,
          },
        ];
      });
    },
    []
  );

  const updateLineCustomization = useCallback(
    (lineId: string, extraIds: string[], removedIngredientIds: string[]) => {
      setLines((current) =>
        current.map((l) =>
          l.lineId === lineId
            ? {
                ...l,
                extraIds: normalizeIdSet(extraIds),
                removedIngredientIds: normalizeIdSet(removedIngredientIds),
              }
            : l
        )
      );
      setEditingLineId(null);
    },
    []
  );

  const changeQuantity = useCallback((lineId: string, nextQuantity: number) => {
    const normalized = Math.max(0, Math.trunc(nextQuantity));
    setLines((current) => {
      if (normalized <= 0) return current.filter((l) => l.lineId !== lineId);
      return current.map((l) =>
        l.lineId === lineId ? { ...l, quantity: normalized } : l
      );
    });
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines((current) => current.filter((l) => l.lineId !== lineId));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setFeedback(null);

      if (!customerName.trim()) {
        setFeedback("Informe o nome do cliente.");
        return;
      }
      if (!customerPhone.trim()) {
        setFeedback("Informe o telefone do cliente.");
        return;
      }
      if (customerEmail.trim() && !isBasicEmail(customerEmail)) {
        setFeedback("Informe um e-mail válido.");
        return;
      }
      if (lines.length === 0) {
        setFeedback("Selecione pelo menos um item.");
        return;
      }

      const orderPayload = {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || "",
        customerPhone,
        paymentMethod,
        fulfillmentType,
        notes: notes.trim() || undefined,
        items: lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          extraIds: l.extraIds,
          removedIngredientIds: l.removedIngredientIds,
        })),
      };

      startTransition(async () => {
        const result: UpdateOrderResult = await updateOrder({
          orderId: order.id,
          orderPayload,
        });

        if (result.ok) {
          onSuccess();
          onClose();
          return;
        }

        setFeedback(result.message);
      });
    },
    [
      customerName,
      customerEmail,
      customerPhone,
      paymentMethod,
      fulfillmentType,
      notes,
      lines,
      order.id,
      onClose,
      onSuccess,
    ]
  );

  const lineRows = useMemo(
    () =>
      lines.map((line) => ({
        line,
        item: menuMap.get(line.menuItemId) ?? null,
      })),
    [lines, menuMap]
  );

  const totalPriceCents = lineRows.reduce((acc, { line, item }) => {
    if (!item) return acc;
    return (
      acc +
      (item.priceCents ?? 0) * line.quantity +
      (item.extras ?? [])
        .filter((e) => line.extraIds.includes(e.id))
        .reduce((s, e) => s + (e.priceCents ?? 0), 0) *
        line.quantity
    );
  }, 0);
  const deliveryFeeCents = getDeliveryFeeCentsForFulfillmentType(fulfillmentType);
  const totalCents = totalPriceCents + deliveryFeeCents;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-order-edit-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg border border-border bg-background shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-5 py-4">
          <h2 id="admin-order-edit-title" className="text-lg font-semibold">
            Editar pedido {order.reference}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isPending}
          >
            Fechar
          </Button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 p-5">
          {feedback ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {feedback}
            </div>
          ) : null}

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Itens do pedido
            </h3>
            {lineRows.length > 0 ? (
              <ul className="space-y-2">
                {lineRows.map(({ line, item }) => (
                  <li
                    key={line.lineId}
                    className="rounded-md border border-border px-3 py-2"
                  >
                    {item ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{item.name}</p>
                            {(line.extraIds.length > 0 || line.removedIngredientIds.length > 0) && (
                              <p className="text-xs text-muted-foreground">
                                {line.extraIds.length > 0 &&
                                  `Extras: ${line.extraIds
                                    .map(
                                      (id) =>
                                        item.extras?.find((e) => e.id === id)?.name ?? id
                                    )
                                    .join(", ")}`}
                                {line.extraIds.length > 0 &&
                                  line.removedIngredientIds.length > 0 &&
                                  " | "}
                                {line.removedIngredientIds.length > 0 &&
                                  `Sem: ${line.removedIngredientIds
                                    .map(
                                      (id) =>
                                        item.removableIngredients?.find((r) => r.id === id)
                                          ?.name ?? id
                                    )
                                    .join(", ")}`}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                            <label className="sr-only" htmlFor={`qty-${line.lineId}`}>
                              Quantidade de {item.name}
                            </label>
                            <Input
                              id={`qty-${line.lineId}`}
                              type="number"
                              min={0}
                              value={line.quantity}
                              onChange={(e) =>
                                changeQuantity(line.lineId, parseInt(e.target.value, 10) || 0)
                              }
                              className="w-16"
                              disabled={isPending}
                              aria-describedby={`qty-hint-${line.lineId}`}
                            />
                            <span id={`qty-hint-${line.lineId}`} className="sr-only">
                              Use 0 para remover o item do pedido.
                            </span>
                            {(item.extras?.length ?? 0) > 0 ||
                            (item.removableIngredients?.length ?? 0) > 0 ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setEditingLineId(
                                    editingLineId === line.lineId ? null : line.lineId
                                  )
                                }
                                disabled={isPending}
                              >
                                {editingLineId === line.lineId ? "Fechar" : "Editar extras"}
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeLine(line.lineId)}
                              disabled={isPending}
                            >
                              Remover item
                            </Button>
                          </div>
                        </div>
                        {editingLineId === line.lineId &&
                        ((item.extras?.length ?? 0) > 0 ||
                          (item.removableIngredients?.length ?? 0) > 0) ? (
                          <LineCustomizationEditor
                            line={line}
                            item={item}
                            onSave={(extraIds, removedIngredientIds) =>
                              updateLineCustomization(
                                line.lineId,
                                extraIds,
                                removedIngredientIds
                              )
                            }
                            onCancel={() => setEditingLineId(null)}
                            disabled={isPending}
                          />
                        ) : null}
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-amber-900 dark:text-amber-100">
                            Item fora do cardápio atual
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ID: <code className="rounded bg-muted px-1">{line.menuItemId}</code> — remova
                            para poder salvar, ou substitua por um item do cardápio.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeLine(line.lineId)}
                          disabled={isPending}
                        >
                          Remover item
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                Nenhum item editável. Adicione itens do cardápio.
              </p>
            )}
            <AddItemFromMenu
              menuItems={menuItems}
              onAdd={addOrMergeLine}
              disabled={isPending}
            />
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Cliente
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-name" className="text-sm font-medium">
                  Nome
                </label>
                <Input
                  id="edit-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome do cliente"
                  disabled={isPending}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="edit-phone" className="text-sm font-medium">
                  Telefone
                </label>
                <Input
                  id="edit-phone"
                  value={formatBrazilPhoneMask(customerPhone)}
                  onChange={(e) =>
                    setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 11))
                  }
                  placeholder="(00) 00000-0000"
                  disabled={isPending}
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="edit-email" className="text-sm font-medium">
                  E-mail (opcional)
                </label>
                <Input
                  id="edit-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  disabled={isPending}
                  className="mt-1"
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Forma de pagamento
            </h3>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-4 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={opt.value}
                    checked={paymentMethod === opt.value}
                    onChange={() => setPaymentMethod(opt.value)}
                    disabled={isPending}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tipo de entrega
            </h3>
            <div className="flex flex-wrap gap-2">
              {FULFILLMENT_TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-4 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="fulfillmentType"
                    value={opt.value}
                    checked={fulfillmentType === opt.value}
                    onChange={() => setFulfillmentType(opt.value)}
                    disabled={isPending}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <label htmlFor="edit-notes" className="text-sm font-medium">
              Observações
            </label>
            <Input
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: troco para R$ 50"
              disabled={isPending}
              className="mt-1"
            />
          </section>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
            <p className="text-sm font-medium">
              Total estimado:{" "}
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(totalCents / 100)}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function LineCustomizationEditor({
  line,
  item,
  onSave,
  onCancel,
  disabled,
}: {
  line: EditLine;
  item: MenuItem;
  onSave: (extraIds: string[], removedIngredientIds: string[]) => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  const [extraIds, setExtraIds] = useState(line.extraIds);
  const [removedIngredientIds, setRemovedIngredientIds] = useState(
    line.removedIngredientIds
  );

  const toggleExtra = (id: string) =>
    setExtraIds((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : [...c, id]
    );
  const toggleRemoved = (id: string) =>
    setRemovedIngredientIds((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : [...c, id]
    );

  return (
    <div className="mt-3 rounded-md border border-dashed border-border bg-muted/30 p-3">
      <div className="mb-2 text-sm font-medium">Personalizar item</div>
      <div className="flex flex-wrap gap-3">
        {(item.extras ?? []).map((extra: MenuExtra) => (
          <label key={extra.id} className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={extraIds.includes(extra.id)}
              onChange={() => toggleExtra(extra.id)}
              disabled={disabled}
            />
            {extra.name}
          </label>
        ))}
        {(item.removableIngredients ?? []).map((ing: MenuRemovableIngredient) => (
          <label key={ing.id} className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={removedIngredientIds.includes(ing.id)}
              onChange={() => toggleRemoved(ing.id)}
              disabled={disabled}
            />
            Sem {ing.name}
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSave(extraIds, removedIngredientIds)}
          disabled={disabled}
        >
          Salvar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={disabled}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function AddItemFromMenu({
  menuItems,
  onAdd,
  disabled,
}: {
  menuItems: MenuItem[];
  onAdd: (
    menuItemId: string,
    quantity: number,
    extraIds: string[],
    removedIngredientIds: string[]
  ) => void;
  disabled: boolean;
}) {
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [removedIngredientIds, setRemovedIngredientIds] = useState<string[]>([]);

  const selectedItem = menuItems.find((i) => i.id === selectedItemId);

  const handleAdd = useCallback(() => {
    if (!selectedItemId) return;
    onAdd(selectedItemId, quantity, extraIds, removedIngredientIds);
    setSelectedItemId("");
    setQuantity(1);
    setExtraIds([]);
    setRemovedIngredientIds([]);
  }, [selectedItemId, quantity, extraIds, removedIngredientIds, onAdd]);

  return (
    <div className="mt-4 rounded-md border border-dashed border-border p-4">
      <p className="mb-2 text-sm font-medium text-muted-foreground">
        Adicionar item do cardápio
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          value={selectedItemId}
          onChange={(e) => {
            setSelectedItemId(e.target.value);
            setExtraIds([]);
            setRemovedIngredientIds([]);
          }}
          disabled={disabled}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Selecione um item</option>
          {menuItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
          className="w-20"
          disabled={disabled}
        />
        {selectedItem && (
          <>
            {(selectedItem.extras ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(selectedItem.extras ?? []).map((extra: MenuExtra) => (
                  <label key={extra.id} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={extraIds.includes(extra.id)}
                      onChange={() =>
                        setExtraIds((c) =>
                          c.includes(extra.id)
                            ? c.filter((id) => id !== extra.id)
                            : [...c, extra.id]
                        )
                      }
                      disabled={disabled}
                    />
                    {extra.name}
                  </label>
                ))}
              </div>
            )}
            {(selectedItem.removableIngredients ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(selectedItem.removableIngredients ?? []).map(
                  (ing: MenuRemovableIngredient) => (
                    <label key={ing.id} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={removedIngredientIds.includes(ing.id)}
                        onChange={() =>
                          setRemovedIngredientIds((c) =>
                            c.includes(ing.id)
                              ? c.filter((id) => id !== ing.id)
                              : [...c, ing.id]
                          )
                        }
                        disabled={disabled}
                      />
                      Sem {ing.name}
                    </label>
                  )
                )}
              </div>
            )}
          </>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={disabled || !selectedItemId}
        >
          Adicionar
        </Button>
      </div>
    </div>
  );
}
