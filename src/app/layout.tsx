import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "旅行記帳 ✈️ TripSplit",
  description: "輕鬆記錄旅遊花費，多人分帳一目瞭然",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
