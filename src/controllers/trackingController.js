const mongoose = require("mongoose");
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

        // 1. Validate tripId format to prevent CastError (500)
        if (!mongoose.Types.ObjectId.isValid(tripId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Trip ID format"
            });
        }

        // 2. Redis Cache Check with safe error handling
        let cachedData = null;
        try {
            const redisKey = `trip:${tripId}:live`;
            cachedData = await redis.get(redisKey);
        } catch (redisErr) {
            logger.error(`[TRACKING CONTROLLER] Redis Error: ${redisErr.message}`);
            // Fallback to DB if Redis fails
        }

        if (cachedData) {
            try {
                const data = JSON.parse(cachedData);
                return res.status(200).json({
                    success: true,
                    data: {
                        ...data,
                        source: "cache",
                        status: "online"
                    }
                });
            } catch (jsonErr) {
                logger.error(`[TRACKING CONTROLLER] JSON Parse Error: ${jsonErr.message}`);
                // Fallback to DB if JSON is malformed
            }
        }

        // 3. Operational DB Check
        const liveLoc = await LiveLocation.findOne({ tripId }).lean();
        if (liveLoc) {
            return res.status(200).json({
                success: true,
                data: {
                    tripId: liveLoc.tripId,
                    busId: liveLoc.busId,
                    lat: liveLoc.coordinates?.lat || 0,
                    lng: liveLoc.coordinates?.lng || 0,
                    speed: liveLoc.speed || 0,
                    heading: liveLoc.heading || 0,
                    timestamp: liveLoc.lastUpdate,
                    status: liveLoc.status === "ONLINE" ? "online" : "offline",
                    source: "live_db"
                }
            });
        }

        // 4. Historical Fallback
        const [lastHist, trip] = await Promise.all([
            Tracking.findOne({ tripId }).sort({ timestamp: -1 }).lean(),
            Trip.findById(tripId).select("status").lean()
        ]);

        if (!lastHist) {
            return res.status(200).json({
                success: true,
                data: {
                    status: trip?.status === "STARTED" ? "waiting" : "offline",
                    message: trip?.status === "STARTED" ? "Trip active, waiting for GPS..." : "No location data found"
                }
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                ...lastHist,
                status: trip?.status === "STARTED" ? "online" : "offline",
                source: "history"
            }
        });

    } catch (err) {
        logger.error(`[TRACKING CONTROLLER] Fatal Error: ${err.name} - ${err.message} \nStack: ${err.stack}`);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching tracking data"
        });
    }
};
