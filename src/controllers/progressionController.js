const LiveLocation = require("../models/LiveLocation");
const Trip = require("../models/Trip");
const Route = require("../models/Route");
const { redis } = require("../config/redis");
const logger = require("../utils/logger");

/**
 * Get the next stop for a specific trip
 */
exports.getNextStop = async (req, res) => {
    try {
        const { tripId } = req.params;

        // 1. Try to get live progression data from Redis/LiveLocation
        const liveLoc = await LiveLocation.findOne({ tripId }).populate("tripId").lean();

        if (!liveLoc) {
            return res.status(404).json({
                success: false,
                message: "No active tracking found for this trip"
            });
        }

        // 2. Fetch the route stops
        const route = await Route.findById(liveLoc.tripId.routeId).lean();
        if (!route) {
            return res.status(404).json({ success: false, message: "Route not found" });
        }

        const nextStopIndex = liveLoc.nextStopIndex || 0;
        const nextStop = route.stops[nextStopIndex] || null;

        return res.status(200).json({
            success: true,
            data: {
                nextStop,
                nextStopIndex,
                eta: liveLoc.eta,
                totalStops: route.stops.length,
                remainingStopsCount: route.stops.length - nextStopIndex,
                isFinalStop: nextStopIndex === route.stops.length - 1
            }
        });

    } catch (err) {
        logger.error(`[PROGRESSION CONTROLLER] Error in getNextStop: ${err.message}`);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Get all remaining stops for a trip
 */
exports.getRemainingStops = async (req, res) => {
    try {
        const { tripId } = req.params;

        const liveLoc = await LiveLocation.findOne({ tripId }).populate("tripId").lean();
        if (!liveLoc) {
            return res.status(404).json({ success: false, message: "Trip not active" });
        }

        const route = await Route.findById(liveLoc.tripId.routeId).lean();
        const nextStopIndex = liveLoc.nextStopIndex || 0;

        const remainingStops = route.stops.slice(nextStopIndex);

        return res.status(200).json({
            success: true,
            data: {
                remainingStops,
                nextStopIndex,
                totalStops: route.stops.length
            }
        });
    } catch (err) {
        logger.error(`[PROGRESSION CONTROLLER] Error in getRemainingStops: ${err.message}`);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
