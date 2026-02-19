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
    /**
     * Process incoming coordinate from driver
     */
    async processLocationUpdate(io, data) {
        const { tripId, busId, driverId, lat, lng, speed, heading } = data;
        const now = new Date();

        try {
            // 1. Redis Pipeline for high-frequency operations
            const pipeline = redis.pipeline();
            const keys = {
                live: `trip:${tripId}:live`,
                stops: `trip:${tripId}:stops`,
                state: `trip:${tripId}:state`,
                nextIndex: `trip:${tripId}:next_stop_index`
            };

            const payload = { ...data, timestamp: now };
            pipeline.set(keys.live, JSON.stringify(payload), "EX", cacheTTL.GPS_CACHE);
            pipeline.get(keys.stops);
            pipeline.get(keys.state);
            pipeline.get(keys.nextIndex);

            const redisResults = await pipeline.exec();
            const stops = redisResults[1][1] ? JSON.parse(redisResults[1][1]) : [];
            const previousState = redisResults[2][1] ? JSON.parse(redisResults[2][1]) : {};
            let nextStopIndex = redisResults[3][1] !== null ? parseInt(redisResults[3][1], 10) : 0;

            // 2. Perform Geofencing & Auto-Skip Logic
            const geofenceResult = await geofenceService.checkStopStatus({ lat, lng }, stops, previousState);

            // Auto-Skip Check: If we are significantly closer to the SUBSEQUENT stop, advance automatically
            if (nextStopIndex < stops.length - 1) {
                const currentNext = stops[nextStopIndex];
                const subsequent = stops[nextStopIndex + 1];

                const distToNext = geofenceService.getDistance(lat, lng, currentNext.lat, currentNext.lng);
                const distToSub = geofenceService.getDistance(lat, lng, subsequent.lat, subsequent.lng);

                // If we've passed the current next stop and are within range of the next-next one
                if (distToSub < distToNext && distToSub < (subsequent.radius || 100)) {
                    logger.info(`[AUTO-SKIP] Advancement detected for trip: ${tripId}. Skipping index ${nextStopIndex}`);
                    nextStopIndex++;
                    await redis.set(keys.nextIndex, nextStopIndex, "EX", cacheTTL.TRIP_CACHE);
                }
            }

            // 3. Handle Geofence Events (Arrived/Departed)
            if (geofenceResult.arrived.length > 0 || geofenceResult.departed.length > 0) {
                await redis.set(keys.state, JSON.stringify(geofenceResult.currentState), "EX", cacheTTL.STOP_STATE);

                for (const stop of geofenceResult.arrived) {
                    await this.handleStopArrival(io, tripId, stop, stops, nextStopIndex, lat, lng, now);
                }

                for (const stop of geofenceResult.departed) {
                    await this.handleStopDeparture(io, tripId, stop, now);
                }
            }

            // 4. ETA Calculation
            let eta = null;
            if (nextStopIndex < stops.length) {
                const nextStop = stops[nextStopIndex];
                const distance = geofenceService.getDistance(lat, lng, nextStop.lat, nextStop.lng);
                const speedInMs = speed > 0 ? (speed * 1000) / 3600 : 5; // Fallback to 5m/s
                eta = Math.ceil(distance / speedInMs / 60);
                payload.eta = eta;
                payload.nextStop = nextStop.name;
                payload.nextStopIndex = nextStopIndex;
            }

            // 5. Throttled Persistence & Status Sync
            await this.persistOperationalData(tripId, busId, driverId, lat, lng, speed, heading, nextStopIndex, eta, now);

            // 6. Broadcast Updates
            io.to(`trip-${tripId}`).emit("busLocation", payload);
            io.to(`bus-${busId}`).emit("busLocation", payload);
            io.to("admin-room").emit("busLocation", payload);

        } catch (err) {
            logger.error(`[TRACKING SERVICE] Process Error: ${err.message}`);
            throw err;
        }
    }

    /**
     * Internal Handlers for cleaner logic
     */
    async handleStopArrival(io, tripId, stop, stops, nextStopIndex, lat, lng, now) {
        const stopId = stop._id.toString();
        const stopIndex = stops.findIndex(s => s._id.toString() === stopId);
        const date = moment(now).format("YYYY-MM-DD");
        const lockKey = `trip:${tripId}:stop:${stopId}:lock:${date}`;

        const isMarked = await redis.get(lockKey);
        if (isMarked) return;

        // Mark Stop Visit
        await StopVisit.findOneAndUpdate({ tripId, stopId }, { stopName: stop.name, arrivalTime: now }, { upsert: true });
        await redis.set(lockKey, "1", "EX", 86400);

        // Update Backend Progression if needed
        if (stopIndex >= nextStopIndex) {
            const newIndex = stopIndex + 1;
            await redis.set(`trip:${tripId}:next_stop_index`, newIndex, "EX", cacheTTL.TRIP_CACHE);
            io.to(`trip-${tripId}`).emit("stopProgressed", { nextStopIndex: newIndex, lastVisitedStop: stop.name });
        }

        // Attendance Logic
        const trip = await Trip.findById(tripId);
        const status = trip.type === "MORNING" ? "PICKED" : "DROPPED";
        const students = await Student.find({ assignedStop: stopId });

        if (students.length > 0) {
            const attendanceRecords = students.map(s => ({
                studentId: s._id, tripId, date, status,
                [status === "PICKED" ? "pickupTime" : "dropTime"]: now,
                [status === "PICKED" ? "pickupLat" : "dropLat"]: lat,
                [status === "PICKED" ? "pickupLng" : "dropLng"]: lng
            }));

            for (const record of attendanceRecords) {
                await Attendance.findOneAndUpdate({ studentId: record.studentId, date: record.date }, { $set: record }, { upsert: true });
            }
            io.to(`trip-${tripId}`).emit("attendanceMarked", { stopId, studentCount: students.length, status });
        }

        io.to(`trip-${tripId}`).emit("stopArrived", { stopId, name: stop.name, time: now });
        logger.info(`[GEOFENCE] Arrival at ${stop.name} (${tripId})`);
    }

    async handleStopDeparture(io, tripId, stop, now) {
        await StopVisit.findOneAndUpdate({ tripId, stopId: stop._id }, { departureTime: now });
        io.to(`trip-${tripId}`).emit("stopDeparted", { stopId: stop._id, name: stop.name, time: now });
    }

    async persistOperationalData(tripId, busId, driverId, lat, lng, speed, heading, nextStopIndex, eta, now) {
        const liveDoc = await LiveLocation.findOneAndUpdate(
            { tripId },
            { busId, driverId, coordinates: { lat, lng }, speed, heading, status: "ONLINE", lastUpdate: now, nextStopIndex, eta },
            { upsert: true, new: true }
        );

        // Throttle historical tracking to 30s
        if (now >= liveDoc.nextHistoryUpdate) {
            await Tracking.create({ tripId, lat, lng, speed: speed || 0, timestamp: now });
            liveDoc.nextHistoryUpdate = new Date(now.getTime() + 30000);
            await liveDoc.save();
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
