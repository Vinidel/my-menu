import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold text-foreground">
        Cardápio
      </h1>
      <p className="text-muted-foreground text-center max-w-md">
        Área do cliente. Em breve você poderá escolher itens e fazer seu pedido.
      </p>
      <Link href="/admin">
        <Button>Ir para área do funcionário</Button>
      </Link>
    </main>
  );
}
