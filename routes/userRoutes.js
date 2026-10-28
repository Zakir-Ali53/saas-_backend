
const express = require("express");
const router = express.Router();

const {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser
} = require("../controllers/userController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const auditLog = require("../middleware/auditMiddleware");

// Create user
router.post(
    "/",
    protect,
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    auditLog("USER", "CREATE"),
    createUser
);

// Get all users
router.get(
    "/",
    protect,
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    getUsers
);

// Get single user
router.get(
    "/:id",
    protect,
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    getUserById
);

// Update user
router.put(
    "/:id",
    protect,
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    auditLog("USER", "UPDATE"),
    updateUser
);

// Delete user
router.delete(
    "/:id",
    protect,
    authorize("SUPER_ADMIN", "COMPANY_ADMIN"),
    auditLog("USER", "DELETE"),
    deleteUser
);

module.exports = router;