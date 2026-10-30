import { Queue } from "bullmq";
import { redis } from "./redis";
let queue: Queue | undefined;
export async function sendMail(to: string, subject: string, text: string) {
  queue ??= new Queue("mail", { connection: redis() });
  await queue.add(
    "send",
    { to, subject, text },
    {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: { age: 86400 },
    },
  );
}
