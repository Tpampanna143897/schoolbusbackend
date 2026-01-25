const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema({
    name: String,
    stops: [String],
    polyline: { type: String, default: "" } // Encoded Google Polyline
});

module.exports = mongoose.model("Route", routeSchema);
