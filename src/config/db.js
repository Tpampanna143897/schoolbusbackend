const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected successfully");
    } catch (err) {
        console.error("MongoDB Connection Error Details:", {
            message: err.message,
            code: err.code,
            syscall: err.syscall,
            hostname: err.hostname
        });
        console.log("SUGGESTION: Check if your IP is whitelisted in MongoDB Atlas Network Access.");
        // process.exit(1); // Don't exit immediately during debug to allow other services to start if needed, or keep it if strictly required.
        // Keeping exit for now as DB is critical, but logged more info.
        process.exit(1);
    }
};

module.exports = connectDB;
