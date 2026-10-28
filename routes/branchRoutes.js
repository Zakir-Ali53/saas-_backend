
const express = require("express");
const router = express.Router();

const {
    createBranch,
    getBranches,
    getBranchById,
    updateBranch,
    deleteBranch
} = require("../controllers/branchController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const companyAccess = require("../middleware/companyAccessMiddleware");
const {
    branchAccess
} = require("../middleware/accessMiddleware");
const auditLog = require("../middleware/auditMiddleware");

// Create branch
router.post(
    "/",
    protect,
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    companyAccess,
    auditLog("BRANCH", "CREATE"),
    createBranch
);

// Get company branches
router.get(
    "/company/:companyId",
    protect,
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    companyAccess,
    getBranches
);

// Get single branch
router.get(
    "/:id",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "BRANCH_ADMIN",
        "BRANCH_MANAGER"
    ),
    branchAccess,
    getBranchById
);

// Update branch
router.put(
    "/:id",
    protect,
    authorize("SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_ADMIN"),
    branchAccess,
    auditLog("BRANCH", "UPDATE"),
    updateBranch
);

// Delete branch
router.delete(
    "/:id",
    protect,
    authorize("SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_ADMIN"),
    branchAccess,
    auditLog("BRANCH", "DELETE"),
    deleteBranch
);

module.exports = router;