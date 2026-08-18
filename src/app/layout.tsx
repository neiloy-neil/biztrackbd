import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { OfflineSyncProvider } from "@/components/providers/OfflineSyncProvider";
import { Toaster } from "@/components/ui/sonner";
import { MobileNav } from "@/components/layout/MobileNav";
import { TopHeader } from "@/components/layout/TopHeader";
import { OfflineIndicator } from "@/components/layout/OfflineIndicator";
import { VoiceAccountingFab } from "@/domains/ai/components/VoiceAccountingFab";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://biztrackbd.com"),
  title: {
    default: "BizTrack BD | Know your business in 10 seconds",
    template: "%s | BizTrack BD",
  },
  description: "The fastest POS, inventory, and accounting software for small businesses in Bangladesh. Works offline.",
  openGraph: {
    title: "BizTrack BD | Know your business in 10 seconds",
    description: "The fastest POS, inventory, and accounting software for small businesses in Bangladesh. Works offline.",
    url: "https://biztrackbd.com",
    siteName: "BizTrack BD",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "BizTrack BD Dashboard Preview",
      },
    ],
    locale: "bn_BD",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BizTrack BD",
    description: "Know your business in 10 seconds",
    images: ["/og-image.jpg"],
  },
  alternates: {
    canonical: "https://biztrackbd.com",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <QueryProvider>
          <OfflineSyncProvider>
            {/* Top Navigation */}
            <TopHeader />
            
            {/* Main Content Area */}
            <main className="flex-1 w-full bg-slate-50 md:pl-20 pb-16 md:pb-0 overflow-y-auto mt-14 md:mt-0">
              {children}
            </main>
            
            {/* Bottom Navigation for Mobile / Side for Desktop */}
            <MobileNav />

            {/* Offline Status Indicator */}
            <OfflineIndicator />

            {/* AI Voice FAB */}
            <VoiceAccountingFab />
            
            {/* Notifications */}
            <Toaster position="top-center" richColors />
          </OfflineSyncProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
