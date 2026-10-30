import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["argon2"],
  experimental: { cpus: 2 },
};
export default config;
