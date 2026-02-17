const LiveLocation = require("../../models/LiveLocation");
const logger = require("../../utils/logger");

class OfflineDetectionService {
    async start(io) {
        // Run every 30 seconds
        setInterval(async () => {
            try {
                const thirtySecondsAgo = new Date(Date.now() - 30000);

                // Find active trips that haven't updated in 30s
                const offlineTrips = await LiveLocation.find({
                    lastUpdate: { $lt: thirtySecondsAgo },
                    status: "ONLINE"
                });

                if (offlineTrips.length > 0) {
                    const ids = offlineTrips.map(t => t.tripId);

                    await LiveLocation.updateMany(
                        { tripId: { $in: ids } },
                        { $set: { status: "OFFLINE" } }
                    );

                    offlineTrips.forEach(trip => {
                        io.to(`trip-${trip.tripId}`).emit("busOffline", { tripId: trip.tripId, time: new Date() });
                        logger.warn(`[OFFLINE] Trip ${trip.tripId} detected as OFFLINE`);
                    });
                }
            } catch (err) {
                logger.error(`[OFFLINE SERVICE] Error: ${err.message}`);
            }
        }, 30000);
    }
}

module.exports = new OfflineDetectionService();
