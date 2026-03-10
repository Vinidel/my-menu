import Link from "next/link";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { createRequestClient } from "@/lib/app-clients";
import { canUseMenuImport } from "@/lib/menu-import/access";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authClient = await createRequestClient();
  const {
    data: { user },
  } = authClient ? await authClient.auth.getUser() : { data: { user: null } };
  const canAccessMenuImport = canUseMenuImport(user?.email);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <Link href="/admin" className="text-lg font-semibold text-foreground">
          Área do funcionário
        </Link>
        <div className="flex items-center gap-4">
          {canAccessMenuImport ? (
            <Link
              href="/admin/cardapio"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Importar cardápio
            </Link>
          ) : null}
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cardápio
          </Link>
          <AdminLogoutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
