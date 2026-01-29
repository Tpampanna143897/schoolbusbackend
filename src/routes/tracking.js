const router = require("express").Router();
const auth = require("../middleware/auth");
const Tracking = require("../models/Tracking");
const Trip = require("../models/Trip");
const Bus = require("../models/Bus");

/**
 * UPDATE LOCATION
 * Payload: { tripId, lat, lng, speed }
 */
router.post("/update", auth, async (req, res) => {
    try {
        const { tripId, lat, lng, speed, heading } = req.body;

        if (!tripId || typeof lat !== 'number' || typeof lng !== 'number') {
            return res.status(400).json({ message: "Invalid tracking data" });
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ message: "Coordinates out of bounds (-90 to 90 lat, -180 to 180 lng)" });
        }

        const trip = await Trip.findById(tripId);
        if (!trip || trip.status === "ENDED") {
            return res.status(404).json({ message: "Trip not found or already ended" });
        }

        if (trip.status === "STOPPED") {
            return res.status(400).json({ message: "Tracking paused. Trip is currently STOPPED." });
        }

        console.log(`[ANALYSE] Tracking coordinate received for Trip:${tripId} | Lat:${lat} Lng:${lng} | Speed:${speed}`);

        const tracking = await Tracking.create({
            tripId,
            lat,
            lng,
            speed: speed || 0,
            timestamp: new Date()
        });

        // Update Bus for quick overview
        await Bus.findByIdAndUpdate(trip.busId, {
            lastLocationAt: new Date(),
            status: "ONLINE",
            speed: speed || 0
        });

        // Broadcast to parents
        global.io.emit("trip-location", {
            tripId,
            busId: trip.busId,
            lat,
            lng,
            speed: speed || 0,
            heading: heading || 0,
            mode: trip.type, // Include the trip type (MORNING/EVENING)
            time: new Date()
        });

        res.json({ success: true, trackingId: tracking._id });
    } catch (err) {
        console.error("Tracking update error:", err);
        res.status(500).json({ message: "Tracking update failed" });
    }
});

/**
 * GET LATEST BUS LOCATION by busId
 */
router.get("/bus-location/:busId", auth, async (req, res) => {
    try {
        const { busId } = req.params;

        // Find the active trip for this bus
        const activeTrip = await Trip.findOne({ busId, status: "STARTED" });

        // Find latest tracking record for this bus (across any trip)
        // Note: Tracking only stores tripId, so we need to find trips for this bus first.
        const busTrips = await Trip.find({ busId }).select("_id");
        const tripIds = busTrips.map(t => t._id);

        const latestLocation = await Tracking.findOne({ tripId: { $in: tripIds } })
            .sort({ timestamp: -1 });

        if (!latestLocation) {
            const bus = await Bus.findById(busId);
            return res.status(200).json({
                message: "No location history for this bus",
                status: bus?.status || "OFFLINE",
                isLive: !!activeTrip
            });
        }

        res.json({
            ...latestLocation.toObject(),
            isLive: !!activeTrip,
            status: "ONLINE"
        });
    } catch (err) {
        console.error("Bus location fetch error:", err);
        res.status(500).json({ message: "Failed to fetch bus location" });
    }
});

module.exports = router;
