const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL);

redis.on("connect", () => {
    console.log("🔥 Redis Cloud Connected");
});

redis.on("error", (err) => {
    console.log("❌ Redis Error:", err.message);
});

module.exports = redis;
