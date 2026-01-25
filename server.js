require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");

const app = require("./src/app");
const connectDB = require("./src/config/db");

connectDB();

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
    pingTimeout: 30000,
    pingInterval: 10000,
});


const Tracking = require("./src/models/Tracking");
const Trip = require("./src/models/Trip");
const Bus = require("./src/models/Bus");

io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // Listen for live coordinates from driver side
    socket.on("driver-location-update", async (data) => {
        try {
            const { tripId, lat, lng, speed, heading } = data;
            if (!tripId || typeof lat !== 'number' || typeof lng !== 'number') return;

            // Analyse and save to backend data store (Requested logic)
            const tracking = await Tracking.create({
                tripId,
                lat,
                lng,
                speed: speed || 0,
                timestamp: new Date()
            });

            // Re-fetch trip to get bus information for broadcasting
            const trip = await Trip.findById(tripId).select("busId");
            if (trip) {
                // Update Bus status
                await Bus.findByIdAndUpdate(trip.busId, {
                    lastLocationAt: new Date(),
                    status: "ONLINE",
                    speed: speed || 0
                });

                // Broadcast to everyone (Parents & Admin)
                io.emit("trip-location", {
                    tripId,
                    busId: trip.busId,
                    lat,
                    lng,
                    speed: speed || 0,
                    heading: heading || 0,
                    time: new Date()
                });

                // console.log(`[SOCKET] Live update processed for Trip: ${tripId}`);
            }
        } catch (err) {
            console.error("Socket tracking error:", err.message);
        }
    });

    socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id);
    });
});

server.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
