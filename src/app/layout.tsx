import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import ReactQueryProvider from "@/components/providers/react-query-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Sika Creative OS",
    description: "A minimalist workspace",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <ClerkProvider>
            <html lang="en" className="dark">
                <body className={`${jakarta.className} bg-[#0e0e10] text-gray-100 antialiased min-h-screen`}>
                    <ReactQueryProvider>
                        <main className="min-h-screen bg-[#0e0e10] pb-24">
                            {children}
                        </main>
                        <Toaster position="top-center" />
                    </ReactQueryProvider>
                </body>
            </html>
        </ClerkProvider>
    );
}
