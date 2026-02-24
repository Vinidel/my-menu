import rawMenu from "@/data/menu.json";

export type MenuItem = {
  id: string;
  name: string;
  category?: string;
  description?: string;
  priceCents?: number;
};

type JsonMenuRow = Record<string, unknown>;

export function getMenuItems(): MenuItem[] {
  if (!Array.isArray(rawMenu)) return [];

  return rawMenu
    .map(parseMenuItem)
    .filter((item): item is MenuItem => item !== null);
}

export function getMenuItemMap(): Map<string, MenuItem> {
  return new Map(getMenuItems().map((item) => [item.id, item]));
}

function parseMenuItem(value: unknown): MenuItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as JsonMenuRow;

  const id = stringFrom(row.id);
  const name = stringFrom(row.name);

  if (!id || !name) return null;

  const description = stringFrom(row.description) ?? undefined;
  const category = stringFrom(row.category) ?? stringFrom(row.categoria) ?? undefined;
  const priceCents = numberFrom(row.priceCents ?? row.price_cents) ?? undefined;

  return {
    id,
    name,
    ...(category ? { category } : {}),
    ...(description ? { description } : {}),
    ...(typeof priceCents === "number" && priceCents >= 0 ? { priceCents } : {}),
  };
}

function stringFrom(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
