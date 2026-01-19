const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema({
    name: String,
    stops: [String]
});

module.exports = mongoose.model("Route", routeSchema);
