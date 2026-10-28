const express = require("express");

const {
    createProductionArea,
    getProductionAreas,
    getProductionAreaById,
    updateProductionArea,
    deleteProductionArea
} = require("../controllers/productionController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const companyAccess = require("../middleware/companyAccessMiddleware");
const { productionAccess } = require("../middleware/accessMiddleware");

const router = express.Router();

router.post(
    "/",
    protect,
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    companyAccess,
    createProductionArea
);

router.get(
    "/company/:companyId",
    protect,
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    companyAccess,
    getProductionAreas
);

router.get(
    "/:id",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "PRODUCTION_MANAGER"
    ),
    productionAccess,
    getProductionAreaById
);

router.put(
    "/:id",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN",
        "PRODUCTION_MANAGER"
    ),
    productionAccess,
    updateProductionArea
);

router.delete(
    "/:id",
    protect,
    authorize(
        "SUPER_ADMIN",
        "COMPANY_ADMIN"
    ),
    productionAccess,
    deleteProductionArea
);

module.exports = router;