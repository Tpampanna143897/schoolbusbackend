const router = require("express").Router();
const auth = require("../middleware/auth");
const Route = require("../models/Route");

router.get("/", auth, async (req, res) => {
    try {
        const routes = await Route.find({});
        res.json(routes);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch routes" });
    }
});

module.exports = router;
