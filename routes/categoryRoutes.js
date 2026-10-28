
const express = require("express");

const {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
} = require("../controllers/categoryController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const companyAccess = require("../middleware/companyAccessMiddleware");

const router = express.Router();

router.use(protect);
router.use(companyAccess);

router.post(
    "/",
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    createCategory
);

router.get(
    "/",
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "BRANCH_ADMIN",
        "BRANCH_MANAGER",
        "PRODUCTION_MANAGER",
        "STAFF"
    ),
    getCategories
);

router.get(
    "/:id",
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "BRANCH_ADMIN",
        "BRANCH_MANAGER",
        "PRODUCTION_MANAGER",
        "STAFF"
    ),
    getCategoryById
);

router.put(
    "/:id",
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    updateCategory
);

router.delete(
    "/:id",
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    deleteCategory
);

module.exports = router;
