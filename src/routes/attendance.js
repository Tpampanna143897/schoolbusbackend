const router = require("express").Router();
const auth = require("../middleware/auth");
const Attendance = require("../models/Attendance");
const Trip = require("../models/Trip");
const response = require("../utils/response");
const moment = require("moment");

// MARK ATTENDANCE (PICKED or DROPPED)
router.post("/", auth, async (req, res) => {
    try {
        const { studentId, status, tripId, lat, lng } = req.body;

        if (!studentId || !status) {
            return response(res, false, "Student and status are required", {}, 400);
        }

        const date = moment().format("YYYY-MM-DD");
        const updateData = { status, tripId };

        if (status === "PICKED" || status === "PICKED_UP") {
            updateData.pickupTime = new Date();
            updateData.pickupLat = lat;
            updateData.pickupLng = lng;
        } else if (status === "DROPPED" || status === "DROPPED_OFF") {
            updateData.dropTime = new Date();
            updateData.dropLat = lat;
            updateData.dropLng = lng;
        }

        const attendance = await Attendance.findOneAndUpdate(
            { studentId, date },
            { $set: updateData },
            { upsert: true, new: true }
        ).lean();

        return response(res, true, "Attendance marked successfully", attendance);
    } catch (err) {
        console.error("Attendance Error:", err);
        return response(res, false, "Attendance operation failed", {}, 500);
    }
});

// GET STUDENT ATTENDANCE HISTORY
router.get("/history/:studentId", auth, async (req, res) => {
    try {
        const { studentId } = req.params;
        const { month, year } = req.query;

        let query = { studentId };

        if (month && year) {
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
            .sort({ date: -1 })
            .lean();

        return response(res, true, "Attendance history fetched", history || []);
    } catch (err) {
        console.error("History Fetch Error:", err);
        return response(res, false, "Failed to fetch attendance history", {}, 500);
    }
});

router.get("/:studentId", auth, async (req, res) => {
    try {
        const attendance = await Attendance.find({ studentId: req.params.studentId })
            .sort({ date: -1 })
            .lean();
        return response(res, true, "Attendance data fetched", attendance || []);
    } catch (err) {
        console.error("Attendance Fetch Error:", err);
        return response(res, false, "Failed to fetch attendance", {}, 500);
    }
});

module.exports = router;
