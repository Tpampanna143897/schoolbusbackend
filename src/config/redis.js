const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL);

redis.on("connect", () => {
    console.log("🔥 Redis Cloud Connected");
});

redis.on("error", (err) => {
    console.log("❌ Redis Error:", err.message);
});

const cacheTTL = {
    GPS_CACHE: 300,        // 5 mins
    TRIP_CACHE: 14400,    // 4 hours (entire school shift)
    STOP_STATE: 14400,    // 4 hours
};

module.exports = { redis, cacheTTL };
