
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Company = require("../models/Company");
const User = require("../models/User");
const Branch = require("../models/Branch");
const ProductionArea = require("../models/ProductionArea");

const normalizeEmail = (email) =>
    typeof email === "string" ? email.trim().toLowerCase() : "";

const isValidEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidLimit = (value) =>
    Number.isInteger(value) && value >= 0 && value <= 10000;

const handleError = (res, error, message) => {
    console.error(`${message}:`, error.message);

    if (error.code === 11000) {
        return res.status(409).json({
            success: false,
            message: "A company or user with this email already exists"
        });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
        return res.status(400).json({
            success: false,
            message: "Invalid data provided"
        });
    }

    return res.status(500).json({
        success: false,
        message
    });
};

const createCompany = async (req, res) => {
    let company;

    try {
        const {
            name,
            email,
            phone,
            address,
            adminName,
            adminEmail,
            adminPassword,
            maxBranches,
            maxProductionAreas
        } = req.body;

        const companyEmail = normalizeEmail(email);
        const normalizedAdminEmail = normalizeEmail(adminEmail);

        if (
            typeof name !== "string" ||
            !name.trim() ||
            typeof adminName !== "string" ||
            !adminName.trim() ||
            !isValidEmail(companyEmail) ||
            !isValidEmail(normalizedAdminEmail) ||
            typeof adminPassword !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid company and admin information is required"
            });
        }

        if (adminPassword.length < 12 || adminPassword.length > 128) {
            return res.status(400).json({
                success: false,
                message: "Admin password must be between 12 and 128 characters"
            });
        }

        if (
            maxBranches !== undefined &&
            !isValidLimit(maxBranches)
        ) {
            return res.status(400).json({
                success: false,
                message: "maxBranches must be a whole number between 0 and 10000"
            });
        }

        if (
            maxProductionAreas !== undefined &&
            !isValidLimit(maxProductionAreas)
        ) {
            return res.status(400).json({
                success: false,
                message: "maxProductionAreas must be a whole number between 0 and 10000"
            });
        }

        const [existingCompany, existingAdmin] = await Promise.all([
            Company.findOne({ email: companyEmail }).select("_id"),
            User.findOne({ email: normalizedAdminEmail }).select("_id")
        ]);

        if (existingCompany) {
            return res.status(409).json({
                success: false,
                message: "Company already exists with this email"
            });
        }

        if (existingAdmin) {
            return res.status(409).json({
                success: false,
                message: "Admin email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(adminPassword, 12);

        company = await Company.create({
            name: name.trim(),
            email: companyEmail,
            phone,
            address,
            maxBranches:
                maxBranches === undefined ? 5 : maxBranches,
            maxProductionAreas:
                maxProductionAreas === undefined ? 3 : maxProductionAreas,
            createdBy: req.user._id
        });

        let companyAdmin;

        try {
            companyAdmin = await User.create({
                name: adminName.trim(),
                email: normalizedAdminEmail,
                password: hashedPassword,
                role: "COMPANY_ADMIN",
                companyId: company._id,
                status: "ACTIVE"
            });
        } catch (error) {
            // Remove the company if its initial admin could not be created.
            await Company.deleteOne({ _id: company._id });
            throw error;
        }

        return res.status(201).json({
            success: true,
            message: "Company and Company Admin created successfully",
            company: {
                id: company._id,
                name: company.name,
                email: company.email,
                phone: company.phone,
                address: company.address,
                maxBranches: company.maxBranches,
                maxProductionAreas: company.maxProductionAreas,
                status: company.status
            },
            admin: {
                id: companyAdmin._id,
                name: companyAdmin.name,
                email: companyAdmin.email,
                role: companyAdmin.role,
                companyId: companyAdmin.companyId,
                status: companyAdmin.status
            }
        });
    } catch (error) {
        return handleError(res, error, "Failed to create company");
    }
};

const getCompanies = async (req, res) => {
    try {
        const companies = await Company.find()
            .populate("createdBy", "name email role")
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: companies.length,
            companies
        });
    } catch (error) {
        return handleError(res, error, "Failed to get companies");
    }
};

