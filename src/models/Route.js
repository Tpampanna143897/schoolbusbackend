const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema({
    routeName: { type: String, required: true },
    routeCode: { type: String, required: true, unique: true },
    description: String,
    schools: [{ type: mongoose.Schema.Types.ObjectId, ref: "School" }],
    startPoint: {
        name: String,
        lat: Number,
        lng: Number
    },
    endPoint: {
        name: String,
        lat: Number,
        lng: Number
    },
    stops: [{
        name: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        radius: { type: Number, default: 50 },
        order: { type: Number, required: true },
        estimatedMinutes: { type: Number }
    }],
    polyline: { type: String, default: "" },
    directions: {
        morning: { type: Boolean, default: true },
        evening: { type: Boolean, default: true }
    },
    isActive: { type: Boolean, default: true },
    metadata: {
        totalDistance: Number,
        totalDuration: Number
    }
}, { timestamps: true });

// Backward compatibility or shared school location
routeSchema.virtual('schoolLocation').get(function () {
    return this.endPoint; // Primary school usually at end for morning, start for evening
});


module.exports = mongoose.model("Route", routeSchema);
