
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Category = require("../models/Category");

const getCompanyId = (req) => {
    if (req.user?.role === "SUPER_ADMIN") {
        return req.companyId || req.body.companyId || req.query.companyId;
    }

    return req.user?.companyId;
};

const validCompanyId = (companyId, res) => {
    if (!companyId) {
        res.status(403).json({
            success: false,
            message: "A company must be selected"
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

const validText = (value, min, max) =>
    typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max;

const validPrice = (value) => {
    if (
        value === null ||
        value === "" ||
        typeof value === "boolean"
    ) {
        return false;
    }

    const price = Number(value);
    return Number.isFinite(price) && price >= 0;
};

const handleError = (res, error, message) => {
    if (error.code === 11000) {
        return res.status(409).json({
            success: false,
            message: "This SKU already exists in your company"
        });
    }

    if (["ValidationError", "CastError"].includes(error.name)) {
        return res.status(400).json({
            success: false,
            message: "Invalid product data"
        });
    }

    console.error(`${message}:`, error.message);

    return res.status(500).json({
        success: false,
        message
    });
};

const createProduct = async (req, res) => {
    try {
        const companyId = getCompanyId(req);

        if (!validCompanyId(companyId, res)) return;

        const {
            categoryId,
            name,
            sku,
            description,
            unit,
            purchasePrice = 0,
            salePrice = 0
        } = req.body;

        if (
            !mongoose.isValidObjectId(categoryId) ||
            !validText(name, 2, 150) ||
            !validText(sku, 1, 60)
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid category, product name and SKU are required"
            });
        }

        if (
            !validPrice(purchasePrice) ||
            !validPrice(salePrice)
        ) {
            return res.status(400).json({
                success: false,
                message: "Prices must be valid non-negative numbers"
            });
        }

        if (
            description !== undefined &&
            (typeof description !== "string" || description.length > 1000)
        ) {
            return res.status(400).json({
                success: false,
                message: "Description cannot exceed 1000 characters"
            });
        }

        if (
            unit !== undefined &&
            !validText(unit, 1, 20)
        ) {
            return res.status(400).json({
                success: false,
                message: "Unit must be between 1 and 20 characters"
            });
        }

        const category = await Category.findOne({
            _id: categoryId,
            companyId,
            status: "ACTIVE"
        }).select("_id");

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Active category not found in this company"
            });
        }

        const product = await Product.create({
            companyId,
            categoryId,
            name: name.trim(),
            sku: sku.trim().toUpperCase(),
            description: description?.trim() || "",
            unit: unit?.trim().toUpperCase() || "PCS",
            purchasePrice: Number(purchasePrice),
            salePrice: Number(salePrice)
        });

        return res.status(201).json({
            success: true,
            message: "Product created successfully",
            product
        });
    } catch (error) {
        return handleError(res, error, "Failed to create product");
    }
};

const getProducts = async (req, res) => {
    try {
        const companyId = getCompanyId(req);

        if (!validCompanyId(companyId, res)) return;

        const products = await Product.find({ companyId })
            .populate("categoryId", "name status")
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: products.length,
            products
        });
    } catch (error) {
        return handleError(res, error, "Failed to get products");
    }
};

const getProductById = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const { id } = req.params;

        if (!validCompanyId(companyId, res)) return;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const product = await Product.findOne({
            _id: id,
            companyId
        }).populate("categoryId", "name status").lean();

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        return res.status(200).json({
            success: true,
            product
        });
    } catch (error) {
        return handleError(res, error, "Failed to get product");
    }
};

const updateProduct = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const { id } = req.params;

        if (!validCompanyId(companyId, res)) return;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const product = await Product.findOne({
            _id: id,
            companyId
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const {
            categoryId,
            name,
            sku,
            description,
            unit,
            purchasePrice,
            salePrice,
            status
        } = req.body;

        if (categoryId !== undefined) {
            if (!mongoose.isValidObjectId(categoryId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid category ID"
                });
            }

            const category = await Category.findOne({
                _id: categoryId,
                companyId,
                status: "ACTIVE"
            }).select("_id");

            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: "Active category not found in this company"
                });
            }

            product.categoryId = category._id;
        }

        if (name !== undefined) {
            if (!validText(name, 2, 150)) {
                return res.status(400).json({
                    success: false,
                    message: "Product name must be between 2 and 150 characters"
                });
            }

            product.name = name.trim();
        }

        if (sku !== undefined) {
            if (!validText(sku, 1, 60)) {
                return res.status(400).json({
                    success: false,
                    message: "SKU must be between 1 and 60 characters"
                });
            }

            product.sku = sku.trim().toUpperCase();
        }

        if (description !== undefined) {
            if (typeof description !== "string" || description.length > 1000) {
                return res.status(400).json({
                    success: false,
                    message: "Description cannot exceed 1000 characters"
                });
            }

            product.description = description.trim();
        }

        if (unit !== undefined) {
            if (!validText(unit, 1, 20)) {
                return res.status(400).json({
                    success: false,
                    message: "Unit must be between 1 and 20 characters"
                });
            }

            product.unit = unit.trim().toUpperCase();
        }

        if (purchasePrice !== undefined) {
            if (!validPrice(purchasePrice)) {
                return res.status(400).json({
                    success: false,
                    message: "Purchase price must be a non-negative number"
                });
            }

            product.purchasePrice = Number(purchasePrice);
        }

        if (salePrice !== undefined) {
            if (!validPrice(salePrice)) {
                return res.status(400).json({
                    success: false,
                    message: "Sale price must be a non-negative number"
                });
            }

            product.salePrice = Number(salePrice);
        }

        if (status !== undefined) {
            if (!["ACTIVE", "INACTIVE"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product status"
                });
            }

            product.status = status;
        }

        await product.save();

        return res.status(200).json({
            success: true,
            message: "Product updated successfully",
            product
        });
    } catch (error) {
        return handleError(res, error, "Failed to update product");
    }
};

const deleteProduct = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const { id } = req.params;

        if (!validCompanyId(companyId, res)) return;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const product = await Product.findOne({
            _id: id,
            companyId
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        product.status = "INACTIVE";
        await product.save();

        return res.status(200).json({
            success: true,
            message: "Product deactivated successfully"
        });
    } catch (error) {
        return handleError(res, error, "Failed to deactivate product");
    }
};

module.exports = {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct
};
