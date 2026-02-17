const router = require("express").Router();
const auth = require("../middleware/auth");
const Route = require("../models/Route");
const response = require("../utils/response");

/**
 * @swagger
 * /routes:
 *   get:
 *     summary: Get all available bus routes
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of routes
 */
router.get("/", auth, async (req, res) => {
    try {
        const routes = await Route.find({}).lean();
        return response(res, true, "Routes fetched successfully", routes);
    } catch (err) {
        return response(res, false, "Failed to fetch routes", {}, 500);
    }
});

module.exports = router;
