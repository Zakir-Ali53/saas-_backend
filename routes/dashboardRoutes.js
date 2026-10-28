const express = require("express");

const {
    getCompanyDashboard,
    getSuperAdminDashboard
} = require("../controllers/dashboardController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
    "/super-admin",
    protect,
    authorize("SUPER_ADMIN"),
    getSuperAdminDashboard
);

router.get(
    "/company/:companyId",
    protect,
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    getCompanyDashboard
);

module.exports = router;