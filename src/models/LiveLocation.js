const mongoose = require("mongoose");

const liveLocationSchema = new mongoose.Schema({
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true, unique: true },
    busId: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    speed: { type: Number, default: 0 },
    heading: { type: Number, default: 0 },
    status: { type: String, enum: ["ONLINE", "OFFLINE"], default: "ONLINE" },
    lastUpdate: { type: Date, default: Date.now },
    nextHistoryUpdate: { type: Date, default: Date.now },
    nextStopIndex: { type: Number, default: 0 },
    eta: { type: Number, default: null } // in minutes
}, { timestamps: true });

liveLocationSchema.index({ tripId: 1 });
liveLocationSchema.index({ lastUpdate: 1 }, { expireAfterSeconds: 86400 }); // Auto-clear old livedata

module.exports = mongoose.model("LiveLocation", liveLocationSchema);
