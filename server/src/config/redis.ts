import Redis from "ioredis";
import { env } from "./env";

// Main Redis connection for general operations
export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null, // Required for BullMQ
});

// Separate connection for Pub/Sub subscriber (required because subscriber blocks)
export const redisSubscriber = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
});

// Separate connection for Pub/Sub publisher
export const redisPublisher = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
});

redis.on("connect", () => {
  console.log("✅ Redis connected");
});

redis.on("error", (err) => {
  console.error("❌ Redis connection error:", err);
});
