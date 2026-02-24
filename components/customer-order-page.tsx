"use client";

import { useState, useTransition } from "react";
import type { MenuExtra, MenuItem } from "@/lib/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CustomerOrderPageProps = {
  menuItems: MenuItem[];
  isSupabaseConfigured: boolean;
};

type FeedbackState =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

type FieldErrors = {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
};

type CheckoutTab = "cardapio" | "pedido";

type SelectedOrderLine = {
  lineId: string;
  menuItemId: string;
  quantity: number;
  extraIds: string[];
};

type SelectedEntry = {
  lineId: string;
  item: MenuItem;
  quantity: number;
  extraIds: string[];
  selectedExtras: MenuExtra[];
};

const REQUIRED_ITEMS_MESSAGE = "Selecione pelo menos um item para enviar seu pedido.";
const REQUIRED_FIELDS_MESSAGE = "Preencha nome, e-mail e telefone para continuar.";
const SETUP_UNAVAILABLE_MESSAGE =
  "Pedidos indisponíveis no momento. Verifique a configuração do Supabase.";
const SETUP_BANNER_MESSAGE =
  "Pedidos indisponíveis no momento. Configure o Supabase para habilitar o envio.";

export function CustomerOrderPage({
  menuItems,
  isSupabaseConfigured,
}: CustomerOrderPageProps) {
  const menuCategories = buildMenuCategories(menuItems);
  const [selectedLines, setSelectedLines] = useState<SelectedOrderLine[]>([]);
  const [activeTab, setActiveTab] = useState<CheckoutTab>("cardapio");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [customizingMenuItemId, setCustomizingMenuItemId] = useState<string | null>(null);
  const [draftExtrasByMenuItemId, setDraftExtrasByMenuItemId] = useState<Record<string, string[]>>({});
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingLineExtraIds, setEditingLineExtraIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isPending, startTransition] = useTransition();

  const selectedEntries = selectedLines
    .map((line) => {
      const item = menuItems.find((menuItem) => menuItem.id === line.menuItemId);
      if (!item) return null;

      const extrasById = new Map((item.extras ?? []).map((extra) => [extra.id, extra]));
      const selectedExtras = line.extraIds
        .map((extraId) => extrasById.get(extraId))
        .filter((extra): extra is MenuExtra => Boolean(extra));

      return {
        lineId: line.lineId,
        item,
        quantity: line.quantity,
        extraIds: line.extraIds,
        selectedExtras,
      };
    })
    .filter((entry): entry is SelectedEntry => entry !== null);

  const visibleMenuItems =
    selectedCategory === "Todos"
      ? menuItems
      : menuItems.filter((item) => (item.category ?? "Outros") === selectedCategory);

  const totalItems = selectedEntries.reduce((acc, entry) => acc + entry.quantity, 0);
  const totalPriceCents = selectedEntries.reduce(
    (acc, entry) => acc + (entry.item.priceCents ?? 0) * entry.quantity,
    0
  );

  const canSubmit = isSupabaseConfigured && !isPending;

  function addItem(menuItemId: string, extraIds: string[] = []) {
    setFeedback(null);
    setSelectedLines((current) => addOrMergeOrderLine(current, menuItemId, 1, extraIds));
  }

  function changeLineQuantity(lineId: string, nextQuantity: number) {
    setFeedback(null);
    setSelectedLines((current) => {
      const normalized = Math.max(0, Math.trunc(nextQuantity));
      if (normalized <= 0) {
        return current.filter((line) => line.lineId !== lineId);
      }

      return current.map((line) =>
        line.lineId === lineId ? { ...line, quantity: normalized } : line
      );
    });

    if (editingLineId === lineId && nextQuantity <= 0) {
      setEditingLineId(null);
      setEditingLineExtraIds([]);
    }
  }

  function resetFormAndCart() {
    setSelectedLines([]);
    setCustomizingMenuItemId(null);
    setDraftExtrasByMenuItemId({});
    setEditingLineId(null);
    setEditingLineExtraIds([]);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setCustomerNotes("");
    setFieldErrors({});
  }

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      return { ...current, [field]: undefined };
    });
  }

  function validateRequiredFields(): FieldErrors {
    const nextErrors: FieldErrors = {};

    if (!customerName.trim()) nextErrors.customerName = "Informe seu nome.";
    if (!customerEmail.trim()) nextErrors.customerEmail = "Informe seu e-mail.";
    if (!customerPhone.trim()) nextErrors.customerPhone = "Informe seu telefone.";

    return nextErrors;
  }

  function toggleDraftExtra(menuItemId: string, extraId: string) {
    setDraftExtrasByMenuItemId((current) => {
      const currentDraft = current[menuItemId] ?? [];
      const nextDraft = currentDraft.includes(extraId)
        ? currentDraft.filter((id) => id !== extraId)
        : [...currentDraft, extraId];

      return { ...current, [menuItemId]: normalizeExtraIds(nextDraft) };
    });
    setFeedback(null);
  }

  function handleAddCustomizedItem(item: MenuItem) {
    addItem(item.id, draftExtrasByMenuItemId[item.id] ?? []);
    setCustomizingMenuItemId(null);
    setDraftExtrasByMenuItemId((current) => ({ ...current, [item.id]: [] }));
  }

  function startEditingLineExtras(lineId: string) {
    const line = selectedLines.find((entry) => entry.lineId === lineId);
    if (!line) return;
    setEditingLineId(lineId);
    setEditingLineExtraIds(line.extraIds);
    setFeedback(null);
  }

  function toggleEditingLineExtra(extraId: string) {
    setEditingLineExtraIds((current) =>
      normalizeExtraIds(
        current.includes(extraId)
          ? current.filter((id) => id !== extraId)
          : [...current, extraId]
      )
    );
    setFeedback(null);
  }

  function saveEditedLineExtras() {
    if (!editingLineId) return;
    setSelectedLines((current) => updateOrderLineExtras(current, editingLineId, editingLineExtraIds));
    setEditingLineId(null);
    setEditingLineExtraIds([]);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const nextFieldErrors = validateRequiredFields();
    setFieldErrors(nextFieldErrors);

    if (selectedEntries.length === 0) {
      setFeedback(errorFeedback(REQUIRED_ITEMS_MESSAGE));
      return;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFeedback(errorFeedback(REQUIRED_FIELDS_MESSAGE));
      return;
    }

    if (!isSupabaseConfigured) {
      setFeedback(errorFeedback(SETUP_UNAVAILABLE_MESSAGE));
      return;
    }

    startTransition(async () => {
      const result = await submitOrderRequest({
        customerName,
        customerEmail,
        customerPhone,
        notes: customerNotes,
        items: selectedEntries.map(({ item, quantity, extraIds }) => ({
          menuItemId: item.id,
          quantity,
          ...(extraIds.length > 0 ? { extraIds } : {}),
        })),
      });

      if (!result.ok) {
        setFeedback(errorFeedback(result.message));
        return;
      }

      resetFormAndCart();
      setFeedback(successFeedback(`Pedido ${result.orderReference} enviado com sucesso! Entraremos em contato em breve para confirmar seu pedido.`));
      setActiveTab("pedido");
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3 rounded-xl border bg-background p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Cardápio</h1>
            <p className="text-sm text-muted-foreground">Monte seu pedido e envie para a cozinha.</p>
          </div>
        </div>
        {!isSupabaseConfigured ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {SETUP_BANNER_MESSAGE}
          </p>
        ) : null}
      </header>

      <section className="rounded-xl border bg-background p-5">
        <div role="tablist" aria-label="Navegação do pedido" className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "cardapio"}
            onClick={() => setActiveTab("cardapio")}
            className={tabTriggerClass(activeTab === "cardapio")}
          >
            Cardápio
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "pedido"}
            onClick={() => setActiveTab("pedido")}
            className={tabTriggerClass(activeTab === "pedido")}
          >
            Seu pedido
          </button>
        </div>

        {activeTab === "cardapio" ? (
          <section aria-labelledby="menu-heading" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 id="menu-heading" className="text-xl font-semibold">Itens do cardápio</h2>
              <button
                type="button"
                onClick={() => setActiveTab("pedido")}
                className="text-sm text-primary underline underline-offset-4 hover:no-underline"
              >
                {totalItems} itens
              </button>
            </div>

            <div role="tablist" aria-label="Categorias do cardápio" className="flex flex-wrap gap-2">
              {menuCategories.map((category) => {
                const isActive = category === selectedCategory;
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSelectedCategory(category)}
                    className={tabTriggerClass(isActive)}
                  >
                    {category}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {visibleMenuItems.map((item) => {
                const quantity = selectedEntries
                  .filter((entry) => entry.item.id === item.id)
                  .reduce((acc, entry) => acc + entry.quantity, 0);
                const hasExtras = Boolean(item.extras && item.extras.length > 0);
                const isCustomizing = customizingMenuItemId === item.id;

                return (
                  <article key={item.id} className="flex min-h-40 flex-col justify-between rounded-xl border bg-card p-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">{item.name}</h3>
                      {item.description ? (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      ) : null}
                      {typeof item.priceCents === "number" ? (
                        <p className="text-sm font-medium">{formatCurrency(item.priceCents)}</p>
                      ) : null}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">
                        {quantity > 0 ? `${quantity} no pedido` : "Ainda não selecionado"}
                      </span>
                      <div className="flex items-center gap-2">
                        {hasExtras ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setCustomizingMenuItemId((current) => (current === item.id ? null : item.id))
                            }
                          >
                            Personalizar
                          </Button>
                        ) : null}
                        <Button type="button" onClick={() => addItem(item.id)}>
                          Adicionar
                        </Button>
                      </div>
                    </div>

                    {hasExtras && isCustomizing ? (
                      <MenuItemExtrasEditor
                        itemName={item.name}
                        extras={item.extras ?? []}
                        selectedExtraIds={draftExtrasByMenuItemId[item.id] ?? []}
                        onToggleExtra={(extraId) => toggleDraftExtra(item.id, extraId)}
                        onCancel={() => setCustomizingMenuItemId(null)}
                        onConfirm={() => handleAddCustomizedItem(item)}
                      />
                    ) : null}
                  </article>
                );
              })}
            </div>
            {visibleMenuItems.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Nenhum item nesta categoria.
              </p>
            ) : null}
          </section>
        ) : (
          <OrderSummaryTab
            totalItems={totalItems}
            totalPriceCents={totalPriceCents}
            selectedEntries={selectedEntries}
            customerName={customerName}
            customerEmail={customerEmail}
            customerPhone={customerPhone}
            customerNotes={customerNotes}
            fieldErrors={fieldErrors}
            isPending={isPending}
            canSubmit={canSubmit}
            feedback={feedback}
            onChangeQuantity={changeLineQuantity}
            onSubmit={handleSubmit}
            onCustomerNameChange={(value) => {
              setCustomerName(value);
              clearFieldError("customerName");
            }}
            onCustomerEmailChange={(value) => {
              setCustomerEmail(value);
              clearFieldError("customerEmail");
            }}
            onCustomerPhoneChange={(value) => {
              setCustomerPhone(value);
              clearFieldError("customerPhone");
            }}
            onCustomerNotesChange={setCustomerNotes}
            onStartEditLineExtras={startEditingLineExtras}
            editingLineId={editingLineId}
            editingLineExtraIds={editingLineExtraIds}
            onToggleEditingLineExtra={toggleEditingLineExtra}
            onSaveEditingLineExtras={saveEditedLineExtras}
            onCancelEditingLineExtras={() => {
              setEditingLineId(null);
              setEditingLineExtraIds([]);
            }}
            onBackToMenu={() => setActiveTab("cardapio")}
          />
        )}
      </section>
    </main>
  );
}

