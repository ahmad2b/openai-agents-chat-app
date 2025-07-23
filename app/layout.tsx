import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agent Chat - AI Streaming Assistant",
  description: "Real-time streaming chat interface with AI agents featuring tool execution and advanced capabilities.",
  keywords: "AI, chat, streaming, agents, assistant",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(
        inter.className,
        "antialiased min-h-screen bg-background text-foreground",
        "overflow-hidden" // Prevent body scroll since we handle it in components
      )}>
        {children}
      </body>
    </html>
  );
}
