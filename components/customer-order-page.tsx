"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  FULFILLMENT_DELIVERY_FEE_CENTS,
  FULFILLMENT_TYPE_OPTIONS,
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

type CustomerOrderPageProps = {
  menuItems: MenuItem[];
  isSupabaseConfigured: boolean;
  isCaptchaRequired?: boolean;
  turnstileSiteKey?: string | null;
  storePhoneDisplay?: string | null;
  storePhoneHref?: string | null;
};

type FeedbackState =
  | { type: "success"; message: string }
  | { type: "info"; message: string }
  | { type: "error"; message: string }
  | null;

type FieldErrors = {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  paymentMethod?: string;
};

type CheckoutTab = "cardapio" | "pedido";
type SelectedOrderLine = {
  lineId: string;
  menuItemId: string;
  quantity: number;
  extraIds: string[];
  removedIngredientIds: string[];
};

type SelectedEntry = {
  lineId: string;
  item: MenuItem;
  quantity: number;
  extraIds: string[];
  removedIngredientIds: string[];
  selectedExtras: MenuExtra[];
  selectedRemovedIngredients: MenuRemovableIngredient[];
};

const REQUIRED_ITEMS_MESSAGE = "Selecione pelo menos um item para enviar seu pedido.";
const REQUIRED_FIELDS_MESSAGE =
  "Preencha nome, telefone e selecione a forma de pagamento para continuar.";
const REQUIRED_PAYMENT_METHOD_MESSAGE = "Selecione uma forma de pagamento.";
const INVALID_EMAIL_MESSAGE = "Informe um e-mail válido.";
const SETUP_UNAVAILABLE_MESSAGE =
  "Pedidos indisponíveis no momento. Verifique a configuração do Supabase.";
const SETUP_BANNER_MESSAGE =
  "Pedidos indisponíveis no momento. Configure o Supabase para habilitar o envio.";
const CAPTCHA_SETUP_BANNER_MESSAGE =
  "Verificação de segurança indisponível no momento. Recarregue a página ou tente novamente em instantes.";
const CAPTCHA_VALIDATION_MESSAGE =
  "Falha na verificação de segurança. Atualize a página e tente novamente.";
const CAPTCHA_LOADING_MESSAGE = "Verificando segurança...";
const CART_ADD_FEEDBACK_DURATION_MS = 1400;
const MENU_CARD_CLASS =
  "flex min-h-40 min-w-0 flex-col justify-between rounded-2xl border border-[hsl(var(--menu-border-strong))] bg-[hsl(var(--menu-surface))] p-4 shadow-[0_10px_26px_-22px_hsl(var(--menu-ink)/0.95)]";
const MENU_CARD_ACTION_ROW_CLASS =
  "mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between";
const MENU_CARD_ACTION_BUTTONS_ROW_CLASS =
  "flex flex-wrap items-center gap-2 sm:justify-end";
const MENU_EXTRAS_EDITOR_CLASS =
  "mt-3 min-w-0 rounded-xl border border-dashed border-[hsl(var(--menu-border-strong))] bg-[hsl(var(--menu-surface-soft))] p-3";
const MENU_EXTRAS_EDITOR_OPTION_ROW_CLASS = "flex min-w-0 flex-wrap items-center gap-2 text-sm";
const MENU_BRAND_BUTTON_CLASS =
  "bg-[hsl(var(--menu-brand))] font-semibold text-[hsl(var(--menu-brand-foreground))] hover:bg-[hsl(var(--menu-brand-dark))]";
const MENU_OUTLINE_BUTTON_CLASS =
  "border-[hsl(var(--menu-border-strong))] bg-[hsl(var(--menu-surface))] text-[hsl(var(--menu-ink))] hover:bg-[hsl(var(--menu-surface-soft))]";
const MENU_RADIO_ACCENT_CLASS = "accent-[hsl(var(--menu-brand))]";
const MENU_PRICE_CHIP_CLASS =
  "inline-flex rounded-full bg-[hsl(var(--menu-brand))] px-3 py-1 text-sm font-bold text-[hsl(var(--menu-brand-foreground))]";
