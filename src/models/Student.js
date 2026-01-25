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
        assignedRoute: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Route"
        },
        assignedBus: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bus"
        },
        activeTripId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trip"
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);
