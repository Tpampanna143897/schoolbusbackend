const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const auth = require("../middleware/auth");
const response = require("../utils/response");
const logger = require("../utils/logger");

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        logger.info(`[AUTH] Login attempt: ${email}`);

        const user = await User.findOne({ email }).populate("assignedRoute").populate("assignedBus");
        if (!user) {
            return response(res, false, "User not found", {}, 400);
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return response(res, false, "Wrong password", {}, 400);
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret'
        );

        logger.info(`[AUTH] Login successful: ${email} (${user.role})`);

        return response(res, true, "Login successful", {
            token,
            role: user.role,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                assignedRoute: user.assignedRoute,
                assignedBus: user.assignedBus
            }
        });
    } catch (err) {
        logger.error(`[AUTH] Login Crash: ${err.message}`);
        return response(res, false, "Internal Server Error", {}, 500);
    }
});

// GET /api/auth/me - Get Current User Profile
router.get("/me", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("-password")
            .populate("assignedRoute")
            .populate("assignedBus")
            .lean();
        if (!user) return response(res, false, "User not found", {}, 404);
        return response(res, true, "Profile fetched", user);
    } catch (err) {
        return response(res, false, "Server Error", {}, 500);
    }
});

// PUT /api/auth/me - Update Profile
router.put("/me", auth, async (req, res) => {
    try {
        const { name, email } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) return response(res, false, "User not found", {}, 404);

        if (name) user.name = name;
        if (email) user.email = email;

        await user.save();
        return response(res, true, "Profile updated", {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        });
    } catch (err) {
        return response(res, false, "Update failed", {}, 500);
    }
});

module.exports = router;

module.exports = router;
