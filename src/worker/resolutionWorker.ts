import { Queue, Worker } from "bullmq";
import { runResolutionSweep } from "@/lib/resolutionEngine";

const connection = {
  host: process.env.UPSTASH_REDIS_HOST,
  port: Number(process.env.UPSTASH_REDIS_PORT ?? 6379),
  password: process.env.UPSTASH_REDIS_PASSWORD
};

export const resolutionQueue = new Queue("resolution", { connection });

export async function scheduleResolutionSweep() {
  await resolutionQueue.add("resolve-open-questions", {}, { repeat: { every: 15 * 60 * 1000 } });
}

new Worker(
  "resolution",
  async () => {
    await runResolutionSweep();
  },
  { connection }
);

scheduleResolutionSweep().catch(console.error);
