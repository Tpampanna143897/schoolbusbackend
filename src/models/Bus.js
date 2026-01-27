const mongoose = require("mongoose");

const busSchema = new mongoose.Schema({
    busNumber: { type: String, required: true },
    defaultRoute: { type: mongoose.Schema.Types.ObjectId, ref: "Route" },
    status: { type: String, enum: ["ONLINE", "OFFLINE"], default: "OFFLINE" },
    isActive: { type: Boolean, default: true },
    lastLocationAt: { type: Date },
    speed: { type: Number, default: 0 },
    activeTrip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    activeDriver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedDrivers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
});

module.exports = mongoose.model("Bus", busSchema);
