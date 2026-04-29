import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { UpdateBanner } from "@/components/update/UpdateBanner";

import "./globals.css";

export const metadata: Metadata = {
  title: "VibeGear2",
  description: "Open source spiritual successor to Top Gear 2",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UpdateBanner />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
