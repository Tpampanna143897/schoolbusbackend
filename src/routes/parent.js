const router = require("express").Router();
const auth = require("../middleware/auth");
const Trip = require("../models/Trip");
const Tracking = require("../models/Tracking");
const Student = require("../models/Student");

/**
 * BACKEND HEALTH & ROUTE TEST
 */
router.get("/ping", auth, (req, res) => res.json({ status: "PARENT API LIVE", time: new Date() }));

const mongoose = require("mongoose");

/**
 * GET TRIP LAST LOCATION (Fallback only)
 */
router.get("/trip-location/:tripId", auth, async (req, res) => {
    try {
        const { tripId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(tripId)) {
            return res.status(400).json({ success: false, message: "Invalid Trip ID format" });
        }

        const latestLocation = await Tracking
            .findOne({ tripId })
            .sort({ timestamp: -1 })
            .lean();

        const trip = await Trip.findById(tripId).select("status").lean();

        if (!latestLocation) {
            const tripStatus = trip ? trip.status : "UNKNOWN";
            return res.json({
                success: true,
                data: {
                    status: tripStatus === "STARTED" ? "waiting" : "offline",
                    message: tripStatus === "STARTED" ? "Trip started but no location data yet" : "No location data available"
                }
            });
        }

        res.json({
            success: true,
            data: {
                ...latestLocation,
                status: trip && trip.status === "STARTED" ? "online" : "offline"
            }
        });
    } catch (err) {
        console.error("GET TRIP LOCATION ERR:", err.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

/**
 * GET BUS LAST LOCATION (Fallback using busId)
 */
router.get("/bus-location/:busId", auth, async (req, res) => {
    try {
        const { busId } = req.params;
        // Find the most recent active trip for this bus
        const latestTrip = await Trip.findOne({
            busId,
            status: { $in: ["STARTED", "STOPPED"] }
        }).sort({ startedAt: -1 });

        if (!latestTrip) {
            return res.json({
                status: "offline",
                message: "Bus is currently offline (No active trip)"
            });
        }

        const latestLocation = await Tracking
            .findOne({ tripId: latestTrip._id })
            .sort({ timestamp: -1 })
            .lean();

        if (!latestLocation) {
            if (latestTrip.status === "STARTED") {
                return res.json({
                    status: "waiting",
                    message: "Trip is active, waiting for location updates...",
                    tripId: latestTrip._id
                });
            }
            return res.json({
                status: "offline",
                message: "No tracking data available for active trip",
                tripId: latestTrip._id
            });
        }

        res.json({
            ...latestLocation,
            status: latestTrip.status === "STARTED" ? "online" : "offline",
            tripId: latestTrip._id
        });
    } catch (err) {
        console.error("GET BUS LOCATION ERR:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});


/**
 * GET MY CHILDREN
 */
router.get("/my-children", auth, async (req, res) => {
    try {
        const students = await Student.find({ parent: req.user.id })
            .populate("assignedBus assignedRoute activeTripId");
        res.json(students);
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

module.exports = router;
