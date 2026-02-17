const router = require("express").Router();
const auth = require("../middleware/auth");
const trackingController = require("../controllers/trackingController");

/**
 * @route GET /api/tracking/live/:tripId
 * @desc Get the most recent live location for a trip (Redis -> MongoDB -> History)
 * @access Private
 */
/**
 * @swagger
 * /tracking/live/{tripId}:
 *   get:
 *     summary: Get live location for a specific trip
 *     tags: [Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Live location data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/TrackingPoint' }
 */
router.get("/live/:tripId", auth, trackingController.getLiveLocation);

/**
 * @swagger
 * /tracking/update:
 *   post:
 *     summary: Update live location via HTTP (Background Fallback)
 *     description: Used by mobile apps to sync GPS when sockets are suspended.
 *     tags: [Tracking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tripId, lat, lng]
 *             properties:
 *               tripId: { type: string }
 *               busId: { type: string }
 *               driverId: { type: string }
 *               lat: { type: number }
 *               lng: { type: number }
 *               speed: { type: number }
 *               heading: { type: number }
 *     responses:
 *       200:
 *         description: Location synced
 */
router.post("/update", auth, trackingController.updateLocation);

module.exports = router;