const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      size: "invisible";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    }
  ) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function CustomerOrderPage({
  menuItems,
  isSupabaseConfigured,
  isCaptchaRequired = false,
  turnstileSiteKey = null,
  storePhoneDisplay = null,
  storePhoneHref = null,
}: CustomerOrderPageProps) {
  const menuCategories = buildMenuCategories(menuItems);
  const [selectedLines, setSelectedLines] = useState<SelectedOrderLine[]>([]);
  const [activeTab, setActiveTab] = useState<CheckoutTab>("cardapio");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [customizingMenuItemId, setCustomizingMenuItemId] = useState<string | null>(null);
  const [draftExtrasByMenuItemId, setDraftExtrasByMenuItemId] = useState<Record<string, string[]>>({});
  const [draftRemovedIngredientsByMenuItemId, setDraftRemovedIngredientsByMenuItemId] =
    useState<Record<string, string[]>>({});
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingLineExtraIds, setEditingLineExtraIds] = useState<string[]>([]);
  const [editingLineRemovedIngredientIds, setEditingLineRemovedIngredientIds] = useState<string[]>(
    []
  );
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("retirada");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isPending, startTransition] = useTransition();
  const [isCaptchaPending, setIsCaptchaPending] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isCartFeedbackActive, setIsCartFeedbackActive] = useState(false);
  const [isPageScrolled, setIsPageScrolled] = useState(false);
  const [cartFeedbackAnnouncementCount, setCartFeedbackAnnouncementCount] = useState(0);
  const cartFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const pendingSubmitPayloadRef = useRef<SubmitOrderRequestInput | null>(null);

  const selectedEntries = selectedLines
    .map((line) => {
      const item = menuItems.find((menuItem) => menuItem.id === line.menuItemId);
      if (!item) return null;

      const extrasById = new Map((item.extras ?? []).map((extra) => [extra.id, extra]));
      const selectedExtras = line.extraIds
        .map((extraId) => extrasById.get(extraId))
        .filter((extra): extra is MenuExtra => Boolean(extra));
      const removableIngredientsById = new Map(
        (item.removableIngredients ?? []).map((ingredient) => [ingredient.id, ingredient])
      );
      const selectedRemovedIngredients = line.removedIngredientIds
        .map((ingredientId) => removableIngredientsById.get(ingredientId))
        .filter((ingredient): ingredient is MenuRemovableIngredient => Boolean(ingredient));

      return {
        lineId: line.lineId,
        item,
        quantity: line.quantity,
        extraIds: line.extraIds,
        removedIngredientIds: line.removedIngredientIds,
        selectedExtras,
        selectedRemovedIngredients,
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
  const deliveryFeeCents =
    fulfillmentType === "entrega" ? FULFILLMENT_DELIVERY_FEE_CENTS : 0;
  const estimatedTotalPriceCents = totalPriceCents + deliveryFeeCents;
  const cartCountLabel = formatItemCountLabel(totalItems);
  const cartFeedbackState = isCartFeedbackActive ? "recent-add" : "idle";
  const cartTabLabel = `Carrinho (${cartCountLabel})`;
  const viewCartButtonLabel = `Ver carrinho (${cartCountLabel})`;
  const cartFeedbackAnnouncement =
    cartFeedbackAnnouncementCount > 0
      ? `Item adicionado ao carrinho. ${viewCartButtonLabel}.`
      : "";

  const isCaptchaConfigured = !isCaptchaRequired || Boolean(turnstileSiteKey);
  const canSubmit = isSupabaseConfigured && isCaptchaConfigured && !isPending && !isCaptchaPending;

  function addItem(
    menuItemId: string,
    extraIds: string[] = [],
    removedIngredientIds: string[] = []
  ) {
    setFeedback(null);
    setSelectedLines((current) =>
      addOrMergeOrderLine(current, menuItemId, 1, extraIds, removedIngredientIds)
    );
    triggerCartFeedback();
  }

  function triggerCartFeedback() {
    if (cartFeedbackTimeoutRef.current) {
      clearTimeout(cartFeedbackTimeoutRef.current);
    }
    setCartFeedbackAnnouncementCount((current) => current + 1);
    setIsCartFeedbackActive(true);
    cartFeedbackTimeoutRef.current = setTimeout(() => {
      setIsCartFeedbackActive(false);
      cartFeedbackTimeoutRef.current = null;
    }, CART_ADD_FEEDBACK_DURATION_MS);
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
      setEditingLineRemovedIngredientIds([]);
    }
  }

  function resetFormAndCart() {
    setSelectedLines([]);
    setCustomizingMenuItemId(null);
    setDraftExtrasByMenuItemId({});
    setDraftRemovedIngredientsByMenuItemId({});
    setEditingLineId(null);
    setEditingLineExtraIds([]);
    setEditingLineRemovedIngredientIds([]);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setFulfillmentType("retirada");
    setPaymentMethod("");
    setCustomerNotes("");
    setFieldErrors({});
  }

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      return { ...current, [field]: undefined };
    });
  }

  useEffect(() => {
    return () => {
      if (cartFeedbackTimeoutRef.current) {
        clearTimeout(cartFeedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const updateScrollState = () => {
      const nextIsScrolled = window.scrollY > 8;
      setIsPageScrolled((current) => (current === nextIsScrolled ? current : nextIsScrolled));
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  useEffect(() => {
    if (!isCaptchaRequired || !turnstileSiteKey) return;
    if (typeof window === "undefined") return;
    const container = turnstileContainerRef.current;
    if (!container) return;

    let disposed = false;

    const renderWidget = () => {
      if (disposed) return;
      if (!window.turnstile || turnstileWidgetIdRef.current) return;
      turnstileWidgetIdRef.current = window.turnstile.render(container, {
        sitekey: turnstileSiteKey,
        size: "invisible",
        callback: handleTurnstileSuccess,
        "error-callback": handleTurnstileFailure,
        "expired-callback": handleTurnstileExpired,
      });
    };

    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as
      | HTMLScriptElement
      | null;

    if (window.turnstile) {
      renderWidget();
    } else if (existingScript) {
      existingScript.addEventListener("load", renderWidget);
      existingScript.addEventListener("error", handleTurnstileFailure);
    } else {
      const script = document.createElement("script");
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderWidget);
      script.addEventListener("error", handleTurnstileFailure);
      document.head.appendChild(script);
    }

    return () => {
      disposed = true;
      const script = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
      script?.removeEventListener("load", renderWidget);
      script?.removeEventListener("error", handleTurnstileFailure);
      if (window.turnstile && turnstileWidgetIdRef.current) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [isCaptchaRequired, turnstileSiteKey]);

  function validateRequiredFields(): FieldErrors {
    const nextErrors: FieldErrors = {};

    if (!customerName.trim()) nextErrors.customerName = "Informe seu nome.";
    if (customerEmail.trim() && !isBasicEmail(customerEmail)) {
      nextErrors.customerEmail = INVALID_EMAIL_MESSAGE;
    }
    if (!customerPhone.trim()) nextErrors.customerPhone = "Informe seu telefone.";
    if (!paymentMethod) nextErrors.paymentMethod = REQUIRED_PAYMENT_METHOD_MESSAGE;

    return nextErrors;
  }

  function toggleDraftExtra(menuItemId: string, extraId: string) {
    setDraftExtrasByMenuItemId((current) => {
      const currentDraft = current[menuItemId] ?? [];
      const nextDraft = currentDraft.includes(extraId)
        ? currentDraft.filter((id) => id !== extraId)
        : [...currentDraft, extraId];

      return { ...current, [menuItemId]: normalizeIdSet(nextDraft) };
    });
    setFeedback(null);
  }

  function toggleDraftRemovedIngredient(menuItemId: string, ingredientId: string) {
    setDraftRemovedIngredientsByMenuItemId((current) => {
      const currentDraft = current[menuItemId] ?? [];
      const nextDraft = currentDraft.includes(ingredientId)
        ? currentDraft.filter((id) => id !== ingredientId)
        : [...currentDraft, ingredientId];

      return { ...current, [menuItemId]: normalizeIdSet(nextDraft) };
    });
    setFeedback(null);
  }

  function handleAddCustomizedItem(item: MenuItem) {
    addItem(
      item.id,
      draftExtrasByMenuItemId[item.id] ?? [],
      draftRemovedIngredientsByMenuItemId[item.id] ?? []
    );
    setCustomizingMenuItemId(null);
    setDraftExtrasByMenuItemId((current) => ({ ...current, [item.id]: [] }));
    setDraftRemovedIngredientsByMenuItemId((current) => ({ ...current, [item.id]: [] }));
  }

  function handleAddFromMenuCard(item: MenuItem) {
    const hasCustomization =
      Boolean(item.extras && item.extras.length > 0) ||
      Boolean(item.removableIngredients && item.removableIngredients.length > 0);

    if (!hasCustomization) {
      addItem(item.id);
      return;
    }

    handleAddCustomizedItem(item);
  }

  function startEditingLineCustomization(lineId: string) {
    const line = selectedLines.find((entry) => entry.lineId === lineId);
    if (!line) return;
    setEditingLineId(lineId);
    setEditingLineExtraIds(line.extraIds);
    setEditingLineRemovedIngredientIds(line.removedIngredientIds);
    setFeedback(null);
  }

  function toggleEditingLineExtraId(extraId: string) {
    setEditingLineExtraIds((current) =>
      normalizeIdSet(
        current.includes(extraId)
          ? current.filter((id) => id !== extraId)
          : [...current, extraId]
      )
    );
    setFeedback(null);
  }

  function toggleEditingLineRemovedIngredient(ingredientId: string) {
    setEditingLineRemovedIngredientIds((current) =>
      normalizeIdSet(
        current.includes(ingredientId)
          ? current.filter((id) => id !== ingredientId)
          : [...current, ingredientId]
      )
    );
    setFeedback(null);
  }

  function saveEditedLineCustomization() {
    if (!editingLineId) return;
    setSelectedLines((current) =>
      updateOrderLineCustomization(
        current,
        editingLineId,
        editingLineExtraIds,
        editingLineRemovedIngredientIds
      )
    );
    setEditingLineId(null);
    setEditingLineExtraIds([]);
    setEditingLineRemovedIngredientIds([]);
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

    if (!isCaptchaConfigured) {
      setFeedback(errorFeedback(CAPTCHA_SETUP_BANNER_MESSAGE));
      return;
    }

    if (!paymentMethod) {
      setFeedback(errorFeedback(REQUIRED_FIELDS_MESSAGE));
      return;
    }
    const selectedPaymentMethod = paymentMethod;
    const payload: SubmitOrderRequestInput = {
      customerName,
      customerEmail,
      customerPhone,
      fulfillmentType,
      paymentMethod: selectedPaymentMethod,
      notes: customerNotes,
      items: selectedEntries.map(({ item, quantity, extraIds, removedIngredientIds }) => ({
        menuItemId: item.id,
        quantity,
        ...(extraIds.length > 0 ? { extraIds } : {}),
        ...(removedIngredientIds.length > 0 ? { removedIngredientIds } : {}),
      })),
    };

    if (isCaptchaRequired) {
      pendingSubmitPayloadRef.current = payload;
      requestTurnstileToken();
      return;
    }

    submitOrder(payload);
  }

  function requestTurnstileToken() {
    const widgetId = turnstileWidgetIdRef.current;
    if (!widgetId || !window.turnstile) {
      setFeedback(errorFeedback(CAPTCHA_SETUP_BANNER_MESSAGE));
      pendingSubmitPayloadRef.current = null;
      return;
    }

    setIsCaptchaPending(true);
    setFeedback(infoFeedback(CAPTCHA_LOADING_MESSAGE));
    setTurnstileToken(null);
    window.turnstile.execute(widgetId);
  }

  function resetTurnstileWidget() {
    const widgetId = turnstileWidgetIdRef.current;
    if (!widgetId || !window.turnstile) return;
    window.turnstile.reset(widgetId);
  }

  function handleTurnstileSuccess(token: string) {
    setIsCaptchaPending(false);
    setTurnstileToken(token);

    const pendingPayload = pendingSubmitPayloadRef.current;
    if (!pendingPayload) return;
    pendingSubmitPayloadRef.current = null;
    submitOrder(pendingPayload, token);
  }

  function handleTurnstileFailure() {
    setIsCaptchaPending(false);
    pendingSubmitPayloadRef.current = null;
    setTurnstileToken(null);
    setFeedback(errorFeedback(CAPTCHA_VALIDATION_MESSAGE));
  }

  function handleTurnstileExpired() {
    setTurnstileToken(null);
  }

  function submitOrder(payload: SubmitOrderRequestInput, token?: string) {
    startTransition(async () => {
      const result = await submitOrderRequest({
        ...payload,
        ...(isCaptchaRequired ? { turnstileToken: token ?? turnstileToken ?? "" } : {}),
      });

      if (!result.ok) {
        setFeedback(errorFeedback(result.message));
        if (isCaptchaRequired) {
          setTurnstileToken(null);
          resetTurnstileWidget();
        }
        return;
      }

      resetFormAndCart();
      if (isCaptchaRequired) {
        setTurnstileToken(null);
        resetTurnstileWidget();
      }
      setFeedback(successFeedback(`Pedido ${result.orderReference} enviado com sucesso! Entraremos em contato em breve para confirmar seu pedido.`));
      setActiveTab("pedido");
    });
  }

  return (
    <main className="menu-theme mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="relative overflow-hidden rounded-3xl border border-[hsl(var(--menu-border-strong))] bg-[hsl(var(--menu-brand))] px-5 py-6 text-[hsl(var(--menu-brand-foreground))] shadow-[0_14px_36px_-20px_hsl(var(--menu-brand)/0.75)] sm:px-7 sm:py-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_22%,hsl(var(--menu-brand-highlight)/0.4),transparent_42%),radial-gradient(circle_at_84%_20%,hsl(var(--menu-brand-highlight)/0.25),transparent_34%)]"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative z-10">
            <h1 className="text-3xl font-black leading-none tracking-tight sm:text-4xl">
              Lanchonete Dioney
            </h1>
            <p className="mt-2 text-sm text-[hsl(var(--menu-brand-foreground)/0.9)]">
              Monte seu pedido e envie para a cozinha.
            </p>
          </div>
          {storePhoneDisplay && storePhoneHref ? (
            <div className="relative z-10 pt-1 text-left sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--menu-brand-foreground)/0.78)]">
                Telefone
              </p>
              <a
                href={storePhoneHref}
                className="mt-1 inline-block text-lg font-black tracking-tight text-[hsl(var(--menu-brand-foreground))] underline-offset-4 hover:underline"
              >
                {storePhoneDisplay}
              </a>
            </div>
          ) : null}
        </div>
        {!isSupabaseConfigured ? (
          <p className="relative z-10 mt-3 rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {SETUP_BANNER_MESSAGE}
          </p>
        ) : isCaptchaRequired && !isCaptchaConfigured ? (
          <p className="relative z-10 mt-3 rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {CAPTCHA_SETUP_BANNER_MESSAGE}
          </p>
        ) : null}
      </header>

      <section className="rounded-3xl border border-[hsl(var(--menu-border-strong))] bg-[hsl(var(--menu-surface))] p-4 shadow-[0_18px_38px_-28px_hsl(var(--menu-ink)/0.7)] sm:p-5">
        {isCaptchaRequired ? (
          <div ref={turnstileContainerRef} className="sr-only" aria-hidden="true" />
        ) : null}
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {cartFeedbackAnnouncement}
        </p>
        <div
          role="tablist"
          aria-label="Navegação do pedido"
          className={[
            "sticky top-2 z-20 mb-5 grid grid-cols-2 gap-2 rounded-xl border border-[hsl(var(--menu-border-soft))] bg-[hsl(var(--menu-surface)/0.95)] p-2 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--menu-surface)/0.9)] sm:top-3 md:static md:top-auto md:z-auto md:flex md:flex-wrap md:justify-start md:border-transparent md:bg-transparent md:p-0 md:backdrop-blur-none",
            isPageScrolled
              ? "shadow-[0_10px_26px_-20px_hsl(var(--menu-ink)/0.8)] ring-1 ring-[hsl(var(--menu-border-strong))] md:shadow-none md:ring-0"
              : "",
          ].join(" ")}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "cardapio"}
            onClick={() => setActiveTab("cardapio")}
            className={`${tabTriggerClass(activeTab === "cardapio")} w-full text-center md:w-auto md:min-w-[9.5rem]`}
          >
            Cardápio
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "pedido"}
            onClick={() => setActiveTab("pedido")}
            data-cart-feedback-state={cartFeedbackState}
            className={`${tabTriggerClass(activeTab === "pedido", isCartFeedbackActive)} w-full text-center md:w-auto md:min-w-[9.5rem]`}
          >
            {cartTabLabel}
          </button>
        </div>

        {activeTab === "cardapio" ? (
          <section aria-labelledby="menu-heading" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 id="menu-heading" className="text-xl font-black tracking-tight text-[hsl(var(--menu-ink))]">
                Itens do cardápio
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab("pedido")}
                data-cart-feedback-state={cartFeedbackState}
                className={[
                  "text-sm font-semibold text-[hsl(var(--menu-brand))] underline underline-offset-4 transition-colors hover:text-[hsl(var(--menu-brand-dark))] hover:no-underline",
                  isCartFeedbackActive
                    ? "text-[hsl(var(--menu-ink))] motion-safe:animate-pulse"
                    : "",
                ].join(" ")}
              >
                {viewCartButtonLabel}
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
                const hasRemovableIngredients = Boolean(
                  item.removableIngredients && item.removableIngredients.length > 0
                );
                const hasCustomization = hasExtras || hasRemovableIngredients;
                const isCustomizing = customizingMenuItemId === item.id;

                return (
                  <article key={item.id} className={MENU_CARD_CLASS}>
                    <div className="min-w-0 space-y-2">
                      <h3 className="break-words text-lg font-black tracking-tight text-[hsl(var(--menu-ink))]">
                        {item.name}
                      </h3>
                      {item.description ? (
                        <p className="break-words text-sm text-[hsl(var(--menu-muted))]">
                          {item.description}
                        </p>
                      ) : null}
                      {typeof item.priceCents === "number" ? (
                        <p className={`w-fit ${MENU_PRICE_CHIP_CLASS}`}>
                          {formatCurrency(item.priceCents)}
                        </p>
                      ) : null}
                    </div>

                    <div className={MENU_CARD_ACTION_ROW_CLASS}>
                      <span className="min-w-0 text-sm text-[hsl(var(--menu-muted))]">
                        {quantity > 0 ? `${quantity} no pedido` : "Ainda não selecionado"}
                      </span>
                      <div className={MENU_CARD_ACTION_BUTTONS_ROW_CLASS}>
                        {hasCustomization ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="border-[hsl(var(--menu-border-strong))] bg-transparent text-[hsl(var(--menu-ink))] hover:bg-[hsl(var(--menu-surface-soft))]"
                          onClick={() =>
                            setCustomizingMenuItemId((current) => (current === item.id ? null : item.id))
                            }
                          >
                            Personalizar
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          className={MENU_BRAND_BUTTON_CLASS}
                          onClick={() => handleAddFromMenuCard(item)}
                        >
                          Adicionar
                        </Button>
                      </div>
                    </div>

                    {hasCustomization && isCustomizing ? (
                      <MenuItemExtrasEditor
                        itemName={item.name}
                        extras={item.extras ?? []}
                        selectedExtraIds={draftExtrasByMenuItemId[item.id] ?? []}
                        removableIngredients={item.removableIngredients ?? []}
                        selectedRemovedIngredientIds={draftRemovedIngredientsByMenuItemId[item.id] ?? []}
                        onToggleExtra={(extraId) => toggleDraftExtra(item.id, extraId)}
                        onToggleRemovedIngredient={(ingredientId) =>
                          toggleDraftRemovedIngredient(item.id, ingredientId)
                        }
                        onCancel={() => setCustomizingMenuItemId(null)}
                      />
                    ) : null}
                  </article>
                );
              })}
            </div>
            {visibleMenuItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[hsl(var(--menu-border-soft))] bg-[hsl(var(--menu-surface-soft))] p-3 text-sm text-[hsl(var(--menu-muted))]">
                Nenhum item nesta categoria.
              </p>
            ) : null}
          </section>
        ) : (
          <OrderSummaryTab
            totalItems={totalItems}
            totalPriceCents={totalPriceCents}
            deliveryFeeCents={deliveryFeeCents}
            estimatedTotalPriceCents={estimatedTotalPriceCents}
            selectedEntries={selectedEntries}
            customerName={customerName}
            customerEmail={customerEmail}
            customerPhone={customerPhone}
            fulfillmentType={fulfillmentType}
            customerNotes={customerNotes}
            paymentMethod={paymentMethod}
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
            onFulfillmentTypeChange={setFulfillmentType}
            onCustomerNotesChange={setCustomerNotes}
            onPaymentMethodChange={(value) => {
              setPaymentMethod(value);
              clearFieldError("paymentMethod");
            }}
            onStartEditLineCustomization={startEditingLineCustomization}
            editingLineId={editingLineId}
            editingLineExtraIds={editingLineExtraIds}
            editingLineRemovedIngredientIds={editingLineRemovedIngredientIds}
            onToggleEditingLineExtraId={toggleEditingLineExtraId}
            onToggleEditingLineRemovedIngredient={toggleEditingLineRemovedIngredient}
            onSaveEditingLineCustomization={saveEditedLineCustomization}
            onCancelEditingLineCustomization={() => {
              setEditingLineId(null);
              setEditingLineExtraIds([]);
              setEditingLineRemovedIngredientIds([]);
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

function tabTriggerClass(isActive: boolean, isHighlighted = false): string {
  return [
    "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    isHighlighted
      ? "ring-2 ring-[hsl(var(--menu-brand))] ring-offset-1 motion-safe:animate-pulse"
      : "",
    isActive
      ? "border-[hsl(var(--menu-brand-dark))] bg-[hsl(var(--menu-brand))] text-[hsl(var(--menu-brand-foreground))]"
      : "border-[hsl(var(--menu-border-soft))] bg-[hsl(var(--menu-surface-soft))] text-[hsl(var(--menu-ink))] hover:border-[hsl(var(--menu-border-strong))] hover:bg-[hsl(var(--menu-surface))]",
  ].join(" ");
}

function formatItemCountLabel(totalItems: number): string {
  const normalizedCount = Math.max(0, Math.trunc(totalItems));
  return normalizedCount === 1 ? "1 item" : `${normalizedCount} itens`;
}

type OrderSummaryTabProps = {
  totalItems: number;
  totalPriceCents: number;
  deliveryFeeCents: number;
  estimatedTotalPriceCents: number;
  selectedEntries: SelectedEntry[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  paymentMethod: PaymentMethod | "";
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
  onFulfillmentTypeChange: (value: FulfillmentType) => void;
  onCustomerNotesChange: (value: string) => void;
  onPaymentMethodChange: (value: PaymentMethod) => void;
  onStartEditLineCustomization: (lineId: string) => void;
  editingLineId: string | null;
  editingLineExtraIds: string[];
  editingLineRemovedIngredientIds: string[];
  onToggleEditingLineExtraId: (extraId: string) => void;
  onToggleEditingLineRemovedIngredient: (ingredientId: string) => void;
  onSaveEditingLineCustomization: () => void;
  onCancelEditingLineCustomization: () => void;
  onBackToMenu: () => void;
};

function OrderSummaryTab({
  totalItems,
  totalPriceCents,
  deliveryFeeCents,
  estimatedTotalPriceCents,
  selectedEntries,
  customerName,
  customerEmail,
  customerPhone,
  fulfillmentType,
  paymentMethod,
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
  onFulfillmentTypeChange,
  onCustomerNotesChange,
  onPaymentMethodChange,
  onStartEditLineCustomization,
  editingLineId,
  editingLineExtraIds,
  editingLineRemovedIngredientIds,
  onToggleEditingLineExtraId,
  onToggleEditingLineRemovedIngredient,
  onSaveEditingLineCustomization,
  onCancelEditingLineCustomization,
  onBackToMenu,
}: OrderSummaryTabProps) {
  const cartCountLabel = formatItemCountLabel(totalItems);

  return (
    <section aria-labelledby="checkout-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="checkout-heading" className="text-xl font-black tracking-tight text-[hsl(var(--menu-ink))]">
          Carrinho
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[hsl(var(--menu-muted))]">{cartCountLabel}</span>
          <button
            type="button"
            onClick={onBackToMenu}
            className="text-sm font-semibold text-[hsl(var(--menu-brand))] underline underline-offset-4 hover:text-[hsl(var(--menu-brand-dark))] hover:no-underline"
          >
            Voltar ao cardápio
          </button>
        </div>
      </div>

      {selectedEntries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[hsl(var(--menu-border-soft))] bg-[hsl(var(--menu-surface-soft))] p-3 text-sm text-[hsl(var(--menu-muted))]">
          Nenhum item selecionado ainda.
        </p>
      ) : (
        <ul className="space-y-3">
          {selectedEntries.map(({ lineId, item, quantity, selectedExtras, selectedRemovedIngredients }) => (
            <li
              key={lineId}
              className="rounded-xl border border-[hsl(var(--menu-border-soft))] bg-[hsl(var(--menu-surface-soft))] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[hsl(var(--menu-ink))]">{item.name}</p>
                  {typeof item.priceCents === "number" ? (
                    <p className="text-xs text-[hsl(var(--menu-muted))]">
                      {formatCurrency(item.priceCents)} cada
                    </p>
                  ) : null}
                  {selectedExtras.length > 0 ? (
                    <p className="mt-1 text-xs text-[hsl(var(--menu-muted))]">
                      <span className="font-medium">Extras:</span>{" "}
                      {selectedExtras.map((extra) => extra.name).join(", ")}
                    </p>
                  ) : null}
                  {selectedRemovedIngredients.length > 0 ? (
                    <p className="mt-1 text-xs text-[hsl(var(--menu-muted))]">
                      <span className="font-medium">Sem:</span>{" "}
                      {selectedRemovedIngredients.map((ingredient) => ingredient.name).join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={MENU_OUTLINE_BUTTON_CLASS}
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
                    className={MENU_OUTLINE_BUTTON_CLASS}
                    aria-label={`Aumentar quantidade de ${item.name}`}
                    onClick={() => onChangeQuantity(lineId, quantity + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>

              {(item.extras && item.extras.length > 0) ||
              (item.removableIngredients && item.removableIngredients.length > 0) ? (
                <div className="mt-3 border-t pt-3">
                  {editingLineId === lineId ? (
                    <MenuItemExtrasEditor
                      itemName={item.name}
                      extras={item.extras ?? []}
                      selectedExtraIds={editingLineExtraIds}
                      removableIngredients={item.removableIngredients ?? []}
                      selectedRemovedIngredientIds={editingLineRemovedIngredientIds}
                      onToggleExtra={onToggleEditingLineExtraId}
                      onToggleRemovedIngredient={onToggleEditingLineRemovedIngredient}
                      onCancel={onCancelEditingLineCustomization}
                      onConfirm={onSaveEditingLineCustomization}
                      confirmLabel="Salvar"
                    />
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={MENU_OUTLINE_BUTTON_CLASS}
                      onClick={() => onStartEditLineCustomization(lineId)}
                    >
                      Editar
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
            className="border-[hsl(var(--menu-border-soft))] bg-[hsl(var(--menu-surface))]"
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
          <label htmlFor="customer-email" className="text-sm font-medium">E-mail (opcional)</label>
          <Input
            id="customer-email"
            type="email"
            inputMode="email"
            placeholder="voce@exemplo.com"
            value={customerEmail}
            onChange={(event) => onCustomerEmailChange(event.target.value)}
            className="border-[hsl(var(--menu-border-soft))] bg-[hsl(var(--menu-surface))]"
            disabled={isPending}
            aria-invalid={Boolean(fieldErrors.customerEmail)}
            aria-describedby={fieldErrors.customerEmail ? "customer-email-error" : undefined}
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
            onChange={(event) => onCustomerPhoneChange(formatBrazilPhoneMask(event.target.value))}
            className="border-[hsl(var(--menu-border-soft))] bg-[hsl(var(--menu-surface))]"
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
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Tipo de entrega</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {FULFILLMENT_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 rounded-md border border-[hsl(var(--menu-border-soft))] bg-[hsl(var(--menu-surface-soft))] px-3 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name="fulfillment-type"
                    value={option.value}
                    checked={fulfillmentType === option.value}
                    onChange={() => onFulfillmentTypeChange(option.value)}
                    className={MENU_RADIO_ACCENT_CLASS}
                    disabled={isPending}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="space-y-2">
          <fieldset
            className="space-y-2"
            aria-invalid={Boolean(fieldErrors.paymentMethod)}
            aria-describedby={fieldErrors.paymentMethod ? "payment-method-error" : undefined}
          >
            <legend className="text-sm font-medium">Modo de pagamento</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 rounded-md border border-[hsl(var(--menu-border-soft))] bg-[hsl(var(--menu-surface-soft))] px-3 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name="payment-method"
                    value={option.value}
                    checked={paymentMethod === option.value}
                    onChange={() => onPaymentMethodChange(option.value)}
                    className={MENU_RADIO_ACCENT_CLASS}
                    disabled={isPending}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            {fieldErrors.paymentMethod ? (
              <p id="payment-method-error" className="text-xs text-rose-700">
                {fieldErrors.paymentMethod}
              </p>
            ) : null}
          </fieldset>
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
            className="flex w-full rounded-md border border-[hsl(var(--menu-border-soft))] bg-[hsl(var(--menu-surface))] px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {selectedEntries.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-[hsl(var(--menu-muted))]">
              Subtotal dos itens: <span className="font-semibold text-[hsl(var(--menu-ink))]">{formatCurrency(totalPriceCents)}</span>
            </p>
            {fulfillmentType === "entrega" ? (
              <p className="text-sm text-[hsl(var(--menu-muted))]">
                Taxa de entrega: <span className="font-semibold text-[hsl(var(--menu-ink))]">{formatCurrency(deliveryFeeCents)}</span>
              </p>
            ) : null}
            <p className="text-sm font-semibold text-[hsl(var(--menu-ink))]">
              Total estimado:{" "}
              <span className={MENU_PRICE_CHIP_CLASS}>
                {formatCurrency(estimatedTotalPriceCents)}
              </span>
            </p>
          </div>
        ) : null}

        {feedback ? (
          <p
            role="status"
            className={
              feedback.type === "success"
                ? "rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
                : feedback.type === "info"
                  ? "rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900"
                : "rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900"
            }
          >
            {feedback.message}
          </p>
        ) : null}

        <Button
          type="submit"
          className={`w-full ${MENU_BRAND_BUTTON_CLASS}`}
          disabled={!canSubmit}
        >
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
  removableIngredients,
  selectedRemovedIngredientIds,
  onToggleExtra,
  onToggleRemovedIngredient,
  onCancel,
  onConfirm,
  confirmLabel,
}: {
  itemName: string;
  extras: MenuExtra[];
  selectedExtraIds: string[];
  removableIngredients: MenuRemovableIngredient[];
  selectedRemovedIngredientIds: string[];
  onToggleExtra: (extraId: string) => void;
  onToggleRemovedIngredient: (ingredientId: string) => void;
  onCancel: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
}) {
  const hasExtras = extras.length > 0;
  const hasRemovableIngredients = removableIngredients.length > 0;

  return (
    <div className={MENU_EXTRAS_EDITOR_CLASS}>
      <p className="text-sm font-medium">Extras para {itemName}</p>
      {hasExtras ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Adicionar extras</p>
          {extras.map((extra) => {
            const checked = selectedExtraIds.includes(extra.id);
            return (
              <label key={extra.id} className={MENU_EXTRAS_EDITOR_OPTION_ROW_CLASS}>
                <input type="checkbox" checked={checked} onChange={() => onToggleExtra(extra.id)} />
                <span className="break-words">{extra.name}</span>
                {typeof extra.priceCents === "number" ? (
                  <span className="text-xs text-muted-foreground">(+{formatCurrency(extra.priceCents)})</span>
                ) : null}
              </label>
            );
          })}
        </div>
      ) : null}
      {hasRemovableIngredients ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Remover ingredientes</p>
          {removableIngredients.map((ingredient) => {
            const checked = selectedRemovedIngredientIds.includes(ingredient.id);
            return (
              <label key={ingredient.id} className={MENU_EXTRAS_EDITOR_OPTION_ROW_CLASS}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleRemovedIngredient(ingredient.id)}
                />
                <span className="break-words">Sem {ingredient.name}</span>
              </label>
            );
          })}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={MENU_OUTLINE_BUTTON_CLASS}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        {onConfirm ? (
          <Button
            type="button"
            size="sm"
            className={MENU_BRAND_BUTTON_CLASS}
            onClick={onConfirm}
          >
            {confirmLabel ?? "Salvar"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function successFeedback(message: string): FeedbackState {
  return { type: "success", message };
}

function infoFeedback(message: string): FeedbackState {
  return { type: "info", message };
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
  fulfillmentType: FulfillmentType;
  paymentMethod: PaymentMethod;
  turnstileToken?: string;
  notes?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    extraIds?: string[];
    removedIngredientIds?: string[];
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

function normalizeIdSet(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

function isBasicEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function lineMergeKey(
  menuItemId: string,
  extraIds: string[],
  removedIngredientIds: string[]
) {
  return JSON.stringify([menuItemId, normalizeIdSet(extraIds), normalizeIdSet(removedIngredientIds)]);
}

function lineMatchesMergeKey(line: SelectedOrderLine, key: string): boolean {
  return lineMergeKey(line.menuItemId, line.extraIds, line.removedIngredientIds) === key;
}

function addOrMergeOrderLine(
  current: SelectedOrderLine[],
  menuItemId: string,
  quantity: number,
  extraIds: string[],
  removedIngredientIds: string[]
) {
  const normalizedExtraIds = normalizeIdSet(extraIds);
  const normalizedRemovedIngredientIds = normalizeIdSet(removedIngredientIds);
  const key = lineMergeKey(menuItemId, normalizedExtraIds, normalizedRemovedIngredientIds);
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
      removedIngredientIds: normalizedRemovedIngredientIds,
    },
  ];
}

function updateOrderLineCustomization(
  current: SelectedOrderLine[],
  lineId: string,
  nextExtraIds: string[],
  nextRemovedIngredientIds: string[]
) {
  const target = current.find((line) => line.lineId === lineId);
  if (!target) return current;

  const normalizedExtraIds = normalizeIdSet(nextExtraIds);
  const normalizedRemovedIngredientIds = normalizeIdSet(nextRemovedIngredientIds);
  const targetKey = lineMergeKey(
    target.menuItemId,
    normalizedExtraIds,
    normalizedRemovedIngredientIds
  );
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
    line.lineId === lineId
      ? {
          ...line,
          extraIds: normalizedExtraIds,
          removedIngredientIds: normalizedRemovedIngredientIds,
        }
      : line
  );
}

function createOrderLineId() {
  return `line-${Math.random().toString(36).slice(2, 10)}`;
}
