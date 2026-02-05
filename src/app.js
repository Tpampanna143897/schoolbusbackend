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

const app = express();

app.use(cors());
app.use(express.json());

swaggerSetup(app);

// Simple Health Check
app.get("/", (req, res) => {
    res.send("School Bus Backend is Running! 🚀");
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/parent", parentRoutes); // ✅ REQUIRED
app.use("/api/bus", busRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/routes", routeRoutes);

module.exports = app;
