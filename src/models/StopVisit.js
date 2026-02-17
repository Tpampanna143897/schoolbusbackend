const mongoose = require("mongoose");

const stopVisitSchema = new mongoose.Schema({
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true },
    stopId: { type: mongoose.Schema.Types.ObjectId, required: true },
    stopName: { type: String },
    arrivalTime: { type: Date },
    departureTime: { type: Date },
}, { timestamps: true });

stopVisitSchema.index({ tripId: 1, stopId: 1 }, { unique: true });

module.exports = mongoose.model("StopVisit", stopVisitSchema);
