const router = require("express").Router();
const auth = require("../middleware/auth");
const Trip = require("../models/Trip");
const Tracking = require("../models/Tracking");
const Student = require("../models/Student");

/**
 * BACKEND HEALTH & ROUTE TEST
 */
router.get("/ping", auth, (req, res) => res.json({ status: "PARENT API LIVE", time: new Date() }));

/**
 * GET TRIP LAST LOCATION (Fallback only)
 */
router.get("/trip-location/:tripId", auth, async (req, res) => {
    try {
        const { tripId } = req.params;

        const latestLocation = await Tracking
            .findOne({ tripId })
            .sort({ timestamp: -1 })
            .lean();

        if (!latestLocation) {
            return res.json({ status: "offline", message: "No location data available" });
        }

        res.json({ ...latestLocation, status: "online" });
    } catch (err) {
        console.error("GET TRIP LOCATION ERR:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * GET BUS LAST LOCATION (Fallback using busId)
 */
router.get("/bus-location/:busId", auth, async (req, res) => {
    try {
        const { busId } = req.params;
        // Find the most recent active or stopped trip for this bus
        const latestTrip = await Trip.findOne({
            busId,
            status: { $in: ["STARTED", "STOPPED"] }
        }).sort({ startedAt: -1 });

        if (!latestTrip) {
            return res.json({ status: "offline", message: "Bus is currently offline (No active trip)" });
        }

        const latestLocation = await Tracking
            .findOne({ tripId: latestTrip._id })
            .sort({ timestamp: -1 })
            .lean();

        if (!latestLocation) {
            return res.json({ status: "offline", message: "No tracking data available for active trip" });
        }

        res.json({ ...latestLocation, status: "online", tripId: latestTrip._id });
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
