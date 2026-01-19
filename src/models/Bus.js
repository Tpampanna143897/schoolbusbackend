const mongoose = require("mongoose");

const busSchema = new mongoose.Schema({
    busNumber: String,
    route: { type: mongoose.Schema.Types.ObjectId, ref: "Route" },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
});

module.exports = mongoose.model("Bus", busSchema);
