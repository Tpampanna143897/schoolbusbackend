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

        const bus = await Bus.findOneAndUpdate(
            {
                _id: busId,
                assignedDrivers: driverId,
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

        const trip = await Trip.findOneAndUpdate(
            { driverId, status: { $in: ["STARTED", "STOPPED"] } },
            { status: "ENDED", endedAt: new Date() },
            { new: true }
        );

        if (trip) {
            await Bus.findByIdAndUpdate(trip.busId, {
                activeTrip: null,
                activeDriverId: null,
                status: "OFFLINE"
            });

            await Student.updateMany(
                { activeTripId: trip._id },
                { activeTripId: null }
            );
        }

        await Driver.findOneAndUpdate(
            { userId: driverId },
            { isActive: false }
        );

        res.json({ success: true });
    } catch {
        res.status(500).json({ message: "Failed to end trip" });
    }
});

module.exports = router;
