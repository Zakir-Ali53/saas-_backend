
const mongoose = require("mongoose");
const Branch = require("../models/Branch");
const ProductionArea = require("../models/ProductionArea");

const companyAccess = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    if (req.user.role === "SUPER_ADMIN") {
        return next();
    }

    if (!req.user.companyId) {
        return res.status(403).json({
            success: false,
            message: "User is not assigned to a company"
        });
    }

    req.companyId = req.user.companyId;

    return next();
};

const branchAccess = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (req.user.role === "SUPER_ADMIN") {
            return next();
        }

        if (!req.user.companyId) {
            return res.status(403).json({
                success: false,
                message: "User is not assigned to a company"
            });
        }

        const branchId =
            req.params.branchId ||
            req.params.id ||
            req.body.branchId ||
            req.query.branchId;

        if (!branchId) {
            return res.status(400).json({
                success: false,
                message: "Branch ID is required"
            });
        }

        if (!mongoose.isValidObjectId(branchId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid branch ID"
            });
        }

        const branch = await Branch.findOne({
            _id: branchId,
            companyId: req.user.companyId
        });

        if (!branch) {
            return res.status(404).json({
                success: false,
                message: "Branch not found in your company"
            });
        }

        if (
            ["BRANCH_ADMIN", "BRANCH_MANAGER", "STAFF"].includes(
                req.user.role
            ) &&
            (
                !req.user.branchId ||
                req.user.branchId.toString() !== branch._id.toString()
            )
        ) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this branch"
            });
        }

        req.branch = branch;
        req.branchId = branch._id;
        req.companyId = branch.companyId;

        return next();
    } catch (error) {
        console.error("Branch access error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Branch access verification failed"
        });
    }
};

const productionAccess = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (req.user.role === "SUPER_ADMIN") {
            return next();
        }

        if (!req.user.companyId) {
            return res.status(403).json({
                success: false,
                message: "User is not assigned to a company"
            });
        }

        const productionAreaId =
            req.params.productionAreaId ||
            req.params.id ||
            req.body.productionAreaId ||
            req.query.productionAreaId;

        if (!productionAreaId) {
            return res.status(400).json({
                success: false,
                message: "Production area ID is required"
            });
        }

        if (!mongoose.isValidObjectId(productionAreaId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid production area ID"
            });
        }

        const productionArea = await ProductionArea.findOne({
            _id: productionAreaId,
            companyId: req.user.companyId
        });

        if (!productionArea) {
            return res.status(404).json({
                success: false,
                message: "Production area not found in your company"
            });
        }

        if (
            req.user.role === "PRODUCTION_MANAGER" &&
            (
                !req.user.productionAreaId ||
                req.user.productionAreaId.toString() !==
                    productionArea._id.toString()
            )
        ) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this production area"
            });
        }

        req.productionArea = productionArea;
        req.productionAreaId = productionArea._id;
        req.companyId = productionArea.companyId;

        return next();
    } catch (error) {
        console.error("Production access error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Production area access verification failed"
        });
    }
};

module.exports = {
    companyAccess,
    branchAccess,
    productionAccess
};
