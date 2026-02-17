const Trip = require("../models/Trip");
const LiveLocation = require("../models/LiveLocation");
const Tracking = require("../models/Tracking");
const { redis } = require("../config/redis");
const logger = require("../utils/logger");

/**
 * Get live location for a specific trip
 */
exports.getLiveLocation = async (req, res) => {
    try {
        const { tripId } = req.params;

        // 1. Redis Cache Check
        const redisKey = `trip:${tripId}:live`;
        const cachedData = await redis.get(redisKey);

        if (cachedData) {
            const data = JSON.parse(cachedData);
            return res.status(200).json({
                success: true,
                data: {
                    ...data,
                    source: "cache",
                    status: "online"
                }
            });
        }

        // 2. Operational DB Check
        const liveLoc = await LiveLocation.findOne({ tripId }).lean();
        if (liveLoc) {
            return res.status(200).json({
                success: true,
                data: {
                    tripId: liveLoc.tripId,
                    busId: liveLoc.busId,
                    lat: liveLoc.coordinates.lat,
                    lng: liveLoc.coordinates.lng,
                    speed: liveLoc.speed,
                    heading: liveLoc.heading,
                    timestamp: liveLoc.lastUpdate,
                    status: liveLoc.status === "ONLINE" ? "online" : "offline",
                    source: "live_db"
                }
            });
        }

        // 3. Historical Fallback
        const lastHist = await Tracking.findOne({ tripId }).sort({ timestamp: -1 }).lean();
        const trip = await Trip.findById(tripId).select("status").lean();

        if (!lastHist) {
            return res.status(200).json({
                success: true,
                data: {
                    status: trip?.status === "STARTED" ? "waiting" : "offline",
                    message: trip?.status === "STARTED" ? "Trip active, waiting for GPS..." : "No location data"
                }
            });
        }

        res.status(200).json({
            success: true,
            data: {
                ...lastHist,
                status: trip?.status === "STARTED" ? "online" : "offline",
                source: "history"
            }
        });

    } catch (err) {
        logger.error(`[TRACKING CONTROLLER] Error: ${err.message}`);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
