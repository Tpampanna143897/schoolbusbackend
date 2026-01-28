const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    date: { type: String, required: true }, // YYYY-MM-DD
    pickupTime: { type: Date },
    dropTime: { type: Date },
    pickupLat: { type: Number },
    pickupLng: { type: Number },
    dropLat: { type: Number },
    dropLng: { type: Number },
    status: { type: String, enum: ["PICKED", "DROPPED"] }
}, { timestamps: true });

AttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);
