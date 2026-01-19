const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
    studentId: mongoose.Schema.Types.ObjectId,
    busId: mongoose.Schema.Types.ObjectId,
    boardedAt: Date,
    droppedAt: Date
});

module.exports = mongoose.model("Attendance", AttendanceSchema);
