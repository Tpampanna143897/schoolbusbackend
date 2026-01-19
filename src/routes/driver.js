const router = require("express").Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const Bus = require("../models/Bus");
const Student = require("../models/Student");

/**
 * GET ASSIGNED BUS
 */
router.get("/bus", auth, role("DRIVER"), async (req, res) => {
    const bus = await Bus.findOne({ driver: req.user.id }).populate("route");
    res.json(bus);
});

/**
 * START TRIP
 */
router.post("/start-trip", auth, role("DRIVER"), async (req, res) => {
    res.json({ message: "Trip started" });
});

/**
 * GET STUDENTS IN BUS
 */
router.get("/students", auth, role("DRIVER"), async (req, res) => {
    const students = await Student.find({ bus: req.query.busId });
    res.json(students);
});

module.exports = router;
