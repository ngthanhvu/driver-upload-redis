import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redisClient = createClient({ url: redisUrl });

redisClient.on("error", (error) => {
    console.error("Redis error:", error);
});

redisClient.on("connect", () => {
    console.log("Redis connected");
});

let isConnecting = false;

const connectRedis = async () => {
    if (redisClient.isOpen || isConnecting) return;
    isConnecting = true;
    try {
        await redisClient.connect();
    } finally {
        isConnecting = false;
    }
};

export { redisClient };
export default connectRedis;
