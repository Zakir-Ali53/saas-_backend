
const express = require("express");

const {
    signup,
    login,
    createSuperAdmin,
    forgotPassword,
    resetPassword,
    changePassword
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// Public authentication routes
router.post("/signup", signup);
router.post("/login", login);

// Password management routes
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/change-password", protect, changePassword);

// Authenticated user profile
router.get("/me", protect, (req, res) => {
    res.status(200).json({
        success: true,
        user: req.user
    });
});

// Initial Super Admin setup
router.post("/create-super-admin", createSuperAdmin);

// Role access routes
router.get(
    "/super-admin-test",
    protect,
    authorize("SUPER_ADMIN"),
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "Super Admin access granted"
        });
    }
);

router.get(
    "/company-admin-test",
    protect,
    authorize("COMPANY_ADMIN"),
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "Company Admin access granted"
        });
    }
);

module.exports = router;
