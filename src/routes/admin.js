const router = require("express").Router();
const bcrypt = require("bcryptjs");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const response = require("../utils/response");
const logger = require("../utils/logger");

const User = require("../models/User");
const Route = require("../models/Route");
const Bus = require("../models/Bus");
const Student = require("../models/Student");
const Tracking = require("../models/Tracking");
const Trip = require("../models/Trip");
const mongoose = require("mongoose");

/**
 * BACKEND HEALTH & ROUTE TEST
 */
router.get("/ping", auth, (req, res) => response(res, true, "ADMIN API LIVE", { time: new Date() }));

/**
 * GET SPECIFIC TRIP LOCATION (Last known point)
 */
router.get("/trip-location/:tripId", auth, role("ADMIN", "STAFF"), async (req, res) => {
    try {
        const { tripId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(tripId)) {
            return response(res, false, "Invalid Trip ID format", {}, 400);
        }

        // 1. Get last known location
        const lastLoc = await Tracking.findOne({ tripId }).sort({ timestamp: -1 }).lean();

        // 2. Check trip status for context
        const trip = await Trip.findById(tripId).select("status").lean();

        if (!lastLoc) {
            const tripStatus = trip ? trip.status : "UNKNOWN";
            return response(res, true, "No location found yet", {
                status: tripStatus === "STARTED" ? "waiting" : "offline",
                message: tripStatus === "STARTED" ? "Trip started but no location data received yet" : "No location data found"
            });
        }

        return response(res, true, "Trip location fetched", {
            ...lastLoc,
            status: trip && trip.status === "STARTED" ? "online" : "offline",
            tripStatus: trip ? trip.status : "UNKNOWN"
        });
    } catch (err) {
        logger.error(`[ADMIN] GET TRIP LOCATION ERR: ${err.message}`);
        return response(res, false, "Internal server error", {}, 500);
    }
});

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
        return response(res, true, "User created successfully", user, 201);
    } catch (err) {
        return response(res, false, "User creation failed", {}, 500);
    }
});

router.get("/users", auth, role("ADMIN", "STAFF"), async (req, res) => {
    try {
        const users = await User.find({ role: req.query.role })
            .populate("assignedRoute assignedBus")
            .select("-password")
            .lean();
        return response(res, true, "Users fetched successfully", users);
    } catch (err) {
        return response(res, false, "Failed to fetch users", {}, 500);
    }
});

router.put("/users/:id", auth, role("ADMIN"), async (req, res) => {
    try {
        const { name, email, role: userRole, assignedRoute, assignedBus } = req.body;
        const update = { name, email, role: userRole, assignedRoute, assignedBus };
        const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
            .populate("assignedRoute assignedBus")
            .select("-password")
            .lean();
        if (!user) return response(res, false, "User not found", {}, 404);
        return response(res, true, "User updated successfully", user);
    } catch (err) {
        return response(res, false, "User update failed", {}, 500);
    }
});

/**
 * BUS MANAGEMENT
 */
router.post("/buses", auth, role("ADMIN"), async (req, res) => {
    try {
        const bus = await Bus.create(req.body);
        return response(res, true, "Bus created successfully", bus, 201);
    } catch (err) {
        return response(res, false, "Failed to create bus", {}, 500);
    }
});

router.get("/buses", auth, role("ADMIN", "STAFF"), async (req, res) => {
    try {
        const buses = await Bus.find().populate("activeTrip").lean();
        return response(res, true, "Buses fetched successfully", buses);
    } catch (err) {
        return response(res, false, "Failed to fetch buses", {}, 500);
    }
});

router.put("/buses/:id/status", auth, role("ADMIN"), async (req, res) => {
    try {
        const { isActive } = req.body;
        const bus = await Bus.findByIdAndUpdate(req.params.id, { isActive }, { new: true }).lean();
        if (!bus) return response(res, false, "Bus not found", {}, 404);
        return response(res, true, "Bus status updated", bus);
    } catch (err) {
        return response(res, false, "Failed to update bus status", {}, 500);
    }
});

/**
 * STUDENT MANAGEMENT
 */
router.post("/students", auth, role("ADMIN"), async (req, res) => {
    try {
        const studentData = { ...req.body };
        if (studentData.assignedRoute === "") studentData.assignedRoute = null;
        if (studentData.assignedBus === "") studentData.assignedBus = null;

        const student = await Student.create(studentData);
        return response(res, true, "Student enrolled successfully", student, 201);
    } catch (err) {
        return response(res, false, "Enrollment failed: " + err.message, {}, 500);
    }
});

