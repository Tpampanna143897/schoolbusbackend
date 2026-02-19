const router = require("express").Router();
const auth = require("../middleware/auth");
const Trip = require("../models/Trip");
const Tracking = require("../models/Tracking");
const Student = require("../models/Student");
const progressionController = require("../controllers/progressionController");

/**
 * @swagger
 * /parent/trip-progression/{tripId}:
 *   get:
 *     summary: Get progression (next stop, ETA) for a trip
 *     tags: [Parent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 */
router.get("/trip-progression/:tripId", auth, progressionController.getNextStop);

/**
 * @swagger
 * /parent/remaining-stops/{tripId}:
 *   get:
 *     summary: Get remaining stops for an active trip
 *     tags: [Parent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 */
router.get("/remaining-stops/:tripId", auth, progressionController.getRemainingStops);

/**
 * BACKEND HEALTH & ROUTE TEST
 */
router.get("/ping", auth, (req, res) => res.json({ status: "PARENT API LIVE", time: new Date() }));

const mongoose = require("mongoose");

const response = require("../utils/response");
const { redis } = require("../config/redis");
const LiveLocation = require("../models/LiveLocation");

/**
 * GET TRIP LAST LOCATION
 */
/**
 * @swagger
 * /parent/trip-location/{tripId}:
 *   get:
 *     summary: Get last known location for a specific student trip
 *     tags: [Parent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trip location
 */
router.get("/trip-location/:tripId", auth, async (req, res) => {
    try {
        const { tripId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(tripId)) {
            return response(res, false, "Invalid Trip ID format", {}, 400);
        }

        // 1. Check Redis Cache
        const cached = await redis.get(`trip:${tripId}:live`);
        if (cached) {
            const data = JSON.parse(cached);
            return response(res, true, "Trip location fetched (cache)", {
                ...data,
                status: "online"
            });
        }

        // 2. Check LiveLocation
        const liveLoc = await LiveLocation.findOne({ tripId }).lean();
        if (liveLoc) {
            return response(res, true, "Trip location fetched (live)", {
                lat: liveLoc.coordinates.lat,
                lng: liveLoc.coordinates.lng,
                speed: liveLoc.speed,
                heading: liveLoc.heading,
                timestamp: liveLoc.lastUpdate,
                status: liveLoc.status === "ONLINE" ? "online" : "offline"
            });
        }

        // 3. Historical Fallback
        const latestLocation = await Tracking
            .findOne({ tripId })
            .sort({ timestamp: -1 })
            .lean();

        const trip = await Trip.findById(tripId).select("status").lean();

        if (!latestLocation) {
            const tripStatus = trip ? trip.status : "UNKNOWN";
            return response(res, true, tripStatus === "STARTED" ? "Waiting for GPS..." : "Bus offline", {
                status: tripStatus === "STARTED" ? "waiting" : "offline"
            });
        }

        return response(res, true, "Trip location fetched (history)", {
            ...latestLocation,
            status: trip && trip.status === "STARTED" ? "online" : "offline"
        });
    } catch (err) {
        return response(res, false, "Internal Server Error", {}, 500);
    }
});

/**
 * GET BUS LAST LOCATION
 */
/**
 * @swagger
 * /parent/bus-location/{busId}:
 *   get:
 *     summary: Get last known location for a bus
 *     tags: [Parent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: busId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bus location
 */
router.get("/bus-location/:busId", auth, async (req, res) => {
    try {
        const { busId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(busId)) {
            return response(res, false, "Invalid Bus ID format", {}, 400);
        }

        // Find the most recent active trip for this bus
        const latestTrip = await Trip.findOne({
            busId,
            status: { $in: ["STARTED", "STOPPED"] }
        }).sort({ startedAt: -1 }).lean();

        if (!latestTrip) {
            return response(res, true, "Bus is currently offline", { status: "offline" });
        }

        // Check LiveLocation first
        const liveLoc = await LiveLocation.findOne({ tripId: latestTrip._id }).lean();
        if (liveLoc) {
            return response(res, true, "Bus location fetched (live)", {
                lat: liveLoc.coordinates.lat,
                lng: liveLoc.coordinates.lng,
                speed: liveLoc.speed,
                heading: liveLoc.heading,
                tripId: latestTrip._id,
                status: "online"
            });
        }

        const latestLocation = await Tracking
            .findOne({ tripId: latestTrip._id })
            .sort({ timestamp: -1 })
            .lean();

        if (!latestLocation) {
            return response(res, true, "Trip active, waiting for GPS", {
                status: "waiting",
                tripId: latestTrip._id
            });
        }

        return response(res, true, "Bus location fetched (history)", {
            ...latestLocation,
            status: latestTrip.status === "STARTED" ? "online" : "offline",
            tripId: latestTrip._id
        });
    } catch (err) {
        return response(res, false, "Internal Server Error", {}, 500);
    }
});


/**
 * GET MY CHILDREN
 */
router.get("/my-children", auth, async (req, res) => {
    try {
        const students = await Student.find({ parent: req.user.id })
            .populate("assignedBus assignedRoute activeTripId")
            .lean();

        res.json({
            success: true,
            data: students || []
        });
    } catch (err) {
        console.error("GET CHILDREN ERR:", err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

module.exports = router;
