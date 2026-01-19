const mongoose = require("mongoose");

const LocationSchema = new mongoose.Schema({
    busId: mongoose.Schema.Types.ObjectId,
    latitude: Number,
    longitude: Number,
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Location", LocationSchema);
