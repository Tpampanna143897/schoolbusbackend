const router = require("express").Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const Trip = require("../models/Trip");
const Bus = require("../models/Bus");
const Route = require("../models/Route");
const trackingService = require("../services/tracking/trackingService");
const response = require("../utils/response");
const logger = require("../utils/logger");

/**
 * @route GET /api/driver/buses
 * @desc Get buses assigned to the current driver
 */
router.get("/buses", auth, async (req, res) => {
    try {
        const driverId = req.user.id;
        // In this system, we fetch all buses or specific ones? 
        // Logic: Fetch buses where assignedDriver is this user, or all active buses for selection
        const buses = await Bus.find({ isActive: true }).lean();
        return response(res, true, "Buses fetched successfully", buses);
    } catch (err) {
        logger.error(`[DRIVER] Fetch Buses Error: ${err.message}`);
        return response(res, false, "Failed to fetch buses", {}, 500);
    }
});

/**
 * @route GET /api/driver/active-trip
 * @desc Check if driver has an ongoing trip
 */
router.get("/active-trip", auth, async (req, res) => {
    try {
        const driverId = req.user.id;
        const activeTrip = await Trip.findOne({
            driverId,
            status: "STARTED"
        }).populate("busId routeId").lean();

        return response(res, true, "Active trip status fetched", activeTrip || null);
    } catch (err) {
        logger.error(`[DRIVER] Active Trip Check Error: ${err.message}`);
        return response(res, false, "Failed to check active trip", {}, 500);
    }
});

/**
 * @route POST /api/driver/select-bus
 * @desc Lock a bus for a driver session
 */
router.post("/select-bus", auth, async (req, res) => {
    try {
        const { busId } = req.body;
        const driverId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(busId)) {
            return response(res, false, "Invalid Bus ID format", {}, 400);
        }

        const bus = await Bus.findById(busId);
        if (!bus) return response(res, false, "Bus not found", {}, 404);

        if (bus.activeDriverId && bus.activeDriverId.toString() !== driverId) {
            return response(res, false, "Bus is already active with another driver", {}, 409);
        }

        bus.activeDriverId = driverId;
        bus.status = "ONLINE";
        await bus.save();

        return response(res, true, "Bus selected successfully", bus);
    } catch (err) {
        logger.error(`[DRIVER] Select Bus Error: ${err.message}`);
        return response(res, false, "Failed to select bus", {}, 500);
    }
});

/**
 * @route POST /api/driver/reset-bus
 * @desc Force release a bus session
 */
router.post("/reset-bus", auth, async (req, res) => {
    try {
        const { busId } = req.body;
        if (!mongoose.Types.ObjectId.isValid(busId)) {
            return response(res, false, "Invalid Bus ID format", {}, 400);
        }

        const bus = await Bus.findById(busId);
        if (!bus) return response(res, false, "Bus not found", {}, 404);

        bus.activeDriverId = null;
        bus.activeTrip = null;
        bus.status = "OFFLINE";
        await bus.save();

        return response(res, true, "Bus reset successfully");
    } catch (err) {
        logger.error(`[DRIVER] Reset Bus Error: ${err.message}`);
        return response(res, false, "Failed to reset bus", {}, 500);
    }
});

/**
 * @route POST /api/driver/stop-trip
 * @desc Pause a trip
 */
router.post("/stop-trip", auth, async (req, res) => {
    try {
        const { tripId } = req.body;
        if (!mongoose.Types.ObjectId.isValid(tripId)) {
            return response(res, false, "Invalid Trip ID format", {}, 400);
        }

        const trip = await Trip.findByIdAndUpdate(tripId, { status: "STOPPED" }, { new: true });
        if (!trip) return response(res, false, "Trip not found", {}, 404);

        await Bus.findByIdAndUpdate(trip.busId, { status: "OFFLINE" }); // Bus shows as offline when paused

        logger.info(`[TRIP] Paused: ${tripId}`);
        return response(res, true, "Trip paused successfully", trip);
    } catch (err) {
        logger.error(`[DRIVER] Stop Trip Error: ${err.message}`);
        return response(res, false, "Failed to pause trip", {}, 500);
    }
});

/**
 * @route POST /api/driver/resume-trip
 * @desc Resume a paused trip
 */
router.post("/resume-trip", auth, async (req, res) => {
    try {
        const { tripId } = req.body;
        if (!mongoose.Types.ObjectId.isValid(tripId)) {
            return response(res, false, "Invalid Trip ID format", {}, 400);
        }

        const trip = await Trip.findByIdAndUpdate(tripId, { status: "STARTED" }, { new: true });
        if (!trip) return response(res, false, "Trip not found", {}, 404);

        await Bus.findByIdAndUpdate(trip.busId, { status: "ONLINE" });

        logger.info(`[TRIP] Resumed: ${tripId}`);
        return response(res, true, "Trip resumed successfully", trip);
    } catch (err) {
        logger.error(`[DRIVER] Resume Trip Error: ${err.message}`);
        return response(res, false, "Failed to resume trip", {}, 500);
    }
});

// START TRIP
router.post("/start-trip", auth, async (req, res, next) => {
    try {
        const { busId, routeId } = req.body;
        const driverId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(busId)) {
            return response(res, false, "Invalid Bus ID format", {}, 400);
        }

        const bus = await Bus.findById(busId);
        if (!bus) return response(res, false, "Bus not found", {}, 404);

        // Prioritize routeId from body, then fallback to bus's default route
        const targetRouteId = routeId || bus.defaultRoute || bus.assignedRoute;

        if (!targetRouteId || !mongoose.Types.ObjectId.isValid(targetRouteId)) {
            return response(res, false, "No route assigned to this bus", {}, 400);
        }

        // 1. Fetch Route and its Stops
        const route = await Route.findById(targetRouteId).populate("stops");
        if (!route) return response(res, false, "Route not found", {}, 404);

        // 2. Create Trip Entry
        const trip = await Trip.create({
            busId,
            driverId,
            routeId: route._id,
            status: "STARTED",
            startTime: new Date()
        });

        // Update Bus Status
        bus.status = "ONLINE";
        bus.activeTrip = trip._id;
        bus.activeDriverId = driverId;
        await bus.save();

        // 3. Cache Stops in Redis for fast Geofencing
        await trackingService.cacheRouteStops(trip._id, route.stops);

        logger.info(`[TRIP] Started: ${trip._id} for Bus: ${busId} on Route: ${targetRouteId}`);
        return response(res, true, "Trip started successfully", { tripId: trip._id });

    } catch (err) {
        next(err);
    }
});

// END TRIP
router.post("/end-trip", auth, async (req, res, next) => {
    try {
        const { tripId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(tripId)) {
            return response(res, false, "Invalid Trip ID format", {}, 400);
        }

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
