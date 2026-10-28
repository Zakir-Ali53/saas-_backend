
const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const Product = require("../models/Product");
const Branch = require("../models/Branch");
const Company = require("../models/Company");

const BRANCH_ROLES = [
    "BRANCH_ADMIN",
    "BRANCH_MANAGER",
    "STAFF"
];

const isValidId = (id) =>
    typeof id === "string" && mongoose.isValidObjectId(id);

const isPositiveNumber = (value) =>
    value !== undefined &&
    value !== null &&
    value !== "" &&
    typeof value !== "boolean" &&
    Number.isFinite(Number(value)) &&
    Number(value) > 0;

const getCompanyFilter = (req) => {
    const filter = {};

    if (req.user.role !== "SUPER_ADMIN") {
        filter.companyId = req.user.companyId;
    } else if (req.query.companyId) {
        filter.companyId = req.query.companyId;
    }

    if (BRANCH_ROLES.includes(req.user.role)) {
        filter.branchId = req.user.branchId;
    }

    return filter;
};

const getSingleFilter = (req) => {
    const filter = { _id: req.params.id };

    if (req.user.role !== "SUPER_ADMIN") {
        filter.companyId = req.user.companyId;
    }

    if (BRANCH_ROLES.includes(req.user.role)) {
        filter.branchId = req.user.branchId;
    }

    return filter;
};

const populateInventory = (query) =>
    query
        .populate("companyId", "name")
        .populate("branchId", "name code")
        .populate("productId", "name sku");

const handleError = (res, error, message) => {
    if (error.code === 11000) {
        return res.status(409).json({
            success: false,
            message: "Inventory already exists for this product and branch"
        });
    }

    if (
        error.name === "ValidationError" ||
        error.name === "CastError"
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid inventory data"
        });
    }

    console.error(`${message}:`, error.message);

    return res.status(500).json({
        success: false,
        message
    });
};

// Create inventory
const createInventory = async (req, res) => {
    try {
        const {
            companyId,
            branchId,
            productId,
            quantity,
            minStockLevel,
            unit
        } = req.body;

        const finalCompanyId =
            req.user.role === "SUPER_ADMIN"
                ? companyId
                : req.user.companyId;

        let finalBranchId = branchId;

        if (BRANCH_ROLES.includes(req.user.role)) {
            if (!req.user.branchId) {
                return res.status(403).json({
                    success: false,
                    message: "You are not assigned to a branch"
                });
            }

            finalBranchId = req.user.branchId;
        }

        if (
            !isValidId(finalCompanyId) ||
            !isValidId(finalBranchId) ||
            !isValidId(productId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid company, branch and product IDs are required"
            });
        }

        if (
            req.user.role !== "SUPER_ADMIN" &&
            String(finalCompanyId) !== String(req.user.companyId)
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot access another company's inventory"
            });
        }

        const initialQuantity =
            quantity === undefined ? 0 : Number(quantity);

        const minimumStock =
            minStockLevel === undefined ? 10 : Number(minStockLevel);

        if (
            quantity === "" ||
            minStockLevel === "" ||
            typeof quantity === "boolean" ||
            typeof minStockLevel === "boolean" ||
            !Number.isFinite(initialQuantity) ||
            initialQuantity < 0 ||
            !Number.isFinite(minimumStock) ||
            minimumStock < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Quantity and minimum stock level must be non-negative numbers"
            });
        }

        if (
            unit !== undefined &&
            (
                typeof unit !== "string" ||
                !unit.trim() ||
                unit.trim().length > 30
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Unit must contain 1 to 30 characters"
            });
        }

        const company = await Company.findOne({
            _id: finalCompanyId,
            status: "ACTIVE"
        });

        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Active company not found"
            });
        }

        const branch = await Branch.findOne({
            _id: finalBranchId,
            companyId: finalCompanyId,
            status: "ACTIVE"
        });

        if (!branch) {
            return res.status(404).json({
                success: false,
                message: "Active branch not found in this company"
            });
        }

        const product = await Product.findOne({
            _id: productId,
            companyId: finalCompanyId,
            status: "ACTIVE"
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Active product not found in this company"
            });
        }

        const inventory = await Inventory.create({
            companyId: finalCompanyId,
            branchId: finalBranchId,
            productId,
            quantity: initialQuantity,
            minStockLevel: minimumStock,
            unit: unit === undefined ? "pcs" : unit.trim()
        });

        const populatedInventory = await populateInventory(
            Inventory.findById(inventory._id)
        );

        return res.status(201).json({
            success: true,
            message: "Inventory created successfully",
            inventory: populatedInventory
        });
    } catch (error) {
        return handleError(res, error, "Failed to create inventory");
    }
};

