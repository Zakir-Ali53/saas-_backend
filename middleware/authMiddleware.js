
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

const protect = async (req, res, next) => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        console.error("JWT_SECRET is missing from environment variables");

        return res.status(500).json({
            success: false,
            message: "Authentication configuration error"
        });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    const token = authHeader.slice(7).trim();

    if (!token || token.includes(" ")) {
        return res.status(401).json({
            success: false,
            message: "Invalid authentication token"
        });
    }

    let decoded;

    try {
        decoded = jwt.verify(token, secret);
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }

    if (
        !decoded ||
        typeof decoded.userId !== "string" ||
        !mongoose.isValidObjectId(decoded.userId)
    ) {
        return res.status(401).json({
            success: false,
            message: "Invalid authentication token"
        });
    }

    try {
        const user = await User.findById(decoded.userId)
            .select(
                "name email role companyId branchId productionAreaId status"
            )
            .lean();

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "User account is not active"
            });
        }

        req.user = {
            _id: user._id,
            userId: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
            branchId: user.branchId,
            productionAreaId: user.productionAreaId,
            status: user.status
        };

        return next();
    } catch (error) {
        console.error("Authentication middleware error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Authentication could not be completed"
        });
    }
};

module.exports = protect;