const getCompanyById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid company ID"
            });
        }

        const company = await Company.findById(id)
            .populate("createdBy", "name email role")
            .lean();

        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        return res.status(200).json({
            success: true,
            company
        });
    } catch (error) {
        return handleError(res, error, "Failed to get company");
    }
};

const updateCompany = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid company ID"
            });
        }

        const allowedFields = [
            "name",
            "email",
            "phone",
            "address",
            "status",
            "maxBranches",
            "maxProductionAreas"
        ];

        const suppliedFields = Object.keys(req.body);

        if (
            suppliedFields.length === 0 ||
            suppliedFields.some((field) => !allowedFields.includes(field))
        ) {
            return res.status(400).json({
                success: false,
                message: "Empty update or unsupported fields provided"
            });
        }

        const company = await Company.findById(id);

        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        if (req.body.name !== undefined) {
            if (
                typeof req.body.name !== "string" ||
                !req.body.name.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "A valid company name is required"
                });
            }

            company.name = req.body.name.trim();
        }

        if (req.body.email !== undefined) {
            const email = normalizeEmail(req.body.email);

            if (!isValidEmail(email)) {
                return res.status(400).json({
                    success: false,
                    message: "A valid company email is required"
                });
            }

            company.email = email;
        }

        if (req.body.phone !== undefined) {
            company.phone = req.body.phone;
        }

        if (req.body.address !== undefined) {
            company.address = req.body.address;
        }

        if (req.body.status !== undefined) {
            if (
                !["ACTIVE", "INACTIVE", "SUSPENDED"].includes(
                    req.body.status
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid company status"
                });
            }

            company.status = req.body.status;
        }

        if (req.body.maxBranches !== undefined) {
            if (!isValidLimit(req.body.maxBranches)) {
                return res.status(400).json({
                    success: false,
                    message: "maxBranches must be a whole number between 0 and 10000"
                });
            }

            const branchCount = await Branch.countDocuments({
                companyId: company._id
            });

            if (req.body.maxBranches < branchCount) {
                return res.status(400).json({
                    success: false,
                    message: "Branch limit cannot be lower than the existing branch count"
                });
            }

            company.maxBranches = req.body.maxBranches;
        }

        if (req.body.maxProductionAreas !== undefined) {
            if (!isValidLimit(req.body.maxProductionAreas)) {
                return res.status(400).json({
                    success: false,
                    message: "maxProductionAreas must be a whole number between 0 and 10000"
                });
            }

            const areaCount = await ProductionArea.countDocuments({
                companyId: company._id
            });

            if (req.body.maxProductionAreas < areaCount) {
                return res.status(400).json({
                    success: false,
                    message: "Production area limit cannot be lower than the existing area count"
                });
            }

            company.maxProductionAreas = req.body.maxProductionAreas;
        }

        await company.save();

        // Suspend company users when the company is not active.
        if (company.status !== "ACTIVE") {
            await User.updateMany(
                {
                    companyId: company._id,
                    role: { $ne: "SUPER_ADMIN" }
                },
                { $set: { status: "SUSPENDED" } }
            );
        }

        return res.status(200).json({
            success: true,
            message: "Company updated successfully",
            company
        });
    } catch (error) {
        return handleError(res, error, "Failed to update company");
    }
};

const deleteCompany = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid company ID"
            });
        }

        const company = await Company.findById(id);

        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        if (company.status === "SUSPENDED") {
            return res.status(200).json({
                success: true,
                message: "Company is already suspended"
            });
        }

        company.status = "SUSPENDED";
        await company.save();

        await User.updateMany(
            {
                companyId: company._id,
                role: { $ne: "SUPER_ADMIN" }
            },
            { $set: { status: "SUSPENDED" } }
        );

        return res.status(200).json({
            success: true,
            message: "Company suspended. Its records have been retained."
        });
    } catch (error) {
        return handleError(res, error, "Failed to suspend company");
    }
};

module.exports = {
    createCompany,
    getCompanies,
    getCompanyById,
    updateCompany,
    deleteCompany
};
