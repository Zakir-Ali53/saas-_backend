
const express = require("express");
const router = express.Router();

const {
    createInventory,
    getInventory,
    getInventoryById,
    updateInventory,
    stockIn,
    stockOut,
    deleteInventory
} = require("../controllers/inventoryController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const auditLog = require("../middleware/auditMiddleware");

const READ_ROLES = [
    "SUPER_ADMIN",
    "COMPANY_ADMIN",
    "BRANCH_ADMIN",
    "BRANCH_MANAGER",
    "PRODUCTION_MANAGER",
    "STAFF"
];

const MANAGE_ROLES = [
    "SUPER_ADMIN",
    "COMPANY_ADMIN",
    "BRANCH_ADMIN"
];

const STOCK_ROLES = [
    "SUPER_ADMIN",
    "COMPANY_ADMIN",
    "BRANCH_ADMIN",
    "BRANCH_MANAGER"
];

// Require authentication for all inventory routes
router.use(protect);

// Create inventory
router.post(
    "/",
    authorize(...MANAGE_ROLES),
    auditLog("INVENTORY", "CREATE"),
    createInventory
);

// Get inventory list
router.get(
    "/",
    authorize(...READ_ROLES),
    getInventory
);

// Get one inventory record
router.get(
    "/:id",
    authorize(...READ_ROLES),
    getInventoryById
);

// Update inventory settings
router.put(
    "/:id",
    authorize(...MANAGE_ROLES),
    auditLog("INVENTORY", "UPDATE"),
    updateInventory
);

// Add stock
router.patch(
    "/:id/stock-in",
    authorize(...STOCK_ROLES),
    auditLog("INVENTORY", "STOCK_IN"),
    stockIn
);

// Remove stock
router.patch(
    "/:id/stock-out",
    authorize(...STOCK_ROLES),
    auditLog("INVENTORY", "STOCK_OUT"),
    stockOut
);

// Deactivate inventory
router.delete(
    "/:id",
    authorize(...MANAGE_ROLES),
    auditLog("INVENTORY", "DEACTIVATE"),
    deleteInventory
);

module.exports = router;
