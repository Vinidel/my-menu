import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cardápio",
  description: "App de pedidos do burger",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
