import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable PWA saat dev agar tidak bentrok dengan Turbopack di mode dev
  disable: process.env.NODE_ENV === "development", 
});

const nextConfig: NextConfig = {
  // HAPUS block 'eslint' di sini karena sudah tidak didukung di Next.js 16
  // config lainnya (kosongkan jika tidak ada)
};

export default withSerwist(nextConfig);