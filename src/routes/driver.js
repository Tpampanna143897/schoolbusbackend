const router = require("express").Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");

const Trip = require("../models/Trip");
const Bus = require("../models/Bus");
const Student = require("../models/Student");
const Driver = require("../models/Driver");
const mongoose = require("mongoose");

/**
 * GET ALL ACTIVE BUSES FOR DRIVER
 */
router.get("/buses", auth, role("DRIVER"), async (req, res) => {
    try {
        const buses = await Bus.find({ isActive: true }).populate("defaultRoute");
        res.json(buses);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch buses" });
    }
});

/**
 * GET ACTIVE TRIP
 */
router.get("/active-trip", auth, role("DRIVER"), async (req, res) => {
    try {
        const trip = await Trip.findOne({
            driverId: req.user.id,
            status: { $in: ["STARTED", "STOPPED"] }
        })
            .populate("busId")
            .populate({
                path: "routeId",
                populate: { path: "stops" }
            });

        res.json(trip);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch active trip" });
    }
});

/**
 * SELECT BUS (LOCK BUS)
 */
router.post("/select-bus", auth, role("DRIVER"), async (req, res) => {
    try {
        const { busId, shift } = req.body;
        const driverId = req.user.id;

        const User = require("../models/User");
        const currentUser = await User.findById(driverId);

        const bus = await Bus.findOneAndUpdate(
            {
                _id: busId,
                $or: [
                    { assignedDrivers: driverId },
                    { _id: currentUser?.assignedBus }
                ],
                $or: [
                    { activeDriverId: null },
                    { activeDriverId: driverId }
                ]
            },
            {
                activeDriverId: driverId,
                status: "ONLINE"
            },
            { new: true }
        );

        if (!bus) {
            return res.status(409).json({ message: "Bus already active by another driver" });
        }

        await Driver.findOneAndUpdate(
            { userId: driverId },
            { busId, shift, isActive: true },
            { upsert: true }
        );

        res.json({ success: true, bus });
    } catch (err) {
        res.status(500).json({ message: "Failed to select bus" });
    }
});

/**
 * START TRIP
 */
router.post("/start-trip", auth, role("DRIVER"), async (req, res) => {
    try {
        const { busId, routeId, type } = req.body;

        if (!mongoose.Types.ObjectId.isValid(busId) || !mongoose.Types.ObjectId.isValid(routeId)) {
            return res.status(400).json({ message: "Invalid ID format" });
        }

        const bus = await Bus.findById(busId);
        if (!bus || !bus.activeDriverId || bus.activeDriverId.toString() !== req.user.id) {
            return res.status(403).json({ message: "Bus not locked by you" });
        }

        const existingTrip = await Trip.findOne({
            driverId: req.user.id,
            status: { $in: ["STARTED", "STOPPED"] }
        });

        if (existingTrip) {
            return res.status(400).json({ message: "You already have an active trip" });
        }

        const trip = await Trip.create({
            driverId: req.user.id,
            busId,
            routeId,
            type: type || "MORNING", // MORNING or EVENING
            status: "STARTED"
        });

        await Bus.findByIdAndUpdate(busId, {
            activeTrip: trip._id,
            status: "ONLINE"
        });

        await Student.updateMany(
            { assignedRoute: routeId },
            { activeTripId: trip._id, assignedBus: busId }
        );

        res.json({ success: true, tripId: trip._id });
    } catch (err) {
        res.status(500).json({ message: "Failed to start trip" });
    }
});

/**
 * STOP TRIP
 */
router.post("/stop-trip", auth, role("DRIVER"), async (req, res) => {
    try {
        const { tripId } = req.body;

        const trip = await Trip.findOneAndUpdate(
            { _id: tripId, driverId: req.user.id, status: "STARTED" },
            { status: "STOPPED", stoppedAt: new Date() },
            { new: true }
        );

        if (!trip) return res.status(404).json({ message: "Trip not found" });

        res.json({ success: true });
    } catch {
        res.status(500).json({ message: "Failed to stop trip" });
    }
});

/**
 * RESUME TRIP
 */
router.post("/resume-trip", auth, role("DRIVER"), async (req, res) => {
    try {
        const { tripId } = req.body;

        const trip = await Trip.findOneAndUpdate(
            { _id: tripId, driverId: req.user.id, status: "STOPPED" },
            { status: "STARTED", stoppedAt: null },
            { new: true }
        );

        if (!trip) return res.status(404).json({ message: "Trip not found" });

        res.json({ success: true });
    } catch {
        res.status(500).json({ message: "Failed to resume trip" });
    }
});

/**
 * END TRIP
 */
router.post("/end-trip", auth, role("DRIVER"), async (req, res) => {
    try {
        const driverId = req.user.id;

        // 1. Find and end any active trip
        const trip = await Trip.findOneAndUpdate(
            { driverId, status: { $in: ["STARTED", "STOPPED"] } },
            { status: "ENDED", endedAt: new Date() },
            { new: true }
        );

        // 2. ALWAYS clear the lock on any bus this driver was using
        // This handles cases where a driver selects a bus but never starts a trip
        const updatedBus = await Bus.findOneAndUpdate(
            { activeDriverId: driverId },
            {
                activeTrip: null,
                activeDriverId: null,
                status: "OFFLINE",
                speed: 0
            }
        );

        if (trip) {
            // If there was a trip, also update student status
            await Student.updateMany(
                { activeTripId: trip._id },
                { activeTripId: null }
            );
        }

        // 3. Reset driver status
        await Driver.findOneAndUpdate(
            { userId: driverId },
            { isActive: false, busId: null }
        );

        res.json({ success: true, message: "Session ended and bus released" });
    } catch (err) {
        console.error("END TRIP ERROR:", err);
        res.status(500).json({ message: "Failed to end trip or release bus" });
    }
});

/**
 * RESET BUS (Force Release by authorized driver)
 */
router.post("/reset-bus", auth, role("DRIVER"), async (req, res) => {
    try {
        const { busId } = req.body;
        const driverId = req.user.id;

        const User = require("../models/User");
        const currentUser = await User.findById(driverId);

        // Security Check: Only allow if driver is assigned to this bus
        const isAssigned = await Bus.findOne({
            _id: busId,
            $or: [
                { assignedDrivers: driverId },
                { _id: currentUser?.assignedBus }
            ]
        });

        if (!isAssigned) {
            return res.status(403).json({ message: "You are not authorized to reset this bus." });
        }

        const bus = await Bus.findByIdAndUpdate(busId, {
            activeTrip: null,
            activeDriverId: null,
            status: "OFFLINE",
            speed: 0
        }, { new: true });

        // End any associated trips
        await Trip.updateMany(
            { busId, status: { $in: ["STARTED", "STOPPED"] } },
            { status: "ENDED", endedAt: new Date() }
        );

        res.json({ success: true, message: "Bus force-released successfully", bus });
    } catch (err) {
        res.status(500).json({ message: "Failed to reset bus: " + err.message });
    }
});

module.exports = router;