// Get inventory list
const getInventory = async (req, res) => {
    try {
        const { branchId, productId, lowStock, companyId } = req.query;

        if (
            (lowStock !== undefined &&
                !["true", "false"].includes(lowStock)) ||
            (branchId && !isValidId(branchId)) ||
            (productId && !isValidId(productId)) ||
            (companyId && !isValidId(companyId))
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid inventory filter"
            });
        }

        if (
            req.user.role === "SUPER_ADMIN" &&
            !companyId
        ) {
            return res.status(400).json({
                success: false,
                message: "Super Admin must provide companyId"
            });
        }

        if (
            req.user.role !== "SUPER_ADMIN" &&
            companyId &&
            String(companyId) !== String(req.user.companyId)
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot access another company's inventory"
            });
        }

        const filter = getCompanyFilter(req);

        if (branchId) {
            if (
                BRANCH_ROLES.includes(req.user.role) &&
                String(branchId) !== String(req.user.branchId)
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You cannot access another branch's inventory"
                });
            }

            filter.branchId = branchId;
        }

        if (productId) {
            filter.productId = productId;
        }

        if (lowStock === "true") {
            filter.$expr = {
                $lte: ["$quantity", "$minStockLevel"]
            };
        }

        const inventory = await populateInventory(
            Inventory.find(filter).sort({ updatedAt: -1 })
        );

        return res.status(200).json({
            success: true,
            count: inventory.length,
            inventory
        });
    } catch (error) {
        return handleError(res, error, "Failed to get inventory");
    }
};

// Get single inventory record
const getInventoryById = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid inventory ID"
            });
        }

        const inventory = await populateInventory(
            Inventory.findOne(getSingleFilter(req))
        );

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: "Inventory not found"
            });
        }

        return res.status(200).json({
            success: true,
            inventory
        });
    } catch (error) {
        return handleError(res, error, "Failed to get inventory");
    }
};

// Update inventory settings only
const updateInventory = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid inventory ID"
            });
        }

        const { minStockLevel, unit, status } = req.body;
        const updates = {};

        if (
            minStockLevel === undefined &&
            unit === undefined &&
            status === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Provide at least one inventory setting to update"
            });
        }

        if (minStockLevel !== undefined) {
            const value = Number(minStockLevel);

            if (
                minStockLevel === "" ||
                typeof minStockLevel === "boolean" ||
                !Number.isFinite(value) ||
                value < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Minimum stock level must be a non-negative number"
                });
            }

            updates.minStockLevel = value;
        }

        if (unit !== undefined) {
            if (
                typeof unit !== "string" ||
                !unit.trim() ||
                unit.trim().length > 30
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Unit must contain 1 to 30 characters"
                });
            }

            updates.unit = unit.trim();
        }

        if (status !== undefined) {
            if (!["ACTIVE", "INACTIVE"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Status must be ACTIVE or INACTIVE"
                });
            }

            updates.status = status;
        }

        const inventory = await Inventory.findOneAndUpdate(
            getSingleFilter(req),
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: "Inventory not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Inventory updated successfully",
            inventory
        });
    } catch (error) {
        return handleError(res, error, "Failed to update inventory");
    }
};

// Stock in
const stockIn = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid inventory ID"
            });
        }

        if (!isPositiveNumber(req.body.quantity)) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be a number greater than 0"
            });
        }

        const quantity = Number(req.body.quantity);

        const inventory = await Inventory.findOneAndUpdate(
            {
                ...getSingleFilter(req),
                status: "ACTIVE"
            },
            { $inc: { quantity } },
            { new: true, runValidators: true }
        );

        if (!inventory) {
            const exists = await Inventory.exists(getSingleFilter(req));

            return res.status(exists ? 400 : 404).json({
                success: false,
                message: exists
                    ? "Inventory is inactive; stock cannot be changed"
                    : "Inventory not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Stock added successfully",
            quantity: inventory.quantity,
            inventory
        });
    } catch (error) {
        return handleError(res, error, "Failed to add stock");
    }
};

// Stock out
const stockOut = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid inventory ID"
            });
        }

        if (!isPositiveNumber(req.body.quantity)) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be a number greater than 0"
            });
        }

        const quantity = Number(req.body.quantity);

        const inventory = await Inventory.findOneAndUpdate(
            {
                ...getSingleFilter(req),
                status: "ACTIVE",
                quantity: { $gte: quantity }
            },
            { $inc: { quantity: -quantity } },
            { new: true, runValidators: true }
        );

        if (!inventory) {
            const existingInventory = await Inventory.findOne(
                getSingleFilter(req)
            ).select("quantity status");

            if (!existingInventory) {
                return res.status(404).json({
                    success: false,
                    message: "Inventory not found"
                });
            }

            if (existingInventory.status !== "ACTIVE") {
                return res.status(400).json({
                    success: false,
                    message: "Inventory is inactive; stock cannot be changed"
                });
            }

            return res.status(400).json({
                success: false,
                message: "Insufficient stock"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Stock removed successfully",
            quantity: inventory.quantity,
            inventory
        });
    } catch (error) {
        return handleError(res, error, "Failed to remove stock");
    }
};

// Soft-delete inventory to preserve its record
const deleteInventory = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid inventory ID"
            });
        }

        const inventory = await Inventory.findOneAndUpdate(
            getSingleFilter(req),
            { $set: { status: "INACTIVE" } },
            { new: true, runValidators: true }
        );

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: "Inventory not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Inventory deactivated successfully"
        });
    } catch (error) {
        return handleError(res, error, "Failed to deactivate inventory");
    }
};

module.exports = {
    createInventory,
    getInventory,
    getInventoryById,
    updateInventory,
    stockIn,
    stockOut,
    deleteInventory
};
