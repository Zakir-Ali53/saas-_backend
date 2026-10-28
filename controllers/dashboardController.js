const Company = require("../models/Company");
const User = require("../models/User");
const Branch = require("../models/Branch");
const ProductionArea = require("../models/ProductionArea");

const getCompanyDashboard = async (req, res) => {
    try {
        let companyId = req.params.companyId;

        if (req.user.role !== "SUPER_ADMIN") {
            companyId = req.user.companyId;
        }

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: "Company ID is required"
            });
        }

        const company = await Company.findOne({
            _id: companyId,
            status: "ACTIVE"
        });

        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found or inactive"
            });
        }

        if (
            req.user.role !== "SUPER_ADMIN" &&
            company._id.toString() !== req.user.companyId.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this company"
            });
        }

        const [
            totalUsers,
            activeUsers,
            totalBranches,
            activeBranches,
            totalProductionAreas,
            activeProductionAreas
        ] = await Promise.all([
            User.countDocuments({
                companyId
            }),

            User.countDocuments({
                companyId,
                status: "ACTIVE"
            }),

            Branch.countDocuments({
                companyId
            }),

            Branch.countDocuments({
                companyId,
                status: "ACTIVE"
            }),

            ProductionArea.countDocuments({
                companyId
            }),

            ProductionArea.countDocuments({
                companyId,
                status: "ACTIVE"
            })
        ]);

        res.status(200).json({
            success: true,
            dashboard: {
                company: {
                    id: company._id,
                    name: company.name,
                    email: company.email,
                    phone: company.phone,
                    address: company.address,
                    status: company.status
                },

                users: {
                    total: totalUsers,
                    active: activeUsers
                },

                branches: {
                    total: totalBranches,
                    active: activeBranches,
                    limit: company.maxBranches,
                    remaining: Math.max(
                        company.maxBranches - totalBranches,
                        0
                    )
                },

                productionAreas: {
                    total: totalProductionAreas,
                    active: activeProductionAreas,
                    limit: company.maxProductionAreas,
                    remaining: Math.max(
                        company.maxProductionAreas -
                            totalProductionAreas,
                        0
                    )
                }
            }
        });
    } catch (error) {
        console.error("Company dashboard error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load company dashboard",
            error: error.message
        });
    }
};

const getSuperAdminDashboard = async (req, res) => {
    try {
        const [
            totalCompanies,
            activeCompanies,
            totalUsers,
            activeUsers,
            totalBranches,
            activeBranches,
            totalProductionAreas,
            activeProductionAreas
        ] = await Promise.all([
            Company.countDocuments(),

            Company.countDocuments({
                status: "ACTIVE"
            }),

            User.countDocuments(),

            User.countDocuments({
                status: "ACTIVE"
            }),

            Branch.countDocuments(),

            Branch.countDocuments({
                status: "ACTIVE"
            }),

            ProductionArea.countDocuments(),

            ProductionArea.countDocuments({
                status: "ACTIVE"
            })
        ]);

        res.status(200).json({
            success: true,
            dashboard: {
                companies: {
                    total: totalCompanies,
                    active: activeCompanies
                },

                users: {
                    total: totalUsers,
                    active: activeUsers
                },

                branches: {
                    total: totalBranches,
                    active: activeBranches
                },

                productionAreas: {
                    total: totalProductionAreas,
                    active: activeProductionAreas
                }
            }
        });
    } catch (error) {
        console.error("Super Admin dashboard error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load Super Admin dashboard",
            error: error.message
        });
    }
};

module.exports = {
    getCompanyDashboard,
    getSuperAdminDashboard
};