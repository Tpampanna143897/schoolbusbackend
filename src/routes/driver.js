const router = require("express").Router();
const Trip = require("../models/Trip");
const Bus = require("../models/Bus");
const Route = require("../models/Route");
const trackingService = require("../services/tracking/trackingService");
const response = require("../utils/response");
const logger = require("../utils/logger");

// START TRIP
router.post("/start-trip", async (req, res, next) => {
    try {
        const { busId } = req.body;
        const driverId = req.user.id;

        const bus = await Bus.findById(busId);
        if (!bus) return response(res, false, "Bus not found", {}, 404);

        // 1. Fetch Route and its Stops
        const route = await Route.findById(bus.assignedRoute).populate("stops");
        if (!route) return response(res, false, "No route assigned to this bus", {}, 400);

        // 2. Create Trip Entry
        const trip = await Trip.create({
            busId,
            driverId,
            routeId: route._id,
            status: "STARTED",
            startTime: new Date()
        });

        // 3. Cache Stops in Redis for fast Geofencing
        await trackingService.cacheRouteStops(trip._id, route.stops);

        logger.info(`[TRIP] Started: ${trip._id} for Bus: ${busId}`);
        return response(res, true, "Trip started successfully", { tripId: trip._id });

    } catch (err) {
        next(err);
    }
});

// END TRIP
router.post("/end-trip", async (req, res, next) => {
    try {
        const { tripId } = req.body;

        const trip = await Trip.findByIdAndUpdate(tripId, {
            status: "COMPLETED",
            endTime: new Date()
        });

        if (!trip) return response(res, false, "Trip not found", {}, 404);

        // Clear Redis Cache
        await trackingService.clearTripCache(tripId);

        logger.info(`[TRIP] Ended: ${tripId}`);
        return response(res, true, "Trip ended successfully");

    } catch (err) {
        next(err);
    }
});

module.exports = router;
