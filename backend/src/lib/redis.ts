import "dotenv/config";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on("connect", () => {
  console.log("Redis terhubung");
});

redis.on("error", (error) => {
  console.error("Redis error:", error.message);
});

export default redis;
