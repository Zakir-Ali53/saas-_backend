const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");

const BRANCH_ROLES = [
    "BRANCH_ADMIN",
    "BRANCH_MANAGER",
    "STAFF"
];

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Get audit logs
const getAuditLogs = async (req, res) => {
    try {
        const {
            companyId,
            branchId,
            userId,
            action,
            module,
            startDate,
            endDate
        } = req.query;

        if (
            (companyId && !isValidId(companyId)) ||
            (branchId && !isValidId(branchId)) ||
            (userId && !isValidId(userId))
        ) {
            return res.status(400).json({
                success: false,
                message: "One or more filter IDs are invalid"
            });
        }

        if (
            req.user.role !== "SUPER_ADMIN" &&
            companyId &&
            String(companyId) !== String(req.user.companyId)
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot access another company's audit logs"
            });
        }

        if (
            BRANCH_ROLES.includes(req.user.role) &&
            !req.user.branchId
        ) {
            return res.status(403).json({
                success: false,
                message: "You are not assigned to a branch"
            });
        }

        if (
            BRANCH_ROLES.includes(req.user.role) &&
            branchId &&
            String(branchId) !== String(req.user.branchId)
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot access another branch's audit logs"
            });
        }

        if (startDate && Number.isNaN(Date.parse(startDate))) {
            return res.status(400).json({
                success: false,
                message: "Invalid start date"
            });
        }

        if (endDate && Number.isNaN(Date.parse(endDate))) {
            return res.status(400).json({
                success: false,
                message: "Invalid end date"
            });
        }

        if (
            startDate &&
            endDate &&
            new Date(startDate) > new Date(endDate)
        ) {
            return res.status(400).json({
                success: false,
                message: "Start date cannot be after end date"
            });
        }

        const filter = {};

        if (req.user.role === "SUPER_ADMIN") {
            if (companyId) {
                filter.companyId = companyId;
            }
        } else {
            filter.companyId = req.user.companyId;
        }

        if (BRANCH_ROLES.includes(req.user.role)) {
            filter.branchId = req.user.branchId;
        } else if (branchId) {
            filter.branchId = branchId;
        }

        if (action) {
            filter.action = action;
        }

        if (module) {
            filter.module = module;
        }

        if (userId) {
            filter.userId = userId;
        }

        if (startDate || endDate) {
            filter.createdAt = {};

            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                filter.createdAt.$gte = start;
            }

            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        const parsedPage = Number(req.query.page);
        const parsedLimit = Number(req.query.limit);

        if (
            req.query.page !== undefined &&
            (!Number.isInteger(parsedPage) || parsedPage < 1)
        ) {
            return res.status(400).json({
                success: false,
                message: "Page must be a positive integer"
            });
        }

        if (
            req.query.limit !== undefined &&
            (!Number.isInteger(parsedLimit) ||
                parsedLimit < 1 ||
                parsedLimit > 100)
        ) {
            return res.status(400).json({
                success: false,
                message: "Limit must be between 1 and 100"
            });
        }

        const page = parsedPage || 1;
        const limit = parsedLimit || 20;
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            AuditLog.find(filter)
                .populate("userId", "name email role")
                .populate("branchId", "name code")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),

            AuditLog.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            },
            logs
        });
    } catch (error) {
        console.error("Get audit logs error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve audit logs"
        });
    }
};

module.exports = {
    getAuditLogs
};

