const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    console.log("LOGIN BODY:", req.body);

    const user = await User.findOne({ email });
    console.log("USER FROM DB:", user?.email);

    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }

    const match = await bcrypt.compare(password, user.password);
    // console.log("PASSWORD MATCH:", match);

    if (!match) {
        return res.status(400).json({ message: "Wrong password" });
    }

    const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET
    );

    res.json({ token, role: user.role });
});


module.exports = router;
