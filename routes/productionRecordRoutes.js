
const express = require("express");
const router = express.Router();

const {
    createProduction,
    getProductions,
    getProductionById,
    completeProduction,
    updateProduction,
    cancelProduction
} = require("../controllers/productionRecordController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const auditLog = require("../middleware/auditMiddleware");

// Create production record
router.post(
    "/",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "PRODUCTION_MANAGER"
    ),
    auditLog("PRODUCTION", "CREATE"),
    createProduction
);

// Get all production records
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
    getProductions
);

// Get single production record
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
    getProductionById
);

// Update production record
router.put(
    "/:id",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "PRODUCTION_MANAGER"
    ),
    auditLog("PRODUCTION", "UPDATE"),
    updateProduction
);

// Complete production
router.patch(
    "/:id/complete",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "PRODUCTION_MANAGER"
    ),
    auditLog("PRODUCTION", "COMPLETE"),
    completeProduction
);

// Cancel production
router.patch(
    "/:id/cancel",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "PRODUCTION_MANAGER"
    ),
    auditLog("PRODUCTION", "CANCEL"),
    cancelProduction
);

module.exports = router;