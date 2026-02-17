const trackingController = require("../controllers/trackingController");

/**
 * @route GET /api/tracking/live/:tripId
 * @desc Get the most recent live location for a trip (Redis -> MongoDB -> History)
 * @access Private
 */
router.get("/live/:tripId", auth, trackingController.getLiveLocation);

module.exports = router;
