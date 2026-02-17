const express = require("express");
const cors = require("cors");
const swaggerSetup = require("./config/swagger");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const driverRoutes = require("./routes/driver");
const attendanceRoutes = require("./routes/attendance");
const parentRoutes = require("./routes/parent"); // ✅ REQUIRED
const busRoutes = require("./routes/bus");
const studentRoutes = require("./routes/student");
const routeRoutes = require("./routes/route");
const trackingRoutes = require("./routes/tracking");

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use("/api/", limiter);

swaggerSetup(app);

// Simple Health Check
app.get("/", (req, res) => {
    res.send("School Bus Backend is Running! 🚀");
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/bus", busRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/tracking", trackingRoutes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
