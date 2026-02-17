const mongoose = require("mongoose");

const trackingSchema = new mongoose.Schema(
    {
        tripId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trip",
            required: true
        },
        lat: {
            type: Number,
            required: true
        },
        lng: {
            type: Number,
            required: true
        },
        speed: {
            type: Number,
            default: 0
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);

trackingSchema.index({ tripId: 1, timestamp: -1 });
trackingSchema.index({ timestamp: 1 });

module.exports = mongoose.model("Tracking", trackingSchema);
