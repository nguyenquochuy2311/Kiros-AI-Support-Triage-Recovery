import type { NextConfig } from "next";
import path from "path";
import { loadEnvConfig } from "@next/env";

const projectDir = process.cwd();
// loadEnvConfig(path.join(projectDir, '../')); // Removed to avoid path issues in Docker

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
};

export default nextConfig;
