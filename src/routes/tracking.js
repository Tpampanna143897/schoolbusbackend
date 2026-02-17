const router = require("express").Router();
const auth = require("../middleware/auth");
const trackingController = require("../controllers/trackingController");

/**
 * @route GET /api/tracking/live/:tripId
 * @desc Get the most recent live location for a trip (Redis -> MongoDB -> History)
 * @access Private
 */
router.get("/live/:tripId", auth, trackingController.getLiveLocation);

/**
 * @route POST /api/tracking/update
 * @desc Update live location via HTTP (Fallback for background tasks)
 * @access Private
 */
router.post("/update", auth, trackingController.updateLocation);

module.exports = router;
