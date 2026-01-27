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

    // Join room for specific bus (Parents and Admins)
    socket.on("join-bus", (busId) => {
        if (busId) {
            socket.join(`bus-${busId}`);
            console.log(`Socket ${socket.id} joined room bus-${busId}`);
        }
    });

    // Listen for live coordinates from driver side
    socket.on("driver-location-update", async (data) => {
        try {
            const { tripId, busId, lat, lng, speed, heading, driverId } = data;

            // 4) Add GPS emit safeguards: Never emit undefined latitude/longitude
            if (!tripId || !busId || typeof lat !== 'number' || typeof lng !== 'number') {
                console.warn("[SOCKET] Invalid payload received:", data);
                return;
            }

            // 2) Implement backend Socket.IO handling: Blocks invalid lat/lng payloads
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                console.warn("[SOCKET] Invalid coordinates:", lat, lng);
                return;
            }

            // 4) Update Socket.IO logic: Only accept GPS from the active driver
            const bus = await Bus.findById(busId);
            if (!bus || !bus.activeDriver || bus.activeDriver.toString() !== driverId) {
                console.warn(`[SOCKET] Blocked update from non-active driver ${driverId} for bus ${busId}`);
                return;
            }

            // Save to backend data store
            const tracking = await Tracking.create({
                tripId,
                lat,
                lng,
                speed: speed || 0,
                timestamp: new Date()
            });

            // Update Bus status
            await Bus.findByIdAndUpdate(busId, {
                lastLocationAt: new Date(),
                status: "ONLINE",
                speed: speed || 0
            });

            // 2) Broadcasts only to parents watching that bus (Room-based)
            io.to(`bus-${busId}`).emit("trip-location", {
                tripId,
                busId,
                lat,
                lng,
                speed: speed || 0,
                heading: heading || 0,
                time: new Date()
            });

            // Also broadcast to admin global room if needed (optional)
            io.to("admin-room").emit("trip-location", {
                tripId,
                busId,
                lat,
                lng,
                speed: speed || 0,
                heading: heading || 0,
                time: new Date()
            });

        } catch (err) {
            console.error("Socket tracking error:", err.message);
        }
    });

    // Admin join global tracking
    socket.on("join-admin", () => {
        socket.join("admin-room");
        console.log(`Admin ${socket.id} joined admin-room`);
    });

    socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id);
    });
});

server.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
