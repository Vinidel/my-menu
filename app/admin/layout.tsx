import Link from "next/link";
import { AdminLogoutButton } from "@/components/admin-logout-button";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <Link href="/admin" className="text-lg font-semibold text-foreground">
          Área do funcionário
        </Link>
        <div className="flex items-center gap-4">
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
