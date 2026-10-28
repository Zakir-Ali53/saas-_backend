
const express = require("express");

const {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct
} = require("../controllers/productController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const companyAccess = require("../middleware/companyAccessMiddleware");

const router = express.Router();

router.use(protect);
router.use(companyAccess);

router.post(
    "/",
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    createProduct
);

router.get(
    "/",
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "STAFF",
        "BRANCH_ADMIN",
        "BRANCH_MANAGER",
        "PRODUCTION_MANAGER"
    ),
    getProducts
);

router.get(
    "/:id",
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "STAFF",
        "BRANCH_ADMIN",
        "BRANCH_MANAGER",
        "PRODUCTION_MANAGER"
    ),
    getProductById
);

router.put(
    "/:id",
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    updateProduct
);

router.delete(
    "/:id",
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    deleteProduct
);

module.exports = router;