router.get("/students", auth, role("ADMIN", "STAFF"), async (req, res) => {
    try {
        const students = await Student.find().populate("parent assignedRoute assignedBus activeTripId").lean();
        return response(res, true, "Students fetched successfully", students);
    } catch (err) {
        return response(res, false, "Failed to fetch students", {}, 500);
    }
});

router.put("/students/:id", auth, role("ADMIN"), async (req, res) => {
    try {
        const studentId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return response(res, false, "Invalid Student ID format", {}, 400);
        }

        const updateData = { ...req.body };
        const cleanUpdate = {};

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

        const student = await Student.findByIdAndUpdate(studentId, cleanUpdate, { new: true })
            .populate("parent assignedRoute assignedBus")
            .lean();

        if (!student) return response(res, false, "Student not found", {}, 404);
        return response(res, true, "Student updated successfully", student);
    } catch (err) {
        return response(res, false, "Update failed: " + err.message, {}, 500);
    }
});

router.put("/students/:id/route", auth, role("ADMIN"), async (req, res) => {
    try {
        const { routeId } = req.body;
        const student = await Student.findByIdAndUpdate(req.params.id, { assignedRoute: routeId }, { new: true }).lean();
        return response(res, true, "Student route updated", student);
    } catch (err) {
        return response(res, false, "Failed to update route", {}, 500);
    }
});

router.put("/students/:id/bus", auth, role("ADMIN"), async (req, res) => {
    try {
        const { busId } = req.body;
        const student = await Student.findByIdAndUpdate(req.params.id, { assignedBus: busId }, { new: true }).lean();
        return response(res, true, "Student bus updated", student);
    } catch (err) {
        return response(res, false, "Failed to update bus", {}, 500);
    }
});

/**
 * ROUTE MANAGEMENT
 */
router.post("/routes", auth, role("ADMIN"), async (req, res) => {
    try {
        const route = await Route.create(req.body);
        return response(res, true, "Route created successfully", route, 201);
    } catch (err) {
        return response(res, false, "Failed to create route", {}, 500);
    }
});

router.get("/routes", auth, role("ADMIN", "STAFF"), async (req, res) => {
    try {
        const routes = await Route.find().lean();
        return response(res, true, "Routes fetched successfully", routes);
    } catch (err) {
        return response(res, false, "Failed to fetch routes", {}, 500);
    }
});

/**
 * LIVE TRACKING - ALL ACTIVE JOURNEYS
 */
router.get("/live-trips", auth, role("ADMIN", "STAFF"), async (req, res) => {
    try {
        const trips = await Trip.find({ status: { $in: ["STARTED", "STOPPED"] } })
            .populate("driverId", "name email")
            .populate("busId")
            .populate("routeId")
            .lean();

        const tripsWithLocation = await Promise.all(trips.map(async (trip) => {
            try {
                const lastLoc = await Tracking.findOne({ tripId: trip._id }).sort({ timestamp: -1 }).lean();
                return {
                    ...trip,
                    location: lastLoc ? {
                        lat: lastLoc.lat || 0,
                        lng: lastLoc.lng || 0,
                        speed: lastLoc.speed || 0,
                        timestamp: lastLoc.timestamp
                    } : null
                };
            } catch (innerErr) {
                return { ...trip, location: null };
            }
        }));

        return response(res, true, "Live trips fetched", tripsWithLocation || []);
    } catch (err) {
        return response(res, false, "Failed to fetch live trips", {}, 500);
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
            .sort({ endedAt: -1 })
            .lean();

        return response(res, true, "Trip history fetched", history || []);
    } catch (err) {
        return response(res, false, "Failed to fetch history", {}, 500);
    }
});

/**
 * ADMIN: SWITCH ACTIVE DRIVER FOR A BUS
 */
router.put("/buses/:id/active-driver", auth, role("ADMIN"), async (req, res) => {
    try {
        const { activeDriverId } = req.body;
        const bus = await Bus.findById(req.params.id);
        if (!bus) return response(res, false, "Bus not found", {}, 404);

        bus.activeDriverId = activeDriverId || null;
        await bus.save();

        return response(res, true, "Active driver updated", bus);
    } catch (err) {
        return response(res, false, "Failed to update active driver", {}, 500);
    }
});

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
        }, { new: true }).lean();

        if (!bus) return response(res, false, "Bus not found", {}, 404);

        await Trip.updateMany(
            { busId: req.params.id, status: { $in: ["STARTED", "STOPPED"] } },
            { status: "ENDED", endedAt: new Date() }
        );

        return response(res, true, "Bus reset successfully", bus);
    } catch (err) {
        return response(res, false, "Failed to reset bus", {}, 500);
    }
});

module.exports = router;
