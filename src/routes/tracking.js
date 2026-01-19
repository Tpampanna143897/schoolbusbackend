const router = require("express").Router();
const auth = require("../middleware/auth");
const Tracking = require("../models/Tracking");
const Bus = require("../models/Bus");

router.post("/update", auth, async (req, res) => {
    try {
        const { busId, lat, lng, speed } = req.body;

        await Tracking.create({ bus: busId, lat, lng, speed: speed || 0 });

        await Bus.findByIdAndUpdate(busId, {
            lastLocationAt: new Date(),
            status: "ONLINE"
        });

        global.io.emit("bus-location", {
            busId,
            lat,
            lng,
            speed: speed || 0,
            time: new Date()
        });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Tracking failed" });
    }
});

module.exports = router;
