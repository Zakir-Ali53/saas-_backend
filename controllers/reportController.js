
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Inventory = require("../models/Inventory");
const Production = require("../models/Production");
const Branch = require("../models/Branch");

const BRANCH_ROLES = [
    "BRANCH_ADMIN",
    "BRANCH_MANAGER",
    "STAFF"
];

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const getCompanyFilter = (req) => {
    const filter = {};

    if (req.user.role !== "SUPER_ADMIN") {
        filter.companyId = req.user.companyId;
    } else if (req.query.companyId) {
        filter.companyId = req.query.companyId;
    }

    if (BRANCH_ROLES.includes(req.user.role)) {
        filter.branchId = req.user.branchId;
    } else if (req.query.branchId) {
        filter.branchId = req.query.branchId;
    }

    return filter;
};

const validateFilters = (req, res) => {
    const { companyId, branchId, productionAreaId, startDate, endDate } =
        req.query;

    if (
        companyId &&
        !isValidId(companyId)
    ) {
        res.status(400).json({
            success: false,
            message: "Invalid companyId"
        });
        return false;
    }

    if (
        branchId &&
        !isValidId(branchId)
    ) {
        res.status(400).json({
            success: false,
            message: "Invalid branchId"
        });
        return false;
    }

    if (
        productionAreaId &&
        !isValidId(productionAreaId)
    ) {
        res.status(400).json({
            success: false,
            message: "Invalid productionAreaId"
        });
        return false;
    }

    if (
        req.user.role !== "SUPER_ADMIN" &&
        companyId &&
        String(companyId) !== String(req.user.companyId)
    ) {
        res.status(403).json({
            success: false,
            message: "Access denied to this company"
        });
        return false;
    }

    if (
        BRANCH_ROLES.includes(req.user.role) &&
        branchId &&
        String(branchId) !== String(req.user.branchId)
    ) {
        res.status(403).json({
            success: false,
            message: "Access denied to this branch"
        });
        return false;
    }

    if (
        req.user.role === "PRODUCTION_MANAGER" &&
        productionAreaId &&
        String(productionAreaId) !== String(req.user.productionAreaId)
    ) {
        res.status(403).json({
            success: false,
            message: "Access denied to this production area"
        });
        return false;
    }

    if (startDate && Number.isNaN(Date.parse(startDate))) {
        res.status(400).json({
            success: false,
            message: "Invalid startDate"
        });
        return false;
    }

    if (endDate && Number.isNaN(Date.parse(endDate))) {
        res.status(400).json({
            success: false,
            message: "Invalid endDate"
        });
        return false;
    }

    if (
        startDate &&
        endDate &&
        new Date(startDate) > new Date(endDate)
    ) {
        res.status(400).json({
            success: false,
            message: "startDate cannot be after endDate"
        });
        return false;
    }

    return true;
};

const applyDateFilter = (filter, field, startDate, endDate) => {
    if (startDate || endDate) {
        filter[field] = {};

        if (startDate) {
            filter[field].$gte = new Date(startDate);
        }

        if (endDate) {
            const end = new Date(endDate);

            if (endDate.length <= 10) {
                end.setHours(23, 59, 59, 999);
            }

            filter[field].$lte = end;
        }
    }
};

const getOrdersForReport = async (filter) => {
    return Order.find(filter).lean();
};

// Sales report
const getSalesReport = async (req, res) => {
    try {
        if (!validateFilters(req, res)) return;

        const filter = getCompanyFilter(req);
        const {
            status,
            paymentStatus,
            startDate,
            endDate
        } = req.query;

        if (status) {
            filter.status = status;
        }

        if (paymentStatus) {
            filter.paymentStatus = paymentStatus;
        }

        applyDateFilter(filter, "createdAt", startDate, endDate);

        const orders = await getOrdersForReport(filter);

        const summary = orders.reduce(
            (result, order) => {
                result.totalOrders += 1;
                result.totalSales += Number(order.totalAmount || 0);

                if (order.status === "COMPLETED") {
                    result.completedOrders += 1;
                }

                if (order.status === "CANCELLED") {
                    result.cancelledOrders += 1;
                }

                if (order.paymentStatus === "PAID") {
                    result.paidAmount += Number(order.totalAmount || 0);
                }

                return result;
            },
            {
                totalOrders: 0,
                totalSales: 0,
                completedOrders: 0,
                cancelledOrders: 0,
                paidAmount: 0
            }
        );

        return res.status(200).json({
            success: true,
            summary,
            count: orders.length,
            data: orders
        });
    } catch (error) {
        console.error("Sales report error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to generate sales report"
        });
    }
};

