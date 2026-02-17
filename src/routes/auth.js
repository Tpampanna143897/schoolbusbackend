const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const auth = require("../middleware/auth");
const response = require("../utils/response");
const logger = require("../utils/logger");

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and get JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "admin@antigravity.io" }
 *               password: { type: string, example: "password123" }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     token: { type: string }
 *                     user: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Invalid credentials
 */
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               role: { type: string, enum: [ADMIN, DRIVER, PARENT, STAFF] }
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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
/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/User' }
 */
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
/**
 * @swagger
 * /auth/profile:
 *   put:
 *     summary: Update current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put("/profile", auth, async (req, res) => {
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
