const express = require("express");
const router = express.Router();

const reportController = require("../controllers/reportController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

if (typeof protect !== "function") {
    throw new Error("authMiddleware must export a function");
}

if (typeof authorize !== "function") {
    throw new Error("roleMiddleware must export a function");
}

const {
    getSalesReport,
    getInventoryReport,
    getProductionReport,
    getBranchSummary
} = reportController;

if (
    typeof getSalesReport !== "function" ||
    typeof getInventoryReport !== "function" ||
    typeof getProductionReport !== "function" ||
    typeof getBranchSummary !== "function"
) {
    throw new Error(
        "reportController exports are missing or incorrectly named"
    );
}

router.get(
    "/sales",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "BRANCH_ADMIN",
        "BRANCH_MANAGER"
    ),
    getSalesReport
);

router.get(
    "/inventory",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "BRANCH_ADMIN",
        "BRANCH_MANAGER",
        "PRODUCTION_MANAGER"
    ),
    getInventoryReport
);

router.get(
    "/production",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "BRANCH_ADMIN",
        "BRANCH_MANAGER",
        "PRODUCTION_MANAGER"
    ),
    getProductionReport
);

router.get(
    "/branches",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN"
    ),
    getBranchSummary
);

module.exports = router;

