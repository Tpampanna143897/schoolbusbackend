const mongoose = require("mongoose");

const busSchema = new mongoose.Schema({
    busNumber: { type: String, required: true, unique: true },
    vin: { type: String },
    capacity: { type: Number },
    defaultRoute: { type: mongoose.Schema.Types.ObjectId, ref: "Route" },
    status: { type: String, enum: ["ONLINE", "OFFLINE", "MAINTENANCE"], default: "OFFLINE" },
    isActive: { type: Boolean, default: true },
    activeTrip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    activeDriverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedDrivers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    lastKnownLocation: {
        lat: Number,
        lng: Number,
        speed: Number,
        timestamp: Date
    }
}, { timestamps: true });


module.exports = mongoose.model("Bus", busSchema);
