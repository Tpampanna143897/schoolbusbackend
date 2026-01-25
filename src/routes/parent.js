const router = require("express").Router();
const auth = require("../middleware/auth");
const Trip = require("../models/Trip");
const Tracking = require("../models/Tracking");
const Student = require("../models/Student");

/**
 * GET TRIP LOCATION
 */
router.get("/trip-location/:tripId", auth, async (req, res) => {
    try {
        const { tripId } = req.params;
        const latestLocation = await Tracking.findOne({ tripId: tripId }).sort({ timestamp: -1 });

        if (!latestLocation) {
            return res.status(404).json({ message: "No location data available for this trip" });
        }

        res.json(latestLocation);
    } catch (err) {
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
