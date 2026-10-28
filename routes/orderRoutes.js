
const express = require("express");
const router = express.Router();

const {
    createOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
    cancelOrder
} = require("../controllers/orderController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const auditLog = require("../middleware/auditMiddleware");

// Create order
router.post(
    "/",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "BRANCH_ADMIN",
        "BRANCH_MANAGER",
        "STAFF"
    ),
    auditLog("ORDER", "CREATE"),
    createOrder
);

// Get all orders
router.get(
    "/",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "BRANCH_ADMIN",
        "BRANCH_MANAGER",
        "PRODUCTION_MANAGER",
        "STAFF"
    ),
    getOrders
);

// Get single order
router.get(
    "/:id",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "BRANCH_ADMIN",
        "BRANCH_MANAGER",
        "PRODUCTION_MANAGER",
        "STAFF"
    ),
    getOrderById
);

// Update order status
router.patch(
    "/:id/status",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "BRANCH_ADMIN",
        "BRANCH_MANAGER"
    ),
    auditLog("ORDER", "STATUS_UPDATE"),
    updateOrderStatus
);

// Cancel order
router.patch(
    "/:id/cancel",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "BRANCH_ADMIN",
        "BRANCH_MANAGER"
    ),
    auditLog("ORDER", "CANCEL"),
    cancelOrder
);

module.exports = router;