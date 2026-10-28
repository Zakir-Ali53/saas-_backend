const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Company = require("../models/Company");
const Branch = require("../models/Branch");
const ProductionArea = require("../models/ProductionArea");

const allowedCompanyRoles = [
    "COMPANY_ADMIN",
    "BRANCH_ADMIN",
    "BRANCH_MANAGER",
    "PRODUCTION_MANAGER",
    "STAFF"
];

const createUser = async (req, res) => {
    try {
        let {
            name,
            email,
            password,
            role,
            companyId,
            branchId,
            productionAreaId
        } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: "Name, email, password and role are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        if (req.user.role === "SUPER_ADMIN") {
            if (role === "SUPER_ADMIN") {
                return res.status(400).json({
                    success: false,
                    message: "Super Admin cannot be created from this endpoint"
                });
            }
        } else {
            companyId = req.user.companyId;

            if (!allowedCompanyRoles.includes(role)) {
                return res.status(403).json({
                    success: false,
                    message: "You cannot assign this role"
                });
            }
        }

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: "Company ID is required"
            });
        }

        const company = await Company.findById(companyId);

        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        if (company.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Company is not active"
            });
        }

        const existingUser = await User.findOne({
            email: email.toLowerCase()
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User already exists with this email"
            });
        }

        let branch = null;
        let productionArea = null;

        if (
            ["BRANCH_ADMIN", "BRANCH_MANAGER"].includes(role)
        ) {
            if (!branchId) {
                return res.status(400).json({
                    success: false,
                    message: "Branch ID is required for this role"
                });
            }

            branch = await Branch.findOne({
                _id: branchId,
                companyId
            });

            if (!branch) {
                return res.status(404).json({
                    success: false,
                    message: "Branch not found in this company"
                });
            }
        }

        if (role === "PRODUCTION_MANAGER") {
            if (!productionAreaId) {
                return res.status(400).json({
                    success: false,
                    message: "Production area ID is required for this role"
                });
            }

            productionArea = await ProductionArea.findOne({
                _id: productionAreaId,
                companyId
            });

            if (!productionArea) {
                return res.status(404).json({
                    success: false,
                    message: "Production area not found in this company"
                });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role,
            companyId,
            branchId:
                ["BRANCH_ADMIN", "BRANCH_MANAGER"].includes(role)
                    ? branchId
                    : null,
            productionAreaId:
                role === "PRODUCTION_MANAGER"
                    ? productionAreaId
                    : null,
            status: "ACTIVE"
        });

        if (branch && role === "BRANCH_MANAGER") {
            branch.managerId = user._id;
            await branch.save();
        }

        if (productionArea && role === "PRODUCTION_MANAGER") {
            productionArea.managerId = user._id;
            await productionArea.save();
        }

        res.status(201).json({
            success: true,
            message: "User created successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                companyId: user.companyId,
                branchId: user.branchId,
                productionAreaId: user.productionAreaId,
                status: user.status
            }
        });
    } catch (error) {
        console.error("Create user error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create user",
            error: error.message
        });
    }
};

const getUsers = async (req, res) => {
    try {
        const filter = {};

        if (req.user.role !== "SUPER_ADMIN") {
            filter.companyId = req.user.companyId;
        }

        const users = await User.find(filter)
            .select("-password")
            .populate("companyId", "name email")
            .populate("branchId", "name code")
            .populate("productionAreaId", "name code")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: users.length,
            users
        });
    } catch (error) {
        console.error("Get users error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get users",
            error: error.message
        });
    }
};

const getUserById = async (req, res) => {
    try {
        const filter = {
            _id: req.params.id
        };

        if (req.user.role !== "SUPER_ADMIN") {
            filter.companyId = req.user.companyId;
        }

        const user = await User.findOne(filter)
            .select("-password")
            .populate("companyId", "name email")
            .populate("branchId", "name code")
            .populate("productionAreaId", "name code");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found or you do not have access"
            });
        }

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        console.error("Get user error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get user",
            error: error.message
        });
    }
};

