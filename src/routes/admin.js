const router = require("express").Router();
const bcrypt = require("bcryptjs");
const auth = require("../middleware/auth");
const role = require("../middleware/role");

const User = require("../models/User");
const Route = require("../models/Route");
const Bus = require("../models/Bus");
const Student = require("../models/Student");
const Tracking = require("../models/Tracking");
const Trip = require("../models/Trip");

/**
 * CREATE DRIVER / PARENT
 */
router.post("/users", auth, role("ADMIN"), async (req, res) => {
    try {
        const { name, email, password, role: userRole, assignedRoute, assignedBus } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: userRole,
            assignedRoute,
            assignedBus
        });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: "User creation failed" });
    }
});

router.get("/users", auth, role("ADMIN", "STAFF"), async (req, res) => {
    const users = await User.find({ role: req.query.role })
        .populate("assignedRoute assignedBus")
        .select("-password");
    res.json(users);
});

router.put("/users/:id", auth, role("ADMIN"), async (req, res) => {
    try {
        const { name, email, role: userRole, assignedRoute, assignedBus } = req.body;
        const update = { name, email, role: userRole, assignedRoute, assignedBus };
        const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
            .populate("assignedRoute assignedBus")
            .select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: "User update failed" });
    }
});

/**
 * BUS MANAGEMENT
 */
router.post("/buses", auth, role("ADMIN"), async (req, res) => {
    const bus = await Bus.create(req.body);
    res.json(bus);
});

router.get("/buses", auth, role("ADMIN", "STAFF"), async (req, res) => {
    const buses = await Bus.find().populate("activeTrip");
    res.json(buses);
});

router.put("/buses/:id/status", auth, role("ADMIN"), async (req, res) => {
    const { isActive } = req.body;
    const bus = await Bus.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
    res.json(bus);
});

/**
 * STUDENT MANAGEMENT
 */
router.post("/students", auth, role("ADMIN"), async (req, res) => {
    try {
        const studentData = { ...req.body };
        if (studentData.assignedRoute === "") studentData.assignedRoute = null;
        if (studentData.assignedBus === "") studentData.assignedBus = null;

        console.log("ENROLL STUDENT REQUEST:", studentData);
        const student = await Student.create(studentData);
        res.json(student);
    } catch (err) {
        console.error("ENROLL ERR:", err);
        res.status(500).json({ message: "Enrollment failed: " + err.message });
    }
});

router.get("/students", auth, role("ADMIN", "STAFF"), async (req, res) => {
    const students = await Student.find().populate("parent assignedRoute assignedBus activeTripId");
    res.json(students);
});

router.put("/students/:id", auth, role("ADMIN"), async (req, res) => {
    try {
        const studentId = req.params.id;
        const mongoose = require("mongoose");
        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({ message: "Invalid Student ID format" });
        }

        const updateData = { ...req.body };
        const cleanUpdate = {};

        // Strict cleaner for ObjectId fields
        const toValidId = (val) => {
            if (val === "" || val === null || val === "null" || val === "undefined") return null;
            if (mongoose.Types.ObjectId.isValid(val)) return val;
            return undefined;
        };

        if (updateData.name !== undefined) cleanUpdate.name = updateData.name;
        if (updateData.class !== undefined) cleanUpdate.class = updateData.class;

        if (updateData.assignedRoute !== undefined) cleanUpdate.assignedRoute = toValidId(updateData.assignedRoute);
        if (updateData.assignedBus !== undefined) cleanUpdate.assignedBus = toValidId(updateData.assignedBus);
        if (updateData.parent !== undefined) {
            const pId = toValidId(updateData.parent);
            if (pId) cleanUpdate.parent = pId;
        }

        console.log(`CLEAN UPDATE for ${studentId}:`, cleanUpdate);

        const student = await Student.findByIdAndUpdate(studentId, cleanUpdate, { new: true })
            .populate("parent assignedRoute assignedBus");

        if (!student) return res.status(404).json({ message: "Student not found" });
        res.json(student);
    } catch (err) {
        console.error("STUDENT UPDATE ERR:", err);
        res.status(500).json({ message: "Update failed: " + err.message });
    }
});

