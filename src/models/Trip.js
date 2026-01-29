const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
    {
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
            enum: ["STARTED", "STOPPED", "ENDED"],
            default: "STARTED"
        },
        startedAt: {
            type: Date,
            default: Date.now
        },
        stoppedAt: {
            type: Date
        },
        endedAt: {
            type: Date
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Trip", tripSchema);