function buildMenuCategories(menuItems: MenuItem[]): string[] {
  const categories = new Set<string>(["Todos"]);

  for (const item of menuItems) {
    categories.add(item.category ?? "Outros");
  }

  return Array.from(categories);
}

function tabTriggerClass(isActive: boolean): string {
  return [
    "rounded-full border px-3 py-1.5 text-sm transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    isActive
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-foreground hover:bg-accent",
  ].join(" ");
}

type OrderSummaryTabProps = {
  totalItems: number;
  totalPriceCents: number;
  selectedEntries: SelectedEntry[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerNotes: string;
  fieldErrors: FieldErrors;
  isPending: boolean;
  canSubmit: boolean;
  feedback: FeedbackState;
  onChangeQuantity: (lineId: string, nextQuantity: number) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCustomerNameChange: (value: string) => void;
  onCustomerEmailChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onCustomerNotesChange: (value: string) => void;
  onStartEditLineExtras: (lineId: string) => void;
  editingLineId: string | null;
  editingLineExtraIds: string[];
  onToggleEditingLineExtra: (extraId: string) => void;
  onSaveEditingLineExtras: () => void;
  onCancelEditingLineExtras: () => void;
  onBackToMenu: () => void;
};

function OrderSummaryTab({
  totalItems,
  totalPriceCents,
  selectedEntries,
  customerName,
  customerEmail,
  customerPhone,
  customerNotes,
  fieldErrors,
  isPending,
  canSubmit,
  feedback,
  onChangeQuantity,
  onSubmit,
  onCustomerNameChange,
  onCustomerEmailChange,
  onCustomerPhoneChange,
  onCustomerNotesChange,
  onStartEditLineExtras,
  editingLineId,
  editingLineExtraIds,
  onToggleEditingLineExtra,
  onSaveEditingLineExtras,
  onCancelEditingLineExtras,
  onBackToMenu,
}: OrderSummaryTabProps) {
  return (
    <section aria-labelledby="checkout-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="checkout-heading" className="text-xl font-semibold">
          Seu pedido
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{totalItems} itens</span>
          <button
            type="button"
            onClick={onBackToMenu}
            className="text-sm text-primary underline underline-offset-4 hover:no-underline"
          >
            Voltar ao cardápio
          </button>
        </div>
      </div>

      {selectedEntries.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Nenhum item selecionado ainda.
        </p>
      ) : (
        <ul className="space-y-3">
          {selectedEntries.map(({ lineId, item, quantity, selectedExtras }) => (
            <li key={lineId} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.name}</p>
                  {typeof item.priceCents === "number" ? (
                    <p className="text-xs text-muted-foreground">{formatCurrency(item.priceCents)} cada</p>
                  ) : null}
                  {selectedExtras.length > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium">Extras:</span>{" "}
                      {selectedExtras.map((extra) => extra.name).join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Diminuir quantidade de ${item.name}`}
                    onClick={() => onChangeQuantity(lineId, quantity - 1)}
                  >
                    -
                  </Button>
                  <span className="min-w-6 text-center text-sm font-medium">{quantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Aumentar quantidade de ${item.name}`}
                    onClick={() => onChangeQuantity(lineId, quantity + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>

              {item.extras && item.extras.length > 0 ? (
                <div className="mt-3 border-t pt-3">
                  {editingLineId === lineId ? (
                    <MenuItemExtrasEditor
                      itemName={item.name}
                      extras={item.extras}
                      selectedExtraIds={editingLineExtraIds}
                      onToggleExtra={onToggleEditingLineExtra}
                      onCancel={onCancelEditingLineExtras}
                      onConfirm={onSaveEditingLineExtras}
                      confirmLabel="Salvar extras"
                    />
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onStartEditLineExtras(lineId)}
                    >
                      Editar extras
                    </Button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <label htmlFor="customer-name" className="text-sm font-medium">Nome</label>
          <Input
            id="customer-name"
            placeholder="Seu nome"
            value={customerName}
            onChange={(event) => onCustomerNameChange(event.target.value)}
            disabled={isPending}
            aria-invalid={Boolean(fieldErrors.customerName)}
            aria-describedby={fieldErrors.customerName ? "customer-name-error" : undefined}
            required
          />
          {fieldErrors.customerName ? (
            <p id="customer-name-error" className="text-xs text-rose-700">{fieldErrors.customerName}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="customer-email" className="text-sm font-medium">E-mail</label>
          <Input
            id="customer-email"
            type="email"
            inputMode="email"
            placeholder="voce@exemplo.com"
            value={customerEmail}
            onChange={(event) => onCustomerEmailChange(event.target.value)}
            disabled={isPending}
            aria-invalid={Boolean(fieldErrors.customerEmail)}
            aria-describedby={fieldErrors.customerEmail ? "customer-email-error" : undefined}
            required
          />
          {fieldErrors.customerEmail ? (
            <p id="customer-email-error" className="text-xs text-rose-700">{fieldErrors.customerEmail}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="customer-phone" className="text-sm font-medium">Telefone</label>
          <Input
            id="customer-phone"
            type="tel"
            inputMode="tel"
            placeholder="(11) 99999-9999"
            value={customerPhone}
            onChange={(event) => onCustomerPhoneChange(event.target.value)}
            disabled={isPending}
            aria-invalid={Boolean(fieldErrors.customerPhone)}
            aria-describedby={fieldErrors.customerPhone ? "customer-phone-error" : undefined}
            required
          />
          {fieldErrors.customerPhone ? (
            <p id="customer-phone-error" className="text-xs text-rose-700">{fieldErrors.customerPhone}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="customer-notes" className="text-sm font-medium">Observações (opcional)</label>
          <textarea
            id="customer-notes"
            placeholder="Ex.: sem cebola, ponto da carne, retirar molho..."
            value={customerNotes}
            onChange={(event) => onCustomerNotesChange(event.target.value)}
            disabled={isPending}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {selectedEntries.length > 0 ? (
          <p className="text-sm font-medium">Total estimado: {formatCurrency(totalPriceCents)}</p>
        ) : null}

        {feedback ? (
          <p
            role="status"
            className={
              feedback.type === "success"
                ? "rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
                : "rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900"
            }
          >
            {feedback.message}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={!canSubmit}>
          {isPending ? "Enviando pedido..." : "Enviar pedido"}
        </Button>
      </form>
    </section>
  );
}

function MenuItemExtrasEditor({
  itemName,
  extras,
  selectedExtraIds,
  onToggleExtra,
  onCancel,
  onConfirm,
  confirmLabel = "Adicionar com extras",
}: {
  itemName: string;
  extras: MenuExtra[];
  selectedExtraIds: string[];
  onToggleExtra: (extraId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}) {
  return (
    <div className="mt-3 rounded-md border border-dashed p-3">
      <p className="text-sm font-medium">Extras para {itemName}</p>
      <div className="mt-2 space-y-2">
        {extras.map((extra) => {
          const checked = selectedExtraIds.includes(extra.id);
          return (
            <label key={extra.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={checked} onChange={() => onToggleExtra(extra.id)} />
              <span>{extra.name}</span>
              {typeof extra.priceCents === "number" ? (
                <span className="text-xs text-muted-foreground">(+{formatCurrency(extra.priceCents)})</span>
              ) : null}
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
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

function formatCurrency(valueInCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);
}

type SubmitOrderRequestInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    extraIds?: string[];
  }>;
};

type SubmitOrderRequestResult =
  | { ok: true; orderReference: string }
  | { ok: false; message: string };

async function submitOrderRequest(
  payload: SubmitOrderRequestInput
): Promise<SubmitOrderRequestResult> {
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; orderReference?: string; message?: string }
      | null;

    if (!response.ok || !data?.ok || !data.orderReference) {
      return {
        ok: false,
        message:
          data?.message ??
          "Não foi possível enviar seu pedido agora. Tente novamente em instantes.",
      };
    }

    return { ok: true, orderReference: data.orderReference };
  } catch {
    return {
      ok: false,
      message: "Não foi possível enviar seu pedido agora. Tente novamente em instantes.",
    };
  }
}

function normalizeExtraIds(extraIds: string[]): string[] {
  return Array.from(new Set(extraIds.map((id) => id.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

function lineMergeKey(menuItemId: string, extraIds: string[]) {
  return `${menuItemId}::${normalizeExtraIds(extraIds).join("|")}`;
}

function lineMatchesMergeKey(line: SelectedOrderLine, key: string): boolean {
  return lineMergeKey(line.menuItemId, line.extraIds) === key;
}

function addOrMergeOrderLine(
  current: SelectedOrderLine[],
  menuItemId: string,
  quantity: number,
  extraIds: string[]
) {
  const normalizedExtraIds = normalizeExtraIds(extraIds);
  const key = lineMergeKey(menuItemId, normalizedExtraIds);
  const existing = current.find((line) => lineMatchesMergeKey(line, key));

  if (existing) {
    return current.map((line) =>
      line.lineId === existing.lineId ? { ...line, quantity: line.quantity + quantity } : line
    );
  }

  return [
    ...current,
    {
      lineId: createOrderLineId(),
      menuItemId,
      quantity,
      extraIds: normalizedExtraIds,
    },
  ];
}

function updateOrderLineExtras(
  current: SelectedOrderLine[],
  lineId: string,
  nextExtraIds: string[]
) {
  const target = current.find((line) => line.lineId === lineId);
  if (!target) return current;

  const normalizedExtraIds = normalizeExtraIds(nextExtraIds);
  const targetKey = lineMergeKey(target.menuItemId, normalizedExtraIds);
  const mergeTarget = current.find(
    (line) => line.lineId !== lineId && lineMatchesMergeKey(line, targetKey)
  );

  if (mergeTarget) {
    return current
      .filter((line) => line.lineId !== lineId)
      .map((line) =>
        line.lineId === mergeTarget.lineId
          ? { ...line, quantity: line.quantity + target.quantity }
          : line
      );
  }

  return current.map((line) =>
    line.lineId === lineId ? { ...line, extraIds: normalizedExtraIds } : line
  );
}

function createOrderLineId() {
  return `line-${Math.random().toString(36).slice(2, 10)}`;
}
