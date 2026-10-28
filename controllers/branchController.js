
const mongoose = require("mongoose");
const Branch = require("../models/Branch");
const Company = require("../models/Company");

const MANAGE_ROLES = ["SUPER_ADMIN", "COMPANY_ADMIN"];

const isValidId = (id) => mongoose.isValidObjectId(id);

const handleError = (res, error, message) => {
    console.error(`${message}:`, error.message);

    if (error.code === 11000) {
        return res.status(409).json({
            success: false,
            message: "A branch with this code already exists in the company"
        });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
        return res.status(400).json({
            success: false,
            message: "Invalid branch information"
        });
    }

    return res.status(500).json({
        success: false,
        message
    });
};

const getCompanyScopedFilter = (req) => {
    const filter = {};

    if (req.user.role !== "SUPER_ADMIN") {
        filter.companyId = req.user.companyId;
    }

    return filter;
};

const createBranch = async (req, res) => {
    try {
        if (!MANAGE_ROLES.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to create branches"
            });
        }

        let { companyId, name, code, phone, address } = req.body;

        if (req.user.role !== "SUPER_ADMIN") {
            companyId = req.user.companyId;
        }

        if (
            !companyId ||
            !isValidId(companyId) ||
            typeof name !== "string" ||
            !name.trim() ||
            typeof code !== "string" ||
            !code.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid company ID, branch name and code are required"
            });
        }

        const normalizedCode = code.trim().toUpperCase();

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

        const branchCount = await Branch.countDocuments({
            companyId: company._id,
            status: "ACTIVE"
        });

        if (branchCount >= company.maxBranches) {
            return res.status(403).json({
                success: false,
                message: "Branch limit reached for this company"
            });
        }

        const existingBranch = await Branch.findOne({
            companyId: company._id,
            code: normalizedCode
        }).select("_id");

        if (existingBranch) {
            return res.status(409).json({
                success: false,
                message: "Branch code already exists in this company"
            });
        }

        const branch = await Branch.create({
            companyId: company._id,
            name: name.trim(),
            code: normalizedCode,
            phone,
            address,
            status: "ACTIVE"
        });

        return res.status(201).json({
            success: true,
            message: "Branch created successfully",
            branch
        });
    } catch (error) {
        return handleError(res, error, "Failed to create branch");
    }
};

const getBranches = async (req, res) => {
    try {
        const filter = getCompanyScopedFilter(req);
        const requestedCompanyId = req.params.companyId || req.query.companyId;

        if (req.user.role === "SUPER_ADMIN") {
            if (!requestedCompanyId) {
                return res.status(400).json({
                    success: false,
                    message: "Company ID is required"
                });
            }

            if (!isValidId(requestedCompanyId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid company ID"
                });
            }

            filter.companyId = requestedCompanyId;
        }

        if (!filter.companyId) {
            return res.status(403).json({
                success: false,
                message: "User is not assigned to a company"
            });
        }

        if (
            ["BRANCH_ADMIN", "BRANCH_MANAGER", "STAFF"].includes(
                req.user.role
            )
        ) {
            if (!req.user.branchId || !isValidId(req.user.branchId)) {
                return res.status(403).json({
                    success: false,
                    message: "User is not assigned to a branch"
                });
            }

            filter._id = req.user.branchId;
        }

        const branches = await Branch.find(filter)
            .populate("managerId", "name email role")
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: branches.length,
            branches
        });
    } catch (error) {
        return handleError(res, error, "Failed to get branches");
    }
};

const getBranchById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid branch ID"
            });
        }

        const filter = {
            _id: id,
            ...getCompanyScopedFilter(req)
        };

        if (
            ["BRANCH_ADMIN", "BRANCH_MANAGER", "STAFF"].includes(
                req.user.role
            )
        ) {
            if (
                !req.user.branchId ||
                req.user.branchId.toString() !== id
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have access to this branch"
                });
            }
        }

        const branch = await Branch.findOne(filter)
            .populate("managerId", "name email role")
            .populate("companyId", "name email")
            .lean();

        if (!branch) {
            return res.status(404).json({
                success: false,
                message: "Branch not found"
            });
        }

        return res.status(200).json({
            success: true,
            branch
        });
    } catch (error) {
        return handleError(res, error, "Failed to get branch");
    }
};

const updateBranch = async (req, res) => {
    try {
        if (!MANAGE_ROLES.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to update branches"
            });
        }

        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid branch ID"
            });
        }

        const filter = {
            _id: id,
            ...getCompanyScopedFilter(req)
        };

        const branch = await Branch.findOne(filter);

        if (!branch) {
            return res.status(404).json({
                success: false,
                message: "Branch not found"
            });
        }

        const { name, code, phone, address, status } = req.body;

        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "A valid branch name is required"
                });
            }

            branch.name = name.trim();
        }

        if (code !== undefined) {
            if (typeof code !== "string" || !code.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "A valid branch code is required"
                });
            }

            const normalizedCode = code.trim().toUpperCase();

            const duplicate = await Branch.findOne({
                companyId: branch.companyId,
                code: normalizedCode,
                _id: { $ne: branch._id }
            }).select("_id");

            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message: "Branch code already exists in this company"
                });
            }

            branch.code = normalizedCode;
        }

        if (phone !== undefined) branch.phone = phone;
        if (address !== undefined) branch.address = address;

        if (status !== undefined) {
            if (!["ACTIVE", "INACTIVE"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid branch status"
                });
            }

            if (status === "ACTIVE" && branch.status !== "ACTIVE") {
                const company = await Company.findById(branch.companyId);

                if (!company || company.status !== "ACTIVE") {
                    return res.status(403).json({
                        success: false,
                        message: "The branch company is not active"
                    });
                }

                const activeCount = await Branch.countDocuments({
                    companyId: branch.companyId,
                    status: "ACTIVE",
                    _id: { $ne: branch._id }
                });

                if (activeCount >= company.maxBranches) {
                    return res.status(403).json({
                        success: false,
                        message: "Branch limit reached for this company"
                    });
                }
            }

            branch.status = status;
        }

        await branch.save();

        return res.status(200).json({
            success: true,
            message: "Branch updated successfully",
            branch
        });
    } catch (error) {
        return handleError(res, error, "Failed to update branch");
    }
};

const deleteBranch = async (req, res) => {
    try {
        if (!MANAGE_ROLES.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to deactivate branches"
            });
        }

        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid branch ID"
            });
        }

        const filter = {
            _id: id,
            ...getCompanyScopedFilter(req)
        };

        const branch = await Branch.findOne(filter);

        if (!branch) {
            return res.status(404).json({
                success: false,
                message: "Branch not found"
            });
        }

        if (branch.status === "INACTIVE") {
            return res.status(200).json({
                success: true,
                message: "Branch is already inactive"
            });
        }

        branch.status = "INACTIVE";
        await branch.save();

        return res.status(200).json({
            success: true,
            message: "Branch deactivated. Historical records have been retained."
        });
    } catch (error) {
        return handleError(res, error, "Failed to deactivate branch");
    }
};

module.exports = {
    createBranch,
    getBranches,
    getBranchById,
    updateBranch,
    deleteBranch
};
