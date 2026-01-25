const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true },
    status: { type: String, enum: ["PICKED_UP", "DROPPED_OFF"], required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Attendance", AttendanceSchema);
