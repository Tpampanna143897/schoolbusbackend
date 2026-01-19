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
        route: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Route",
            required: true
        },
        bus: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bus",
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);
