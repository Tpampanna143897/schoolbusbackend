const router = require("express").Router();
const auth = require("../middleware/auth");
const Attendance = require("../models/Attendance");
const Trip = require("../models/Trip");

router.post("/", auth, async (req, res) => {
    try {
        const { studentId, status, tripId } = req.body;

        if (!studentId || !status || !tripId) {
            return res.status(400).json({ message: "Student, status, and tripId are required" });
        }

        const trip = await Trip.findById(tripId);
        if (!trip) return res.status(404).json({ message: "Trip not found" });

        const attendance = await Attendance.create({
            studentId,
            tripId,
            busId: trip.bus,
            status,
            timestamp: new Date()
        });

        res.json(attendance);
    } catch (err) {
        res.status(500).json({ message: "Attendance failed" });
    }
});

router.get("/:studentId", auth, async (req, res) => {
    try {
        const attendance = await Attendance.find({ studentId: req.params.studentId }).sort({ timestamp: -1 });
        res.json(attendance);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch attendance" });
    }
});

module.exports = router;
