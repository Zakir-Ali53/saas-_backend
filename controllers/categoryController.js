
const mongoose = require("mongoose");
const Category = require("../models/Category");

const normalizeName = (value) => {
    if (typeof value !== "string") return null;

    const name = value.trim();

    if (name.length < 2 || name.length > 100) return null;

    return name;
};

const getCompanyId = (req) => {
    if (req.user?.role === "SUPER_ADMIN") {
        return req.companyId || req.body.companyId || req.query.companyId;
    }

    return req.user?.companyId;
};

const validateCompanyId = (companyId, res) => {
    if (!companyId) {
        res.status(403).json({
            success: false,
            message: "User is not assigned to a company"
        });
        return false;
    }

    if (!mongoose.isValidObjectId(companyId)) {
        res.status(400).json({
            success: false,
            message: "Invalid company ID"
        });
        return false;
    }

    return true;
};

const handleError = (res, error, message) => {
    if (error.code === 11000) {
        return res.status(409).json({
            success: false,
            message: "A category with this name already exists in this company"
        });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
        return res.status(400).json({
            success: false,
            message: "Invalid category data"
        });
    }

    console.error(`${message}:`, error.message);

    return res.status(500).json({
        success: false,
        message
    });
};

const createCategory = async (req, res) => {
    try {
        const companyId = getCompanyId(req);

        if (!validateCompanyId(companyId, res)) return;

        const name = normalizeName(req.body.name);
        const description = req.body.description;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Category name must be between 2 and 100 characters"
            });
        }

        if (
            description !== undefined &&
            (typeof description !== "string" || description.trim().length > 500)
        ) {
            return res.status(400).json({
                success: false,
                message: "Description must be text and cannot exceed 500 characters"
            });
        }

        const category = await Category.create({
            companyId,
            name,
            description: description?.trim() || ""
        });

        return res.status(201).json({
            success: true,
            message: "Category created successfully",
            category
        });
    } catch (error) {
        return handleError(res, error, "Failed to create category");
    }
};

const getCategories = async (req, res) => {
    try {
        const companyId = getCompanyId(req);

        if (!validateCompanyId(companyId, res)) return;

        const categories = await Category.find({ companyId })
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: categories.length,
            categories
        });
    } catch (error) {
        return handleError(res, error, "Failed to get categories");
    }
};

const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = getCompanyId(req);

        if (!validateCompanyId(companyId, res)) return;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID"
            });
        }

        const category = await Category.findOne({
            _id: id,
            companyId
        }).lean();

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        return res.status(200).json({
            success: true,
            category
        });
    } catch (error) {
        return handleError(res, error, "Failed to get category");
    }
};

const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = getCompanyId(req);

        if (!validateCompanyId(companyId, res)) return;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID"
            });
        }

        const category = await Category.findOne({
            _id: id,
            companyId
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        const { name, description, status } = req.body;

        if (name !== undefined) {
            const normalizedName = normalizeName(name);

            if (!normalizedName) {
                return res.status(400).json({
                    success: false,
                    message: "Category name must be between 2 and 100 characters"
                });
            }

            category.name = normalizedName;
        }

        if (description !== undefined) {
            if (
                typeof description !== "string" ||
                description.trim().length > 500
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Description must be text and cannot exceed 500 characters"
                });
            }

            category.description = description.trim();
        }

        if (status !== undefined) {
            if (!["ACTIVE", "INACTIVE"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid category status"
                });
            }

            category.status = status;
        }

        await category.save();

        return res.status(200).json({
            success: true,
            message: "Category updated successfully",
            category
        });
    } catch (error) {
        return handleError(res, error, "Failed to update category");
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = getCompanyId(req);

        if (!validateCompanyId(companyId, res)) return;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID"
            });
        }

        const category = await Category.findOne({
            _id: id,
            companyId
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        category.status = "INACTIVE";
        await category.save();

        return res.status(200).json({
            success: true,
            message: "Category deactivated successfully"
        });
    } catch (error) {
        return handleError(res, error, "Failed to deactivate category");
    }
};

module.exports = {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
};
