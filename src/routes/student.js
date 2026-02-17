const router = require("express").Router();
const Student = require("../models/Student");
const auth = require("../middleware/auth");
const response = require("../utils/response");
const mongoose = require("mongoose");

/**
 * Add student
 */
/**
 * @swagger
 * /students:
 *   post:
 *     summary: Add a new student
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, rollNumber]
 *     responses:
 *       201:
 *         description: Student created
 */
router.post("/", auth, async (req, res) => {
    try {
        const student = await Student.create(req.body);
        return response(res, true, "Student added successfully", student, 201);
    } catch (err) {
        return response(res, false, "Failed to add student", {}, 500);
    }
});

/**
 * @route GET /api/students/bus/:busId
 * @desc Get students assigned to a specific bus
 */
/**
 * @swagger
 * /students/bus/{busId}:
 *   get:
 *     summary: Get students assigned to a specific bus
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: busId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of students
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
