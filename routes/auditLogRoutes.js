
const express = require("express");
const router = express.Router();

const {
    getAuditLogs
} = require("../controllers/auditLogController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

// Get audit logs
router.get(
    "/",
    protect,
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    getAuditLogs
);

module.exports = router;