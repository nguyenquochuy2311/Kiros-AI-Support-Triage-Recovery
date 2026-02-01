import type { NextConfig } from "next";
import path from "path";
import { loadEnvConfig } from "@next/env";

const projectDir = process.cwd();
loadEnvConfig(path.join(projectDir, '../'));

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
