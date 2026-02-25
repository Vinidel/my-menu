import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CustomerOrderPage } from "./customer-order-page";
import type { MenuItem } from "@/lib/menu";

const MENU_ITEMS: MenuItem[] = [
  {
    id: "x-burger",
    name: "X-Burger",
    category: "Hambúrgueres",
    description: "Clássico",
    priceCents: 2500,
  },
  {
    id: "batata",
    name: "Batata frita",
    category: "Acompanhamentos",
    priceCents: 1200,
  },
];

describe("CustomerOrderPage (Customer Order Submission)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("navigates to the order summary tab via the 'X itens' link (brief: quick access to summary)", () => {
    render(<CustomerOrderPage menuItems={MENU_ITEMS} isSupabaseConfigured />);

    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Ver carrinho (1 item)" }));

    expect(screen.getByRole("heading", { level: 2, name: "Carrinho" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar ao cardápio" })).toBeInTheDocument();
  });

  it("highlights the cart entry point after clicking Adicionar (brief: cart feedback reaction)", () => {
    render(<CustomerOrderPage menuItems={MENU_ITEMS} isSupabaseConfigured />);

    const cartTab = screen.getByRole("tab", { name: "Carrinho (0 itens)" });
    expect(cartTab).toHaveAttribute("data-cart-feedback-state", "idle");

    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" })[0]);

    expect(screen.getByRole("tab", { name: "Carrinho (1 item)" })).toHaveAttribute(
      "data-cart-feedback-state",
      "recent-add"
    );
    expect(screen.getByRole("button", { name: "Ver carrinho (1 item)" })).toHaveAttribute(
      "data-cart-feedback-state",
      "recent-add"
    );
    expect(
      screen.getByText("Item adicionado ao carrinho. Ver carrinho (1 item).")
    ).toBeInTheDocument();
  });

  it("keeps the customer on Cardápio after adding an item (brief: no forced navigation)", () => {
    render(<CustomerOrderPage menuItems={MENU_ITEMS} isSupabaseConfigured />);

    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" })[0]);

    expect(screen.getByRole("heading", { level: 2, name: "Itens do cardápio" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Carrinho" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Carrinho (1 item)" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("re-triggers cart feedback when adding items in sequence (brief: repeatable feedback)", () => {
    vi.useFakeTimers();
    try {
      render(<CustomerOrderPage menuItems={MENU_ITEMS} isSupabaseConfigured />);

      fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" })[0]);
      expect(screen.getByRole("tab", { name: "Carrinho (1 item)" })).toHaveAttribute(
        "data-cart-feedback-state",
        "recent-add"
      );

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(screen.getByRole("tab", { name: "Carrinho (1 item)" })).toHaveAttribute(
        "data-cart-feedback-state",
        "idle"
      );

      fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" })[1]);

      expect(screen.getByRole("tab", { name: "Carrinho (2 itens)" })).toHaveAttribute(
        "data-cart-feedback-state",
        "recent-add"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies the same cart feedback when adding a customized item (brief: customized add parity)", () => {
    const menuWithExtras: MenuItem[] = [
      {
        id: "x-burger",
        name: "X-Burger",
        category: "Hambúrgueres",
        priceCents: 2500,
        extras: [
          { id: "bacon-extra", name: "Bacon extra", priceCents: 500 },
          { id: "queijo-extra", name: "Queijo extra", priceCents: 300 },
        ],
      },
    ];

    render(<CustomerOrderPage menuItems={menuWithExtras} isSupabaseConfigured />);

    fireEvent.click(screen.getByRole("button", { name: "Personalizar" }));
    fireEvent.click(screen.getByLabelText(/Bacon extra/));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar com extras" }));

    expect(screen.getByRole("tab", { name: "Carrinho (1 item)" })).toHaveAttribute(
      "data-cart-feedback-state",
      "recent-add"
    );
    expect(screen.getByRole("button", { name: "Ver carrinho (1 item)" })).toHaveAttribute(
      "data-cart-feedback-state",
      "recent-add"
    );
  });

  it("uses mobile-safe wrapping classes in card list rows (brief: mobile overflow bugfix structure)", () => {
    render(<CustomerOrderPage menuItems={MENU_ITEMS} isSupabaseConfigured />);

    const cardTitle = screen.getByRole("heading", { level: 3, name: "X-Burger" });
    const card = cardTitle.closest("article");
    expect(card).toBeTruthy();
    expect(card?.className).toContain("min-w-0");

    const statusText = within(card as HTMLElement).getByText("Ainda não selecionado");
    const actionRow = statusText.parentElement;
    expect(actionRow).toBeTruthy();
    expect(actionRow?.className).toContain("flex-col");
    expect(actionRow?.className).toContain("sm:flex-row");

    const actionButtonsRow = within(card as HTMLElement).getByRole("button", { name: "Adicionar" }).parentElement;
    expect(actionButtonsRow).toBeTruthy();
    expect(actionButtonsRow?.className).toContain("flex-wrap");
  });

  it("uses wrapping/min-width guards in extras editor on mobile (brief: extras editor overflow bugfix structure)", () => {
    const menuWithExtras: MenuItem[] = [
      {
        id: "x-burger",
        name: "X-Burger",
        category: "Hambúrgueres",
        priceCents: 2500,
        extras: [{ id: "bacon-extra", name: "Bacon extra", priceCents: 500 }],
      },
    ];

    render(<CustomerOrderPage menuItems={menuWithExtras} isSupabaseConfigured />);

    fireEvent.click(screen.getByRole("button", { name: "Personalizar" }));

    const editorTitle = screen.getByText("Extras para X-Burger");
    const editorContainer = editorTitle.closest("div");
    expect(editorContainer).toBeTruthy();
    expect(editorContainer?.className).toContain("min-w-0");

    const extraLabel = screen.getByLabelText(/Bacon extra/).closest("label");
    expect(extraLabel).toBeTruthy();
    expect(extraLabel?.className).toContain("min-w-0");
    expect(extraLabel?.className).toContain("flex-wrap");
  });

  it("shows inline required-field messages when submitting without nome/email/telefone (brief: in-field validation)", async () => {
    render(<CustomerOrderPage menuItems={MENU_ITEMS} isSupabaseConfigured />);

    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Ver carrinho (1 item)" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));

    expect(screen.getByText("Informe seu nome.")).toBeInTheDocument();
    expect(screen.getByText("Informe seu e-mail.")).toBeInTheDocument();
    expect(screen.getByText("Informe seu telefone.")).toBeInTheDocument();
    expect(screen.getByText("Selecione uma forma de pagamento.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Preencha nome, e-mail, telefone e selecione a forma de pagamento para continuar."
      )
    ).toBeInTheDocument();
  });

  it("renders payment method radio options in the checkout form (brief: payment method radio group)", () => {
    render(<CustomerOrderPage menuItems={MENU_ITEMS} isSupabaseConfigured />);

    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Ver carrinho (1 item)" }));

    expect(screen.getByText("Modo de pagamento")).toBeInTheDocument();
    expect(screen.getByLabelText("Dinheiro")).toBeInTheDocument();
    expect(screen.getByLabelText("Pix")).toBeInTheDocument();
    expect(screen.getByLabelText("Cartão")).toBeInTheDocument();
  });

  it("blocks submit with zero selected items and shows a validation message (brief: no items selected)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    render(<CustomerOrderPage menuItems={MENU_ITEMS} isSupabaseConfigured />);

    fireEvent.click(screen.getByRole("tab", { name: "Carrinho (0 itens)" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    expect(
      screen.getByText("Selecione pelo menos um item para enviar seu pedido.")
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("removes item from the order when quantity is reduced to zero (brief: quantity boundaries)", () => {
    render(<CustomerOrderPage menuItems={MENU_ITEMS} isSupabaseConfigured />);

    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Ver carrinho (1 item)" }));

    expect(screen.getByText("X-Burger")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Diminuir quantidade de X-Burger" })
    );

    expect(screen.queryByText("X-Burger")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhum item selecionado ainda.")).toBeInTheDocument();
    expect(screen.getByText("0 itens")).toBeInTheDocument();
  });

  it("submits to /api/orders, shows success, and resets the order form (brief: submit success state)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ok: true,
        orderReference: "PED-ABCD1234",
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    render(<CustomerOrderPage menuItems={MENU_ITEMS} isSupabaseConfigured />);

    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Ver carrinho (1 item)" }));

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Telefone"), {
      target: { value: "(11) 99999-9999" },
    });
    fireEvent.click(screen.getByLabelText("Pix"));
    fireEvent.change(screen.getByLabelText("Observações (opcional)"), {
      target: { value: "Sem cebola" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/orders",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Pedido PED-ABCD1234 enviado com sucesso! Entraremos em contato em breve para confirmar seu pedido.")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Nome")).toHaveValue("");
    expect(screen.getByLabelText("E-mail")).toHaveValue("");
    expect(screen.getByLabelText("Telefone")).toHaveValue("");
    expect(screen.getByLabelText("Observações (opcional)")).toHaveValue("");
  });

  it("shows API error message when /api/orders returns non-OK (brief: submit failure)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        ok: false,
        message: "Não foi possível enviar seu pedido agora. Tente novamente em instantes.",
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    render(<CustomerOrderPage menuItems={MENU_ITEMS} isSupabaseConfigured />);

    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Ver carrinho (1 item)" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Telefone"), {
      target: { value: "11999999999" },
    });
    fireEvent.click(screen.getByLabelText("Dinheiro"));

    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível enviar seu pedido agora. Tente novamente em instantes.")
      ).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Nome")).toHaveValue("Ana");
    expect(screen.getByLabelText("E-mail")).toHaveValue("ana@example.com");
    expect(screen.getByLabelText("Telefone")).toHaveValue("11999999999");
    expect(screen.getByText("X-Burger")).toBeInTheDocument();
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("submits customized item extras in the /api/orders payload (brief: extras payload shape)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ok: true,
        orderReference: "PED-EXTRAS1",
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const menuWithExtras: MenuItem[] = [
      {
        id: "x-burger",
        name: "X-Burger",
        category: "Hambúrgueres",
        priceCents: 2500,
        extras: [
          { id: "bacon-extra", name: "Bacon extra", priceCents: 500 },
          { id: "queijo-extra", name: "Queijo extra", priceCents: 300 },
        ],
      },
    ];

    render(<CustomerOrderPage menuItems={menuWithExtras} isSupabaseConfigured />);

    fireEvent.click(screen.getByRole("button", { name: "Personalizar" }));
    fireEvent.click(screen.getByLabelText(/Bacon extra/));
    fireEvent.click(screen.getByLabelText(/Queijo extra/));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar com extras" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver carrinho (1 item)" }));

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Telefone"), {
      target: { value: "11999999999" },
    });
    fireEvent.click(screen.getByLabelText("Cartão"));

    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(requestInit.body)) as {
      paymentMethod: string;
      items: Array<{ menuItemId: string; quantity: number; extraIds?: string[] }>;
    };

    expect(payload.paymentMethod).toBe("cartao");
    expect(payload.items).toEqual([
      {
        menuItemId: "x-burger",
        quantity: 1,
        extraIds: ["bacon-extra", "queijo-extra"],
      },
    ]);
  });

  it("edits extras for an existing line in the order summary (brief: edit/remove extras)", () => {
    const menuWithExtras: MenuItem[] = [
      {
        id: "x-burger",
        name: "X-Burger",
        category: "Hambúrgueres",
        priceCents: 2500,
        extras: [
          { id: "bacon-extra", name: "Bacon extra" },
          { id: "queijo-extra", name: "Queijo extra" },
        ],
      },
    ];

    render(<CustomerOrderPage menuItems={menuWithExtras} isSupabaseConfigured />);

    fireEvent.click(screen.getByRole("button", { name: "Personalizar" }));
    fireEvent.click(screen.getByLabelText(/Bacon extra/));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar com extras" }));

    fireEvent.click(screen.getByRole("button", { name: "Personalizar" }));
    fireEvent.click(screen.getByLabelText(/Queijo extra/));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar com extras" }));

    fireEvent.click(screen.getByRole("button", { name: "Ver carrinho (2 itens)" }));

    expect(screen.getAllByText("X-Burger")).toHaveLength(2);

    const editButtons = screen.getAllByRole("button", { name: "Editar extras" });
    fireEvent.click(editButtons[1]);
    fireEvent.click(screen.getByLabelText(/Bacon extra/));
    fireEvent.click(screen.getByRole("button", { name: "Salvar extras" }));

    expect(screen.getAllByRole("button", { name: "Editar extras" })).toHaveLength(2);
    expect(screen.getByText("2 itens")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "Extras: Bacon extra")
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "Extras: Bacon extra, Queijo extra")
    ).toBeInTheDocument();
  });
});
