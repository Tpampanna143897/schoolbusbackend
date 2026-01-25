const router = require("express").Router();
const Student = require("../models/Student");
const auth = require("../middleware/auth");

/**
 * Add student
 */
router.post("/", auth, async (req, res) => {
    try {
        const student = await Student.create(req.body);
        res.json(student);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * Get students by bus (for driver) - updated to check preferred bus
 */
router.get("/bus/:busId", auth, async (req, res) => {
    try {
        const students = await Student.find({ assignedBus: req.params.busId });
        res.json(students);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * Get student by parent (for parent dashboard) - populated with active trip
 */
router.get("/parent/:parentId", auth, async (req, res) => {
    try {
        const student = await Student.findOne({ parent: req.params.parentId })
            .populate("assignedBus assignedRoute activeTrip");
        res.json(student);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
