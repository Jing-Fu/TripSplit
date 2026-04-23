import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "旅行記帳 ✈️ TripSplit",
  description: "輕鬆記錄旅遊花費，多人分帳一目瞭然",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
