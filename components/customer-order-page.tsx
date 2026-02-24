"use client";

import { useState, useTransition } from "react";
import type { MenuItem } from "@/lib/menu";
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
  const [quantitiesByItemId, setQuantitiesByItemId] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<CheckoutTab>("cardapio");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isPending, startTransition] = useTransition();

  const selectedEntries = menuItems
    .filter((item) => (quantitiesByItemId[item.id] ?? 0) > 0)
    .map((item) => ({
      item,
      quantity: quantitiesByItemId[item.id],
    }));

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

  function addItem(itemId: string) {
    setFeedback(null);
    setQuantitiesByItemId((current) => ({
      ...current,
      [itemId]: (current[itemId] ?? 0) + 1,
    }));
  }

  function changeQuantity(itemId: string, nextQuantity: number) {
    setFeedback(null);
    setQuantitiesByItemId((current) => {
      const normalized = Math.max(0, Math.trunc(nextQuantity));
      if (normalized <= 0) {
        const { [itemId]: _, ...rest } = current;
        return rest;
      }

      return {
        ...current,
        [itemId]: normalized,
      };
    });
  }

  function resetFormAndCart() {
    setQuantitiesByItemId({});
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

    if (!customerName.trim()) {
      nextErrors.customerName = "Informe seu nome.";
    }
    if (!customerEmail.trim()) {
      nextErrors.customerEmail = "Informe seu e-mail.";
    }
    if (!customerPhone.trim()) {
      nextErrors.customerPhone = "Informe seu telefone.";
    }

    return nextErrors;
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
        items: selectedEntries.map(({ item, quantity }) => ({
          menuItemId: item.id,
          quantity,
        })),
      });

      if (!result.ok) {
        setFeedback(errorFeedback(result.message));
        return;
      }

      resetFormAndCart();
      setFeedback(
        successFeedback(`Pedido ${result.orderReference} enviado com sucesso!`)
      );
      setActiveTab("pedido");
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3 rounded-xl border bg-background p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Cardápio
            </h1>
            <p className="text-sm text-muted-foreground">
              Monte seu pedido e envie para a cozinha.
            </p>
          </div>
        </div>
        {!isSupabaseConfigured ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {SETUP_BANNER_MESSAGE}
          </p>
        ) : null}
      </header>

      <section className="rounded-xl border bg-background p-5">
        <div
          role="tablist"
          aria-label="Navegação do pedido"
          className="mb-5 flex flex-wrap gap-2"
        >
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
              <h2 id="menu-heading" className="text-xl font-semibold">
                Itens do cardápio
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab("pedido")}
                className="text-sm text-primary underline underline-offset-4 hover:no-underline"
              >
                {totalItems} itens
              </button>
            </div>

            <div
              role="tablist"
              aria-label="Categorias do cardápio"
              className="flex flex-wrap gap-2"
            >
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
                const quantity = quantitiesByItemId[item.id] ?? 0;

                return (
                  <article
                    key={item.id}
                    className="flex min-h-40 flex-col justify-between rounded-xl border bg-card p-4"
                  >
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">{item.name}</h3>
                      {item.description ? (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      ) : null}
                      {typeof item.priceCents === "number" ? (
                        <p className="text-sm font-medium">
                          {formatCurrency(item.priceCents)}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">
                        {quantity > 0 ? `${quantity} no pedido` : "Ainda não selecionado"}
                      </span>
                      <Button type="button" onClick={() => addItem(item.id)}>
                        Adicionar
                      </Button>
                    </div>
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
            onChangeQuantity={changeQuantity}
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

type SelectedEntry = {
  item: MenuItem;
  quantity: number;
};

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
  onChangeQuantity: (itemId: string, nextQuantity: number) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCustomerNameChange: (value: string) => void;
  onCustomerEmailChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onCustomerNotesChange: (value: string) => void;
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
          {selectedEntries.map(({ item, quantity }) => (
            <li key={item.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.name}</p>
                  {typeof item.priceCents === "number" ? (
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.priceCents)} cada
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Diminuir quantidade de ${item.name}`}
                    onClick={() => onChangeQuantity(item.id, quantity - 1)}
                  >
                    -
                  </Button>
                  <span className="min-w-6 text-center text-sm font-medium">{quantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Aumentar quantidade de ${item.name}`}
                    onClick={() => onChangeQuantity(item.id, quantity + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <label htmlFor="customer-name" className="text-sm font-medium">
            Nome
          </label>
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
            <p id="customer-name-error" className="text-xs text-rose-700">
              {fieldErrors.customerName}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="customer-email" className="text-sm font-medium">
            E-mail
          </label>
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
            <p id="customer-email-error" className="text-xs text-rose-700">
              {fieldErrors.customerEmail}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="customer-phone" className="text-sm font-medium">
            Telefone
          </label>
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
            <p id="customer-phone-error" className="text-xs text-rose-700">
              {fieldErrors.customerPhone}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="customer-notes" className="text-sm font-medium">
            Observações (opcional)
          </label>
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
          <p className="text-sm font-medium">
            Total estimado: {formatCurrency(totalPriceCents)}
          </p>
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
