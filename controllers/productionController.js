const ProductionArea = require("../models/ProductionArea");
const Company = require("../models/Company");

const createProductionArea = async (req, res) => {
    try {
        let {
            companyId,
            name,
            code,
            description
        } = req.body;

        if (req.user.role !== "SUPER_ADMIN") {
            companyId = req.user.companyId;
        }

        if (!companyId || !name || !code) {
            return res.status(400).json({
                success: false,
                message: "Company, production area name and code are required"
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

        const productionAreaCount = await ProductionArea.countDocuments({
            companyId
        });

        if (productionAreaCount >= company.maxProductionAreas) {
            return res.status(403).json({
                success: false,
                message: "Production area limit reached for this company"
            });
        }

        const existingArea = await ProductionArea.findOne({
            companyId,
            code: code.toUpperCase()
        });

        if (existingArea) {
            return res.status(409).json({
                success: false,
                message: "Production area code already exists in this company"
            });
        }

        const productionArea = await ProductionArea.create({
            companyId,
            name,
            code: code.toUpperCase(),
            description
        });

        res.status(201).json({
            success: true,
            message: "Production area created successfully",
            productionArea
        });
    } catch (error) {
        console.error("Create production area error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create production area",
            error: error.message
        });
    }
};

const getProductionAreas = async (req, res) => {
    try {
        let { companyId } = req.params;

        if (req.user.role !== "SUPER_ADMIN") {
            companyId = req.user.companyId;
        }

        const productionAreas = await ProductionArea.find({
            companyId
        })
            .populate("managerId", "name email role")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: productionAreas.length,
            productionAreas
        });
    } catch (error) {
        console.error("Get production areas error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get production areas",
            error: error.message
        });
    }
};

const getProductionAreaById = async (req, res) => {
    try {
        const filter = {
            _id: req.params.id
        };

        if (req.user.role !== "SUPER_ADMIN") {
            filter.companyId = req.user.companyId;
        }

        const productionArea = await ProductionArea.findOne(filter)
            .populate("managerId", "name email role")
            .populate("companyId", "name email");

        if (!productionArea) {
            return res.status(404).json({
                success: false,
                message: "Production area not found"
            });
        }

        res.status(200).json({
            success: true,
            productionArea
        });
    } catch (error) {
        console.error("Get production area error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get production area",
            error: error.message
        });
    }
};

const updateProductionArea = async (req, res) => {
    try {
        const filter = {
            _id: req.params.id
        };

        if (req.user.role !== "SUPER_ADMIN") {
            filter.companyId = req.user.companyId;
        }

        const productionArea = await ProductionArea.findOne(filter);

        if (!productionArea) {
            return res.status(404).json({
                success: false,
                message: "Production area not found or you do not have access"
            });
        }

        const {
            name,
            code,
            description,
            status
        } = req.body;

        if (name !== undefined) {
            productionArea.name = name;
        }

        if (code !== undefined) {
            const existingArea = await ProductionArea.findOne({
                companyId: productionArea.companyId,
                code: code.toUpperCase(),
                _id: { $ne: productionArea._id }
            });

            if (existingArea) {
                return res.status(409).json({
                    success: false,
                    message: "Production area code already exists in this company"
                });
            }

            productionArea.code = code.toUpperCase();
        }

        if (description !== undefined) {
            productionArea.description = description;
        }

        if (status !== undefined) {
            productionArea.status = status;
        }

        await productionArea.save();

        res.status(200).json({
            success: true,
            message: "Production area updated successfully",
            productionArea
        });
    } catch (error) {
        console.error("Update production area error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update production area",
            error: error.message
        });
    }
};

const deleteProductionArea = async (req, res) => {
    try {
        const filter = {
            _id: req.params.id
        };

        if (req.user.role !== "SUPER_ADMIN") {
            filter.companyId = req.user.companyId;
        }

        const productionArea = await ProductionArea.findOne(filter);

        if (!productionArea) {
            return res.status(404).json({
                success: false,
                message: "Production area not found or you do not have access"
            });
        }

        await productionArea.deleteOne();

        res.status(200).json({
            success: true,
            message: "Production area deleted successfully"
        });
    } catch (error) {
        console.error("Delete production area error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete production area",
            error: error.message
        });
    }
};

module.exports = {
    createProductionArea,
    getProductionAreas,
    getProductionAreaById,
    updateProductionArea,
    deleteProductionArea
};