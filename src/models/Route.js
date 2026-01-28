const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    stops: [{
        name: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    }],
    polyline: { type: String, default: "" } // Encoded Google Polyline or shared path
});

module.exports = mongoose.model("Route", routeSchema);
