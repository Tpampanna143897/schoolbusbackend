const router = require("express").Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const Attendance = require("../models/Attendance");

router.post("/", auth, role("DRIVER"), async (req, res) => {
    const attendance = await Attendance.create(req.body);
    res.json(attendance);
});

router.get("/:studentId", auth, async (req, res) => {
    const records = await Attendance.find({ student: req.params.studentId });
    res.json(records);
});

module.exports = router;
