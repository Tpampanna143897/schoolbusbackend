const router = require("express").Router();
const bcrypt = require("bcryptjs");
const auth = require("../middleware/auth");
const role = require("../middleware/role");

const User = require("../models/User");
const Route = require("../models/Route");
const Bus = require("../models/Bus");
const Student = require("../models/Student");

/**
 * CREATE DRIVER / PARENT
 */
router.post("/users", auth, role("ADMIN"), async (req, res) => {
    try {
        const { name, email, password, role: userRole } = req.body;

        if (!["DRIVER", "PARENT"].includes(userRole)) {
            return res.status(400).json({ message: "Invalid role" });
        }

        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: userRole
        });

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "User creation failed" });
    }
});

/**
 * GET USERS BY ROLE
 */
router.get("/users", auth, role("ADMIN"), async (req, res) => {
    const users = await User.find({ role: req.query.role }).select("-password");
    res.json(users);
});

/**
 * CREATE ROUTE
 */
router.post("/routes", auth, role("ADMIN"), async (req, res) => {
    const route = await Route.create(req.body);
    res.json(route);
});

/**
 * GET ROUTES
 */
router.get("/routes", auth, role("ADMIN"), async (req, res) => {
    const routes = await Route.find();
    res.json(routes);
});

/**
 * CREATE BUS
 */
router.post("/buses", auth, role("ADMIN"), async (req, res) => {
    const bus = await Bus.create(req.body);
    res.json(bus);
});

/**
 * GET BUSES
 */
router.get("/buses", auth, role("ADMIN"), async (req, res) => {
    const buses = await Bus.find().populate("route driver");
    res.json(buses);
});

/**
 * CREATE STUDENT
 */
router.post("/students", auth, role("ADMIN"), async (req, res) => {
    const student = await Student.create(req.body);
    res.json(student);
});

/**
 * GET STUDENTS
 */
router.get("/students", auth, role("ADMIN"), async (req, res) => {
    const students = await Student.find()
        .populate("parent route bus");
    res.json(students);
});

module.exports = router;