const updateUser = async (req, res) => {
    try {
        const filter = {
            _id: req.params.id
        };

        if (req.user.role !== "SUPER_ADMIN") {
            filter.companyId = req.user.companyId;
        }

        const user = await User.findOne(filter);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found or you do not have access"
            });
        }

        if (user.role === "SUPER_ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Super Admin cannot be modified here"
            });
        }

        const oldRole = user.role;
        const oldBranchId = user.branchId;
        const oldProductionAreaId = user.productionAreaId;

        const {
            name,
            email,
            password,
            role,
            branchId,
            productionAreaId,
            status
        } = req.body;

        if (name !== undefined) {
            user.name = name;
        }

        if (email !== undefined) {
            const existingUser = await User.findOne({
                email: email.toLowerCase(),
                _id: { $ne: user._id }
            });

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "Another user already uses this email"
                });
            }

            user.email = email.toLowerCase();
        }

        if (password !== undefined) {
            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: "Password must be at least 6 characters"
                });
            }

            user.password = await bcrypt.hash(password, 10);
        }

        if (role !== undefined) {
            if (!allowedCompanyRoles.includes(role)) {
                return res.status(403).json({
                    success: false,
                    message: "You cannot assign this role"
                });
            }

            user.role = role;
        }

        const finalRole = user.role;

        if (
            ["BRANCH_ADMIN", "BRANCH_MANAGER"].includes(finalRole)
        ) {
            const selectedBranchId = branchId || user.branchId;

            if (!selectedBranchId) {
                return res.status(400).json({
                    success: false,
                    message: "Branch ID is required for this role"
                });
            }

            const branch = await Branch.findOne({
                _id: selectedBranchId,
                companyId: user.companyId
            });

            if (!branch) {
                return res.status(404).json({
                    success: false,
                    message: "Branch not found in this company"
                });
            }

            user.branchId = selectedBranchId;
            user.productionAreaId = null;
        } else if (finalRole === "PRODUCTION_MANAGER") {
            const selectedProductionAreaId =
                productionAreaId || user.productionAreaId;

            if (!selectedProductionAreaId) {
                return res.status(400).json({
                    success: false,
                    message: "Production area ID is required for this role"
                });
            }

            const productionArea = await ProductionArea.findOne({
                _id: selectedProductionAreaId,
                companyId: user.companyId
            });

            if (!productionArea) {
                return res.status(404).json({
                    success: false,
                    message: "Production area not found in this company"
                });
            }

            user.productionAreaId = selectedProductionAreaId;
            user.branchId = null;
        } else {
            user.branchId = null;
            user.productionAreaId = null;
        }

        if (status !== undefined) {
            user.status = status;
        }

        await user.save();

        if (
            oldRole === "BRANCH_MANAGER" &&
            oldBranchId
        ) {
            await Branch.updateOne(
                {
                    _id: oldBranchId,
                    managerId: user._id
                },
                {
                    $set: {
                        managerId: null
                    }
                }
            );
        }

        if (
            oldRole === "PRODUCTION_MANAGER" &&
            oldProductionAreaId
        ) {
            await ProductionArea.updateOne(
                {
                    _id: oldProductionAreaId,
                    managerId: user._id
                },
                {
                    $set: {
                        managerId: null
                    }
                }
            );
        }

        if (
            user.role === "BRANCH_MANAGER" &&
            user.branchId
        ) {
            await Branch.updateOne(
                {
                    _id: user.branchId,
                    companyId: user.companyId
                },
                {
                    $set: {
                        managerId: user._id
                    }
                }
            );
        }

        if (
            user.role === "PRODUCTION_MANAGER" &&
            user.productionAreaId
        ) {
            await ProductionArea.updateOne(
                {
                    _id: user.productionAreaId,
                    companyId: user.companyId
                },
                {
                    $set: {
                        managerId: user._id
                    }
                }
            );
        }

        res.status(200).json({
            success: true,
            message: "User updated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                companyId: user.companyId,
                branchId: user.branchId,
                productionAreaId: user.productionAreaId,
                status: user.status
            }
        });
    } catch (error) {
        console.error("Update user error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update user",
            error: error.message
        });
    }
};

const deleteUser = async (req, res) => {
    try {
        const filter = {
            _id: req.params.id
        };

        if (req.user.role !== "SUPER_ADMIN") {
            filter.companyId = req.user.companyId;
        }

        const user = await User.findOne(filter);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found or you do not have access"
            });
        }

        if (user.role === "SUPER_ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Super Admin cannot be deleted"
            });
        }

        if (user.role === "BRANCH_MANAGER" && user.branchId) {
            await Branch.updateOne(
                {
                    _id: user.branchId,
                    managerId: user._id
                },
                {
                    $set: {
                        managerId: null
                    }
                }
            );
        }

        if (
            user.role === "PRODUCTION_MANAGER" &&
            user.productionAreaId
        ) {
            await ProductionArea.updateOne(
                {
                    _id: user.productionAreaId,
                    managerId: user._id
                },
                {
                    $set: {
                        managerId: null
                    }
                }
            );
        }

        await user.deleteOne();

        res.status(200).json({
            success: true,
            message: "User deleted successfully"
        });
    } catch (error) {
        console.error("Delete user error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete user",
            error: error.message
        });
    }
};

module.exports = {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser
};