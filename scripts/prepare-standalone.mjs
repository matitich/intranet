import { cpSync, existsSync } from "node:fs";
if (!existsSync(".next/standalone/server.js"))
  throw new Error("Falta la compilación standalone.");
cpSync("public", ".next/standalone/public", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
