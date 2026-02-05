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
