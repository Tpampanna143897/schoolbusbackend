const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`[AUTH] Login attempt: ${email}`);

        const user = await User.findOne({ email }).populate("assignedRoute").populate("assignedBus");
        if (!user) {
            console.warn(`[AUTH] User not found: ${email}`);
            return res.status(400).json({ message: "User not found" });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            console.warn(`[AUTH] Invalid password for: ${email}`);
            return res.status(400).json({ message: "Wrong password" });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret'
        );

        console.log(`[AUTH] Login successful: ${email} (${user.role})`);

        res.json({
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
        console.error("[AUTH] Login Crash:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// GET /api/auth/me - Get Current User Profile
router.get("/me", require("../middleware/auth"), async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("-password")
            .populate("assignedRoute")
            .populate("assignedBus");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

// PUT /api/auth/me - Update Profile
router.put("/me", require("../middleware/auth"), async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ message: "User not found" });

        if (name) user.name = name;
        if (email) user.email = email;
        // If your User model has phone, update it. If not, you might need to add it to Schema.
        // Assuming schema might need phone if not present.

        await user.save();
        res.json({ success: true, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ message: "Update failed" });
    }
});

module.exports = router;
