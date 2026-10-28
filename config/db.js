
const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is missing from environment variables");
        }

        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected successfully");

        // Load the User model and ensure its declared indexes exist.
        const User = require("../models/User");

        await User.createIndexes();

        console.log("User indexes created or verified successfully");
    } catch (error) {
        console.error("Database initialization failed:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
