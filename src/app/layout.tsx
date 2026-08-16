import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { OfflineSyncProvider } from "@/components/providers/OfflineSyncProvider";
import { Toaster } from "@/components/ui/sonner";
import { MobileNav } from "@/components/layout/MobileNav";
import { OfflineIndicator } from "@/components/layout/OfflineIndicator";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BizTrack BD",
  description: "Know your business in 10 seconds",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background pb-20">
        <OfflineSyncProvider>
          <QueryProvider>
            {children}
            <OfflineIndicator />
            <MobileNav />
            <Toaster />
          </QueryProvider>
        </OfflineSyncProvider>
      </body>
    </html>
  );
}
