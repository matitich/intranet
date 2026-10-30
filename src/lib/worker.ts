import "dotenv/config";
import { Queue, Worker } from "bullmq";
import nodemailer from "nodemailer";
import { z } from "zod";
import { env } from "./env";
import { reminders } from "../modules/notificaciones/reminders";
import { db } from "./db";
const config = env();
const transport = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_SECURE === "true",
  auth: config.SMTP_USER
    ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
    : undefined,
});
const mail = z.object({
  to: z.string().email(),
  subject: z.string().max(200),
  text: z.string().max(20000),
});
const worker = new Worker(
  "mail",
  async (job) => {
    const message = mail.parse(job.data);
    await transport.sendMail({ ...message, from: config.SMTP_FROM });
  },
  {
    connection: {
      host: new URL(config.REDIS_URL).hostname,
      port: Number(new URL(config.REDIS_URL).port || 6379),
      password: new URL(config.REDIS_URL).password || undefined,
    },
    concurrency: 2,
  },
);
worker.on("failed", () =>
  console.error(JSON.stringify({ level: "error", event: "mail_job_failed" })),
);
console.log(JSON.stringify({ level: "info", event: "mail_worker_started" }));

const jobConnection = {
  host: new URL(config.REDIS_URL).hostname,
  port: Number(new URL(config.REDIS_URL).port || 6379),
  password: new URL(config.REDIS_URL).password || undefined,
};
const reminderQueue = new Queue("reminders", { connection: jobConnection });
const reminderWorker = new Worker("reminders", async () => reminders(), {
  connection: jobConnection,
  concurrency: 1,
});
reminderWorker.on("failed", () =>
  console.error(
    JSON.stringify({ level: "error", event: "reminder_job_failed" }),
  ),
);
void reminderQueue.upsertJobScheduler(
  "institutional-reminders",
  { every: 60000 },
  {
    name: "check",
    data: {},
    opts: { removeOnComplete: true, removeOnFail: { age: 86400 } },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await Promise.all([worker.close(), reminderWorker.close()]);
    await reminderQueue.close();
    await db.$disconnect();
    process.exit(0);
  });
