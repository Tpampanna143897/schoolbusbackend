const { redis, cacheTTL } = require("../../config/redis");
const LiveLocation = require("../../models/LiveLocation");
const Tracking = require("../../models/Tracking");
const Trip = require("../../models/Trip");
const StopVisit = require("../../models/StopVisit");
const Attendance = require("../../models/Attendance");
const Student = require("../../models/Student");
const geofenceService = require("../geofencing/geofenceService");
const logger = require("../../utils/logger");
const moment = require("moment");

class TrackingService {
    /**
     * Cache route stops in Redis when trip starts
     */
    /**
     * Cache route stops in Redis when trip starts
     */
    async cacheRouteStops(tripId, stops) {
        const key = `trip:${tripId}:stops`;
        const nextIndexKey = `trip:${tripId}:next_stop_index`;
        await Promise.all([
            redis.set(key, JSON.stringify(stops), "EX", cacheTTL.TRIP_CACHE),
            redis.set(nextIndexKey, 0, "EX", cacheTTL.TRIP_CACHE) // Initialize with first stop
        ]);
        logger.info(`[REDIS] Cached ${stops.length} stops and initialized progression for trip: ${tripId}`);
    }

    /**
     * Process incoming coordinate from driver
     */
    async processLocationUpdate(io, data) {
        const { tripId, busId, driverId, lat, lng, speed, heading } = data;
        const now = new Date();

        try {
            // 1. Update Redis cache for immediate real-time reads (API/Socket)
            const redisKey = `trip:${tripId}:live`;
            const payload = { ...data, timestamp: now };
            await redis.set(redisKey, JSON.stringify(payload), "EX", cacheTTL.GPS_CACHE);

            // 2. Fetch cached stops and stop-states from Redis
            const stopsKey = `trip:${tripId}:stops`;
            const stateKey = `trip:${tripId}:state`;
            const nextIndexKey = `trip:${tripId}:next_stop_index`;

            const [stopsJson, stateJson, nextStopIndexStr] = await Promise.all([
                redis.get(stopsKey),
                redis.get(stateKey),
                redis.get(nextIndexKey)
            ]);

            const stops = stopsJson ? JSON.parse(stopsJson) : [];
            const previousState = stateJson ? JSON.parse(stateJson) : {};
            let nextStopIndex = nextStopIndexStr !== null ? parseInt(nextStopIndexStr, 10) : 0;

            // 3. Perform Geofencing Check
            const geofenceResult = await geofenceService.checkStopStatus({ lat, lng }, stops, previousState);

            // 4. Handle Geofence Events (Arrived/Departed)
            if (geofenceResult.arrived.length > 0 || geofenceResult.departed.length > 0) {
                await redis.set(stateKey, JSON.stringify(geofenceResult.currentState), "EX", cacheTTL.STOP_STATE);

                for (const stop of geofenceResult.arrived) {
                    const stopId = stop._id.toString();
                    const date = moment(now).format("YYYY-MM-DD");
                    const stopIndex = stops.findIndex(s => s._id.toString() === stopId);

                    const attendanceLockKey = `trip:${tripId}:stop:${stopId}:attendance:${date}`;

                    // a) Check Redis Lock to prevent duplicate marking
                    const isAlreadyMarked = await redis.get(attendanceLockKey);

                    if (!isAlreadyMarked) {
                        // b) Record Stop Visit (Bus arrival)
                        await StopVisit.findOneAndUpdate(
                            { tripId, stopId },
                            { stopName: stop.name, arrivalTime: now },
                            { upsert: true }
                        );

                        // c) Set Redis Lock (TTL 24h)
                        await redis.set(attendanceLockKey, "MARKED", "EX", 86400);

                        // Update Progression: If this is the "next" stop or later, advance the index
                        if (stopIndex >= nextStopIndex) {
                            nextStopIndex = stopIndex + 1;
                            await redis.set(nextIndexKey, nextStopIndex, "EX", cacheTTL.TRIP_CACHE);

                            io.to(`trip-${tripId}`).emit("stopProgressed", {
                                nextStopIndex,
                                remainingStops: stops.length - nextStopIndex,
                                lastVisitedStop: stop.name
                            });
                        }

                        // d) Mark Student Attendance
                        const trip = await Trip.findById(tripId);
                        const status = trip.type === "MORNING" ? "PICKED" : "DROPPED";

                        // Find all students assigned to this stop
                        const studentsAtStop = await Student.find({ assignedStop: stopId });

                        if (studentsAtStop.length > 0) {
                            const attendanceRecords = studentsAtStop.map(student => ({
                                studentId: student._id,
                                tripId,
                                date,
                                status,
                                [status === "PICKED" ? "pickupTime" : "dropTime"]: now,
                                [status === "PICKED" ? "pickupLat" : "dropLat"]: lat,
                                [status === "PICKED" ? "pickupLng" : "dropLng"]: lng
                            }));

                            // Bulk upsert attendance records
                            for (const record of attendanceRecords) {
                                await Attendance.findOneAndUpdate(
                                    { studentId: record.studentId, date: record.date },
                                    { $set: record },
                                    { upsert: true }
                                );
                            }

                            logger.info(`[ATTENDANCE] Marked ${status} for ${studentsAtStop.length} students at stop: ${stop.name}`);
                            io.to(`trip-${tripId}`).emit("attendanceMarked", { stopId, studentCount: studentsAtStop.length, status });
                        }

                        // Trigger socket events
                        io.to(`trip-${tripId}`).emit("stopArrived", { stopId, name: stop.name, time: now });
                        logger.info(`[GEOFENCE] Arrived at stop: ${stop.name} for trip: ${tripId}`);
                    }
                }

                for (const stop of geofenceResult.departed) {
                    const stopId = stop._id.toString();

                    // a) Record Stop Departure
                    await StopVisit.findOneAndUpdate(
                        { tripId, stopId },
                        { departureTime: now }
                    );

                    io.to(`trip-${tripId}`).emit("stopDeparted", { stopId, name: stop.name, time: now });
                    logger.info(`[GEOFENCE] Departed from stop: ${stop.name} for trip: ${tripId}`);
                }
            }

            // 5. ETA Calculation (Simple distance-based)
            let eta = null;
            if (nextStopIndex < stops.length) {
                const nextStop = stops[nextStopIndex];
                const distance = geofenceService.getDistance(lat, lng, nextStop.lat, nextStop.lng);
                // Rough estimate: distance (m) / speed (m/s). Avg speed 30km/h = 8.3m/s.
                // Using 5m/s (18km/h) for cautious city traffic estimation.
                const speedInMs = speed > 0 ? (speed * 1000) / 3600 : 5;
                eta = Math.ceil(distance / speedInMs / 60); // minutes
                payload.eta = eta;
                payload.nextStop = nextStop.name;
            }

            // 6. Upsert into MongoDB LiveLocation (Operational DB)
            const liveDoc = await LiveLocation.findOneAndUpdate(
                { tripId },
                {
                    busId,
                    driverId,
                    coordinates: { lat, lng },
                    speed,
                    heading,
                    status: "ONLINE",
                    lastUpdate: now,
                    // Extension: store ETA/Progression in DB too for persistence
                    nextStopIndex,
                    eta
                },
                { upsert: true, new: true }
            );

            // 7. Conditional Throttling: Save to history only every 30 seconds
            if (now >= liveDoc.nextHistoryUpdate) {
                await Tracking.create({
                    tripId,
                    lat,
                    lng,
                    speed: speed || 0,
                    timestamp: now
                });

                // Update next history interval (+30s)
                liveDoc.nextHistoryUpdate = new Date(now.getTime() + 30000);
                await liveDoc.save();
                logger.debug(`[HISTORIC] Saved tracking point for trip: ${tripId}`);
            }

            // 8. Emit live location to global listeners
            io.to(`trip-${tripId}`).emit("busLocation", payload);
            io.to(`bus-${busId}`).emit("busLocation", payload);
            io.to("admin-room").emit("busLocation", payload);

        } catch (err) {
            logger.error(`[TRACKING SERVICE] Process Error: ${err.message}`);
            throw err;
        }
    }

