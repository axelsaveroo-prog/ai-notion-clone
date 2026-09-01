import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import ReactQueryProvider from "@/components/providers/react-query-provider";
import { Toaster } from "@/components/ui/sonner";
import { headers } from "next/headers";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

// Dynamic metadata based on the requested domain host
export async function generateMetadata(): Promise<Metadata> {
    const headersList = await headers();
    const host = headersList.get("host") || "";
    const isApp = host.startsWith("app.");

    return {
        title: isApp ? "Sika Creative OS" : "Sika Creative Studio",
        description: isApp ? "A minimalist workspace" : "Official website of Sika Creative Group",
        icons: {
            icon: isApp ? "/favicon web sika-02.png" : "/favicon web sika-01.png",
        },
    };
}

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
