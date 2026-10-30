import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
function client() {
  return (
    globalDb.prisma ??
    (globalDb.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      log: ["error"],
    }))
  );
}
// Laziness also permits rejecting malformed/cross-origin requests before opening a DB connection.
export const db = new Proxy({} as PrismaClient, {
  get(_target, key) {
    const instance = client();
    const value = Reflect.get(instance, key, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
