const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    busId: { type: mongoose.Schema.Types.ObjectId, ref: "Bus" },
    isActive: { type: Boolean, default: false },
    shift: { type: String, enum: ["MORNING", "EVENING", "NIGHT"], default: "MORNING" }
}, { timestamps: true });

// Ensure one driver record per user
driverSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model("Driver", driverSchema);
