const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
    {
        tripCode: { type: String },
        driverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        busId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bus",
            required: true
        },
        routeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Route",
            required: true
        },
        type: {
            type: String,
            enum: ["MORNING", "EVENING"],
            required: true
        },
        status: {
            type: String,
            enum: ["SCHEDULED", "STARTED", "COMPLETED", "CANCELLED"],
            default: "STARTED"
        },
        startedAt: {
            type: Date,
            default: Date.now
        },
        endedAt: {
            type: Date
        },
        stopsVisited: [{
            stopId: mongoose.Schema.Types.ObjectId,
            arrivalTime: Date,
            departureTime: Date
        }]
    },
    { timestamps: true }
);

module.exports = mongoose.model("Trip", tripSchema);