    async initializeTripLocation(tripId, busId, driverId, lat, lng) {
        if (!lat || !lng) return;
        const now = new Date();
        try {
            // 1. Redis Initialization
            const redisKey = `trip:${tripId}:live`;
            const payload = { tripId, busId, driverId, lat, lng, speed: 0, heading: 0, timestamp: now };
            await redis.set(redisKey, JSON.stringify(payload), "EX", cacheTTL.GPS_CACHE);

            // 2. MongoDB Initialization (LiveLocation)
            await LiveLocation.findOneAndUpdate(
                { tripId },
                {
                    busId,
                    driverId,
                    coordinates: { lat, lng },
                    speed: 0,
                    heading: 0,
                    status: "ONLINE",
                    lastUpdate: now,
                    nextStopIndex: 0
                },
                { upsert: true, new: true }
            );

            // 3. Historical Initialization
            await Tracking.create({
                tripId,
                lat,
                lng,
                speed: 0,
                timestamp: now
            });

            logger.info(`[TRACKING] Initialized location for trip: ${tripId} at (${lat}, ${lng})`);
        } catch (err) {
            logger.error(`[TRACKING] Failed to initialize location: ${err.message}`);
        }
    }

    async clearTripCache(tripId) {
        const keys = [
            `trip:${tripId}:live`,
            `trip:${tripId}:stops`,
            `trip:${tripId}:state`,
            `trip:${tripId}:next_stop_index`
        ];
        await redis.del(...keys);
        logger.info(`[REDIS] Cleared cache for trip: ${tripId}`);
    }
}

module.exports = new TrackingService();
