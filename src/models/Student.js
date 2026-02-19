const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        class: { type: String, required: true },
        parent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School"
        },
        homeLocation: {
            lat: Number,
            lng: Number
        },
        assignedRoute: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Route"
        },
        assignedBus: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bus"
        },
        assignedStop: {
            type: mongoose.Schema.Types.ObjectId,
            // Links to a specific stop in a Route's stops array
        },
        activeTripId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trip"
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);
