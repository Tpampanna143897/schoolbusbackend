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

/**
 * END TRIP
 */
router.post("/end-trip", auth, role("DRIVER"), async (req, res) => {
    try {
        const { tripId } = req.body;
        console.log("END TRIP REQUEST for:", tripId || "ANY ACTIVE SESSION");

        // Build query to find trip to end. 
        // If tripId is provided, use it; otherwise find any active session for this driver.
        const query = {
            driverId: req.user.id,
            status: { $in: ["STARTED", "STOPPED"] }
        };
        if (tripId) query._id = tripId;

        const trip = await Trip.findOneAndUpdate(
            query,
            { status: "ENDED", endedAt: new Date() },
            { new: true }
        );

        if (!trip) {
            return res.status(404).json({ message: "No active or paused trip found to end" });
        }

        console.log("TRIP ENDED:", trip._id);

        // Cleanup Bus
        await Bus.findByIdAndUpdate(trip.busId, { activeTrip: null, status: "OFFLINE" });

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
