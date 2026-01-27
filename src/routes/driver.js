const router = require("express").Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const Trip = require("../models/Trip");
const Bus = require("../models/Bus");
const Student = require("../models/Student");

/**
 * GET ALL BUSES FOR DRIVER
 * Returns only active buses
 */
router.get("/buses", auth, role("DRIVER"), async (req, res) => {
    try {
        console.log("DRIVER FETCH BUSES REQUEST");
        const buses = await Bus.find({ isActive: true }).populate("defaultRoute");
        console.log(`FOUND ${buses.length} ACTIVE BUSES`);
        res.json(buses);
    } catch (err) {
        console.error("FETCH BUSES ERR:", err.message);
        res.status(500).json({ message: "Failed to fetch buses" });
    }
});

/**
 * GET ACTIVE TRIP
 */
router.get("/active-trip", auth, role("DRIVER"), async (req, res) => {
    try {
        console.log(`CHECKING ACTIVE TRIP FOR DRIVER: ${req.user.id}`);
        // Include both STARTED and STOPPED (paused) trips in active session check
        const trip = await Trip.findOne({
            driverId: req.user.id,
            status: { $in: ["STARTED", "STOPPED"] }
        })
            .populate("busId")
            .populate({
                path: "routeId",
                populate: { path: "stops" } // Optional: populate stops if needed
            });

        if (trip) console.log(`ACTIVE TRIP FOUND: ${trip._id}`);
        else console.log("NO ACTIVE TRIP FOUND");

        res.json(trip);
    } catch (err) {
        console.error("FETCH ACTIVE TRIP ERR:", err.message);
        res.status(500).json({ message: "Failed to fetch active trip" });
    }
});

/**
 * START TRIP
 * Payload: { busId, routeId }
 */
router.post("/start-trip", auth, role("DRIVER"), async (req, res) => {
    try {
        const { busId, routeId } = req.body;
        const mongoose = require("mongoose");
        console.log("START TRIP REQUEST:", req.body);

        if (!mongoose.Types.ObjectId.isValid(busId) || !mongoose.Types.ObjectId.isValid(routeId)) {
            return res.status(400).json({ message: "Invalid Bus or Route ID format" });
        }

        // 4) Verify active driver lock
        const bus = await Bus.findById(busId);
        if (!bus || !bus.activeDriver || bus.activeDriver.toString() !== req.user.id) {
            return res.status(403).json({ message: "You must select the bus first to lock it." });
        }

        // Check if driver is already in a trip
        const activeTrip = await Trip.findOne({ driverId: req.user.id, status: "STARTED" });
        if (activeTrip) {
            console.warn("DRIVER ALREADY IN TRIP:", activeTrip._id);
            return res.status(400).json({ message: "You already have an active trip." });
        }

        const trip = await Trip.create({
            driverId: req.user.id,
            busId: busId,
            routeId: routeId
        });

        console.log("TRIP CREATED:", trip._id);

        // Update Bus
        await Bus.findByIdAndUpdate(busId, { activeTrip: trip._id, status: "ONLINE" });

        // Auto-assign students
        const updateResult = await Student.updateMany(
            { assignedRoute: routeId },
            {
                activeTripId: trip._id,
                assignedBus: busId
            }
        );

        console.log(`ASSIGNED ${updateResult.modifiedCount} STUDENTS TO TRIP`);

        res.json({ success: true, tripId: trip._id });
    } catch (err) {
        console.error("Start trip error:", err);
        res.status(500).json({ message: "Failed to start trip: " + err.message });
    }
});

/**
 * STOP TRIP (Pause)
 */
router.post("/stop-trip", auth, role("DRIVER"), async (req, res) => {
    try {
        const { tripId } = req.body;
        const trip = await Trip.findOneAndUpdate(
            { _id: tripId, driverId: req.user.id, status: "STARTED" },
            { status: "STOPPED", stoppedAt: new Date() },
            { new: true }
        );

        if (!trip) return res.status(404).json({ message: "Active trip not found to stop" });

        console.log("TRIP STOPPED:", tripId);
        res.json({ success: true, status: "STOPPED" });
    } catch (err) {
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

        if (!trip) return res.status(404).json({ message: "Stopped trip not found to resume" });

        console.log("TRIP RESUMED:", tripId);
        res.json({ success: true, status: "STARTED" });
    } catch (err) {
        res.status(500).json({ message: "Failed to resume trip" });
    }
});

const Driver = require("../models/Driver");

/**
 * SELECT BUS (Lock bus for session)
 * Payload: { busId, shift }
 */
router.post("/select-bus", auth, role("DRIVER"), async (req, res) => {
    try {
        const { busId, shift } = req.body;
        const driverId = req.user.id;

        // 5) Prevent race conditions using atomic update
        // 3) Lock bus so only one driver can activate it
        const bus = await Bus.findOneAndUpdate(
            { _id: busId, $or: [{ activeDriver: null }, { activeDriver: driverId }] },
            { activeDriver: driverId, status: "ONLINE" },
            { new: true }
        );

        if (!bus) {
            // 3) Return 409 if another driver is active
            return res.status(409).json({ message: "Bus is already active by another driver." });
        }

        // 2) Update driver status
        await Driver.findOneAndUpdate(
            { userId: driverId },
            { busId, shift, isActive: true },
            { upsert: true }
        );

        res.json({ success: true, bus });
    } catch (err) {
        console.error("SELECT BUS ERR:", err.message);
        res.status(500).json({ message: "Failed to select bus" });
    }
});

/**
 * END TRIP (Release bus)
 */
router.post("/end-trip", auth, role("DRIVER"), async (req, res) => {
    try {
        const { tripId } = req.body;
        const driverId = req.user.id;
        console.log("END TRIP REQUEST for:", tripId || "ANY ACTIVE SESSION");

        const query = {
            driverId: driverId,
            status: { $in: ["STARTED", "STOPPED"] }
        };
        if (tripId) query._id = tripId;

        const trip = await Trip.findOneAndUpdate(
            query,
            { status: "ENDED", endedAt: new Date() },
            { new: true }
        );

        if (!trip) {
            // Even if no trip, we should still ensure bus is released if the driver calls this
            const bus = await Bus.findOne({ activeDriver: driverId });
            if (bus) {
                bus.activeDriver = null;
                bus.status = "OFFLINE";
                await bus.save();
            }
            await Driver.findOneAndUpdate({ userId: driverId }, { isActive: false });
            return res.json({ success: true, message: "Bus released (no active trip found)" });
        }

        console.log("TRIP ENDED:", trip._id);

        // 3) Release the bus when driver logs out or trip ends
        await Bus.findByIdAndUpdate(trip.busId, { activeTrip: null, activeDriver: null, status: "OFFLINE" });

        // Update Driver status
        await Driver.findOneAndUpdate({ userId: driverId }, { isActive: false });

        // Cleanup Students
        await Student.updateMany(
            { activeTripId: trip._id },
            { activeTripId: null }
        );

        res.json({ success: true });
    } catch (err) {
        console.error("End trip error:", err);
        res.status(500).json({ message: "Failed to end trip" });
    }
});

module.exports = router;
