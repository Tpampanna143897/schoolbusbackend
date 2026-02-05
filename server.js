require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");

const app = require("./src/app");
const connectDB = require("./src/config/db");

connectDB();

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["polling", "websocket"], // Support polling for Render free tier
    allowEIO3: true
});

const Tracking = require("./src/models/Tracking");
const Trip = require("./src/models/Trip");
const Bus = require("./src/models/Bus");

io.on("connection", (socket) => {
    console.log("[SOCKET] Connected:", socket.id);

    // 1) JOIN BUS ROOM (Parents/Teachers follow specific bus)
    socket.on("join-bus", (busId) => {
        if (busId) {
            socket.join(`bus-${busId}`);
            console.log(`[SOCKET] User ${socket.id} joined room: bus-${busId}`);
        }
    });

    // 1b) JOIN TRIP ROOM (Direct trip follow)
    socket.on("join-trip", (tripId) => {
        if (tripId) {
            socket.join(`trip-${tripId}`);
            console.log(`[SOCKET] User ${socket.id} joined room: trip-${tripId}`);
        }
    });

    // 2) JOIN ADMIN ROOM (Fleet overview)
    socket.on("join-admin", () => {
        socket.join("admin-room");
        console.log(`[SOCKET] Admin ${socket.id} joined admin-room`);
    });

    // 3) DRIVER LOCATION UPDATE (The heart of the tracking)
    socket.on("driver-location-update", async (data) => {
        try {
            const { tripId, busId, driverId, lat, lng, speed, heading } = data;

            console.log(`[SOCKET] Update attempt from Driver:${driverId} for Bus:${busId}`);

            // SAFEGUARDS: Block invalid data
            if (!tripId || !busId || !driverId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
                console.warn("[SOCKET] Rejected invalid location payload:", data);
                return;
            }

            // AUTHORIZATION: Only accept updates from the active driver
            const bus = await Bus.findById(busId);
            if (!bus) {
                console.warn(`[SOCKET] Bus not found: ${busId}`);
                return;
            }

            if (!bus.activeDriverId || bus.activeDriverId.toString() !== driverId) {
                console.warn(`[SOCKET] AUTH BLOCKED: Driver:${driverId} is NOT the active driver for Bus:${busId}. Active is: ${bus.activeDriverId}`);
                return;
            }

            // A) SAVE TO DATABASE (Only place this happens now)
            await Tracking.create({
                tripId,
                lat,
                lng,
                speed: speed || 0,
                timestamp: new Date()
            });

            // B) UPDATE BUS METADATA
            await Bus.findByIdAndUpdate(busId, {
                lastLocationAt: new Date(),
                status: "ONLINE",
                speed: speed || 0
            });

            // C) BROADCAST TO ROOMS
            const payload = {
                tripId,
                busId,
                lat,
                lng,
                speed: speed || 0,
                heading: heading || 0,
                time: new Date()
            };

            io.to(`bus-${busId}`).emit("trip-location", payload);
            io.to(`trip-${tripId}`).emit("trip-location", payload);
            io.to("admin-room").emit("trip-location", payload);

            console.log(`[SOCKET] Success: Broadcasted location for Trip:${tripId}`);

        } catch (err) {
            console.error("[SOCKET] Tracking error:", err.message);
        }
    });

    socket.on("disconnect", (reason) => {
        console.log(`[SOCKET] Disconnected (${socket.id}):`, reason);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
