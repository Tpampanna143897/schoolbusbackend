const router = require("express").Router();
const auth = require("../middleware/auth");
const Tracking = require("../models/Tracking");

router.get("/bus-location/:busId", auth, async (req, res) => {
    try {
        if (!require("mongoose").isValidObjectId(req.params.busId)) {
            return res.status(400).json({ message: "Invalid Bus ID" });
        }

        const last = await Tracking.findOne({ bus: req.params.busId })
            .sort({ createdAt: -1 });

        if (!last) {
            return res.status(404).json({ message: "No tracking data" });
        }

        res.json({
            busId: req.params.busId,
            lat: last.lat,
            lng: last.lng,
            time: last.createdAt
        });
    } catch (err) {
        console.error("PARENT BUS LOCATION ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

const Student = require("../models/Student");

/**
 * GET MY BUS (Parent's assigned bus)
 */
router.get("/my-bus", auth, async (req, res) => {
    try {
        // Find student associated with this parent
        const student = await Student.findOne({ parent: req.user.id })
            .populate({
                path: "bus",
                populate: { path: "route" } // Deep populate route to get path points
            });

        if (!student || !student.bus) {
            return res.status(404).json({ message: "No bus assigned to your child" });
        }

        res.json(student.bus);
    } catch (err) {
        console.error("PARENT BUS FETCH ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
