import { getMenuItems, parseMenuItemsFromUnknown, type MenuItem } from "@/lib/menu";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const ACTIVE_MENU_LOAD_ERROR_LOG = "[menu/runtime] failed to load active menu from database";

export async function getRuntimeMenuItems(): Promise<MenuItem[]> {
  const supabase = createServiceRoleClient();
  if (!supabase || typeof (supabase as { from?: unknown }).from !== "function") {
    return getMenuItems();
  }

  const { data, error } = await supabase
    .from("menu_versions")
    .select("data")
    .eq("status", "active")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(ACTIVE_MENU_LOAD_ERROR_LOG, {
      message: error.message,
      code: error.code,
    });
    return getMenuItems();
  }

  const menuItems = parseMenuItemsFromUnknown(data?.data);
  if (menuItems.length === 0) {
    return getMenuItems();
  }

  return menuItems;
}

export async function getRuntimeMenuItemMap() {
  const items = await getRuntimeMenuItems();
  return new Map(items.map((item) => [item.id, item]));
}
