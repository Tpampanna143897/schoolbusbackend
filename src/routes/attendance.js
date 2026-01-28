const router = require("express").Router();
const auth = require("../middleware/auth");
const Attendance = require("../models/Attendance");
const Trip = require("../models/Trip");

const moment = require("moment");

// MARK ATTENDANCE (PICKED or DROPPED)
router.post("/", auth, async (req, res) => {
    try {
        const { studentId, status, tripId, lat, lng } = req.body;

        if (!studentId || !status) {
            return res.status(400).json({ message: "Student and status are required" });
        }

        const date = moment().format("YYYY-MM-DD");
        const updateData = { status, tripId };

        if (status === "PICKED") {
            updateData.pickupTime = new Date();
            updateData.pickupLat = lat;
            updateData.pickupLng = lng;
        } else if (status === "DROPPED") {
            updateData.dropTime = new Date();
            updateData.dropLat = lat;
            updateData.dropLng = lng;
        }

        const attendance = await Attendance.findOneAndUpdate(
            { studentId, date },
            { $set: updateData },
            { upsert: true, new: true }
        );

        res.json(attendance);
    } catch (err) {
        console.error("Attendance Error:", err);
        res.status(500).json({ message: "Attendance operation failed" });
    }
});

// GET STUDENT ATTENDANCE HISTORY
router.get("/history/:studentId", auth, async (req, res) => {
    try {
        const { studentId } = req.params;
        const { month, year } = req.query; // Optional filters

        let query = { studentId };

        if (month && year) {
            // Filter by month and year in YYYY-MM-DD format
            const monthStr = month.toString().padStart(2, '0');
            query.date = { $regex: `^${year}-${monthStr}-` };
        }

        const history = await Attendance.find(query)
            .populate({
                path: 'tripId',
                populate: [
                    { path: 'driverId', select: 'name' },
                    { path: 'busId', select: 'busNumber' },
                    { path: 'routeId', select: 'name' }
                ]
            })
            .sort({ date: -1 });

        res.json(history);
    } catch (err) {
        console.error("History Fetch Error:", err);
        res.status(500).json({ message: "Failed to fetch attendance history" });
    }
});

router.get("/:studentId", auth, async (req, res) => {
    try {
        const attendance = await Attendance.find({ studentId: req.params.studentId }).sort({ date: -1 });
        res.json(attendance);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch attendance" });
    }
});

module.exports = router;
