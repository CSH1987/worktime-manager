import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ViewProvider } from "./components/ViewProvider";
import { ConfirmProvider } from "./components/ConfirmDialog";
import Header from "./components/Header";
import StatusBanner from "./components/StatusBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "근태·잔업 통합 관리",
  description: "SAMSUNG 근태·잔업 통합 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full overflow-x-hidden">
        <ViewProvider>
          <ConfirmProvider>
            <Header />
            <StatusBanner />
            {children}
          </ConfirmProvider>
        </ViewProvider>
      </body>
    </html>
  );
}
