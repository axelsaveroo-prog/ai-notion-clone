import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Mengabaikan error tipe saat build produksi di Vercel
    ignoreBuildErrors: true,
  },
};

export default nextConfig;