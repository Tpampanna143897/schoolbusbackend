const router = require("express").Router();
const Bus = require("../models/Bus");
const auth = require("../middleware/auth");

/**
 * DRIVER: get bus by selected route
 */
router.get("/by-route/:routeId", auth, async (req, res) => {
    try {
        const bus = await Bus.findOne({ routeId: req.params.routeId });

        if (!bus) {
            return res.status(404).json({ message: "No bus assigned to this route" });
        }

        res.json(bus);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * DRIVER: get my assigned bus (optional but useful)
 */
router.get("/driver/my-bus", auth, async (req, res) => {
    try {
        const bus = await Bus.findOne({ driver: req.user.id });

        if (!bus) {
            return res.status(404).json({ message: "Bus not assigned to driver" });
        }

        res.json(bus);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