// Inventory report
const getInventoryReport = async (req, res) => {
    try {
        if (!validateFilters(req, res)) return;

        const filter = getCompanyFilter(req);

        if (req.query.status) {
            filter.status = req.query.status;
        }

        const inventory = await Inventory.find(filter)
            .populate("productId")
            .populate("branchId", "name")
            .lean();

        const summary = inventory.reduce(
            (result, item) => {
                const quantity = Number(item.quantity || 0);
                const minimum = Number(item.minStockLevel || 0);

                result.totalItems += 1;
                result.totalQuantity += quantity;

                if (quantity <= minimum) {
                    result.lowStockItems += 1;
                }

                return result;
            },
            {
                totalItems: 0,
                totalQuantity: 0,
                lowStockItems: 0
            }
        );

        return res.status(200).json({
            success: true,
            summary,
            count: inventory.length,
            data: inventory
        });
    } catch (error) {
        console.error("Inventory report error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to generate inventory report"
        });
    }
};

// Production report
const getProductionReport = async (req, res) => {
    try {
        if (!validateFilters(req, res)) return;

        const filter = getCompanyFilter(req);
        const {
            productionAreaId,
            status,
            startDate,
            endDate
        } = req.query;

        if (req.user.role === "PRODUCTION_MANAGER") {
            if (!req.user.productionAreaId) {
                return res.status(403).json({
                    success: false,
                    message: "Production area is not assigned"
                });
            }

            filter.productionAreaId = req.user.productionAreaId;
        } else if (productionAreaId) {
            filter.productionAreaId = productionAreaId;
        }

        if (status) {
            filter.status = status;
        }

        applyDateFilter(filter, "createdAt", startDate, endDate);

        const records = await Production.find(filter).lean();

        const summary = records.reduce(
            (result, record) => {
                result.totalRecords += 1;
                result.totalQuantity += Number(
                    record.quantityProduced || record.quantity || 0
                );

                return result;
            },
            {
                totalRecords: 0,
                totalQuantity: 0
            }
        );

        return res.status(200).json({
            success: true,
            summary,
            count: records.length,
            data: records
        });
    } catch (error) {
        console.error("Production report error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to generate production report"
        });
    }
};

// Branch summary
const getBranchSummary = async (req, res) => {
    try {
        if (!validateFilters(req, res)) return;

        if (req.user.role === "PRODUCTION_MANAGER") {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        const filter = {};

        if (req.user.role !== "SUPER_ADMIN") {
            filter.companyId = req.user.companyId;
        } else if (req.query.companyId) {
            filter.companyId = req.query.companyId;
        }

        if (req.query.branchId) {
            filter._id = req.query.branchId;
        }

        const branches = await Branch.find(filter).lean();

        const data = await Promise.all(
            branches.map(async (branch) => {
                const branchFilter = {
                    companyId: branch.companyId,
                    branchId: branch._id
                };

                const [orders, inventory] = await Promise.all([
                    Order.find(branchFilter).lean(),
                    Inventory.find(branchFilter).lean()
                ]);

                const totalSales = orders.reduce(
                    (sum, order) =>
                        sum + Number(order.totalAmount || 0),
                    0
                );

                const totalStock = inventory.reduce(
                    (sum, item) =>
                        sum + Number(item.quantity || 0),
                    0
                );

                return {
                    branchId: branch._id,
                    branchName: branch.name,
                    totalOrders: orders.length,
                    totalSales,
                    totalInventoryItems: inventory.length,
                    totalStock
                };
            })
        );

        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        console.error("Branch summary error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to generate branch summary"
        });
    }
};

module.exports = {
    getSalesReport,
    getInventoryReport,
    getProductionReport,
    getBranchSummary
};
