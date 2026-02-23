import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold text-foreground">
        Área do funcionário
      </h1>
      <p className="text-muted-foreground text-center max-w-md">
        Em breve você poderá ver os pedidos e atualizar o status aqui.
      </p>
      <Link
        href="/"
        className="text-primary underline underline-offset-4 hover:no-underline"
      >
        Voltar ao cardápio
      </Link>
    </main>
  );
}
