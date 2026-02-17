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

// Attach socket instance to app for use in HTTP routes
app.set("socketio", io);

const Tracking = require("./src/models/Tracking");
const Trip = require("./src/models/Trip");
const Bus = require("./src/models/Bus");

const trackingService = require("./src/services/tracking/trackingService");
const offlineDetectionService = require("./src/services/tracking/offlineDetectionService");
const logger = require("./src/utils/logger");

io.on("connection", (socket) => {
    logger.info(`[SOCKET] Connected: ${socket.id}`);

    socket.on("join-bus", (busId) => {
        if (busId) {
            socket.join(`bus-${busId}`);
            logger.info(`[SOCKET] User ${socket.id} joined bus room: bus-${busId}`);
        }
    });

    socket.on("join-trip", (tripId) => {
        if (tripId) {
            socket.join(`trip-${tripId}`);
            logger.info(`[SOCKET] User ${socket.id} joined trip room: trip-${tripId}`);
        }
    });

    socket.on("join-admin", () => {
        socket.join("admin-room");
        logger.info(`[SOCKET] Admin connected to global room: ${socket.id}`);
    });

    socket.on("driver-location-update", async (data) => {
        try {
            await trackingService.processLocationUpdate(io, data);
        } catch (err) {
            logger.error(`[SOCKET] Location Update Error: ${err.message}`);
        }
    });

    socket.on("disconnect", (reason) => {
        logger.info(`[SOCKET] Disconnected (${socket.id}): ${reason}`);
    });
});

// Start Background Services
offlineDetectionService.start(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
