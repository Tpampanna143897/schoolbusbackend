const express = require("express");
const cors = require("cors");
const swaggerSetup = require("./config/swagger");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const driverRoutes = require("./routes/driver");
const trackingRoutes = require("./routes/tracking");
const attendanceRoutes = require("./routes/attendance");
const parentRoutes = require("./routes/parent"); // ✅ REQUIRED
const busRoutes = require("./routes/bus");
const studentRoutes = require("./routes/student");

const app = express();

app.use(cors());
app.use(express.json());

swaggerSetup(app);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/parent", parentRoutes); // ✅ REQUIRED
app.use("/api/bus", busRoutes);
app.use("/api/students", studentRoutes);

module.exports = app;
