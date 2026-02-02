import type { NextConfig } from "next";
import path from "path";
import { loadEnvConfig } from "@next/env";

const projectDir = process.cwd();
// loadEnvConfig(path.join(projectDir, '../')); // Removed to avoid path issues in Docker

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
};

console.log("🏗️ Next.js Startup Config Loaded");
console.log("  - NODE_ENV:", process.env.NODE_ENV);
console.log("  - NEXT_PUBLIC_API_URL:", process.env.NEXT_PUBLIC_API_URL);

export default nextConfig;
