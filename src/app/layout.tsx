import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Header from "@/components/header";
import ReactQueryProvider from "@/components/providers/react-query-provider";
import { Toaster } from "@/components/ui/sonner";
import { BottomNav } from "@/components/BottomNav";

import "./globals.css";

export const metadata: Metadata = {
    title: "Notion OS",
    description: "A Notion clone with AI capabilities",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <ClerkProvider>
            <html lang="en" className="dark">
                <link
                    rel="icon"
                    href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>"
                />

                <body className="bg-[#0b0b0c] text-gray-100 antialiased min-h-screen">
          <ReactQueryProvider>
              <Header />
              
              <main className="min-h-[calc(100vh-60px)] bg-[#0b0b0c]">
                  {children}
              </main>

              <BottomNav />

              <Toaster position="top-center" />
          </ReactQueryProvider>
      </body>
                <body className="bg-[#0b0b0c] text-gray-100 antialiased min-h-screen">
                    <ReactQueryProvider>
                        <Header />
                        
                        {/* Clean full-width dark workspace container */}
                        <main className="min-h-[calc(100vh-60px)] bg-[#0b0b0c]">
                            {children}
                        </main>

                        <Toaster position="top-center" />
                    </ReactQueryProvider>
                </body>
            </html>
        </ClerkProvider>
    );
}