router.put("/students/:id/route", auth, role("ADMIN"), async (req, res) => {
    const { routeId } = req.body;
    const student = await Student.findByIdAndUpdate(req.params.id, { assignedRoute: routeId }, { new: true });
    res.json(student);
});

router.put("/students/:id/bus", auth, role("ADMIN"), async (req, res) => {
    const { busId } = req.body;
    const student = await Student.findByIdAndUpdate(req.params.id, { assignedBus: busId }, { new: true });
    res.json(student);
});

/**
 * ROUTE MANAGEMENT
 */
router.post("/routes", auth, role("ADMIN"), async (req, res) => {
    const route = await Route.create(req.body);
    res.json(route);
});

router.get("/routes", auth, role("ADMIN", "STAFF"), async (req, res) => {
    const routes = await Route.find();
    res.json(routes);
});

/**
 * LIVE TRACKING - ALL ACTIVE JOURNEYS
 */
router.get("/live-trips", auth, role("ADMIN", "STAFF"), async (req, res) => {
    try {
        const trips = await Trip.find({ status: { $in: ["STARTED", "STOPPED"] } })
            .populate("driverId", "name email")
            .populate("busId")
            .populate("routeId");

        // Attach latest location to each trip for immediate map visualization
        const tripsWithLocation = await Promise.all(trips.map(async (trip) => {
            const lastLoc = await Tracking.findOne({ tripId: trip._id }).sort({ timestamp: -1 });
            return {
                ...trip.toObject(),
                location: lastLoc ? {
                    lat: lastLoc.lat,
                    lng: lastLoc.lng,
                    speed: lastLoc.speed,
                    timestamp: lastLoc.timestamp
                } : null
            };
        }));

        res.json(tripsWithLocation);
    } catch (err) {
        console.error("Live trips fetch error:", err);
        res.status(500).json({ message: "Failed to fetch live trips" });
    }
});

/**
 * TRIP HISTORY
 */
router.get("/trip-history", auth, role("ADMIN"), async (req, res) => {
    try {
        const { driverId, busId, routeId, startDate, endDate } = req.query;
        let query = { status: "ENDED" };

        if (driverId) query.driverId = driverId;
        if (busId) query.busId = busId;
        if (routeId) query.routeId = routeId;
        if (startDate || endDate) {
            query.startedAt = {};
            if (startDate) query.startedAt.$gte = new Date(startDate);
            if (endDate) query.startedAt.$lte = new Date(endDate);
        }

        const history = await Trip.find(query)
            .populate("driverId", "name")
            .populate("busId", "busNumber")
            .populate("routeId", "name")
            .sort({ endedAt: -1 });

        res.json(history);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch history" });
    }
});

/**
 * ADMIN: SWITCH ACTIVE DRIVER FOR A BUS
 */
router.put("/buses/:id/active-driver", auth, role("ADMIN"), async (req, res) => {
    try {
        const { activeDriverId } = req.body;

        // Optionally verify if driverId is in assignedDrivers list
        const bus = await Bus.findById(req.params.id);
        if (!bus) return res.status(404).json({ message: "Bus not found" });

        bus.activeDriver = activeDriverId || null;
        await bus.save();

        res.json({ message: "Active driver updated", bus });
    } catch (err) {
        res.status(500).json({ message: "Failed to update active driver: " + err.message });
    }
});

/**
 * GET SPECIFIC TRIP LOCATION
 */
/**
 * ADMIN: RESET BUS (Emergency clear)
 */
router.post("/buses/:id/reset", auth, role("ADMIN"), async (req, res) => {
    try {
        const bus = await Bus.findByIdAndUpdate(req.params.id, {
            activeTrip: null,
            activeDriverId: null,
            status: "OFFLINE",
            speed: 0
        }, { new: true });

        if (!bus) return res.status(404).json({ message: "Bus not found" });

        // Also end any trip associated with this bus
        await Trip.updateMany(
            { busId: req.params.id, status: { $in: ["STARTED", "STOPPED"] } },
            { status: "ENDED", endedAt: new Date() }
        );

        res.json({ message: "Bus reset successfully", bus });
    } catch (err) {
        res.status(500).json({ message: "Failed to reset bus: " + err.message });
    }
});

module.exports = router;
