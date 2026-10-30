import IORedis from "ioredis";
import { env } from "./env";
const globalRedis = globalThis as unknown as { redis?: IORedis };
export function redis() {
  return (
    globalRedis.redis ??
    (globalRedis.redis = new IORedis(env().REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    }))
  );
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const result = await redis().eval(
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n",
    1,
    `limit:${key}`,
    seconds,
  );
  if (Number(result) > limit)
    throw new Error("Demasiados intentos. Intente más tarde.");
}
