
const express = require("express");
const router = express.Router();

const {
    createCompany,
    getCompanies,
    getCompanyById,
    updateCompany,
    deleteCompany
} = require("../controllers/companyController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const auditLog = require("../middleware/auditMiddleware");

// Create company
router.post(
    "/",
    protect,
    authorize("SUPER_ADMIN"),
    auditLog("COMPANY", "CREATE"),
    createCompany
);

// Get all companies
router.get(
    "/",
    protect,
    authorize("SUPER_ADMIN"),
    getCompanies
);

// Get company by ID
router.get(
    "/:id",
    protect,
    authorize("SUPER_ADMIN"),
    getCompanyById
);

// Update company
router.put(
    "/:id",
    protect,
    authorize("SUPER_ADMIN"),
    auditLog("COMPANY", "UPDATE"),
    updateCompany
);

// Delete company
router.delete(
    "/:id",
    protect,
    authorize("SUPER_ADMIN"),
    auditLog("COMPANY", "DELETE"),
    deleteCompany
);

module.exports = router;