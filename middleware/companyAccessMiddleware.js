
const mongoose = require("mongoose");
const Company = require("../models/Company");

const companyAccess = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const requestedCompanyId =
            req.params.companyId ||
            req.body.companyId ||
            req.query.companyId ||
            req.params.id;

        if (req.user.role === "SUPER_ADMIN") {
            if (
                requestedCompanyId &&
                !mongoose.isValidObjectId(requestedCompanyId)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid company ID"
                });
            }

            if (requestedCompanyId) {
                const company = await Company.findById(requestedCompanyId);

                if (!company) {
                    return res.status(404).json({
                        success: false,
                        message: "Company not found"
                    });
                }

                req.companyId = company._id;
                req.company = company;
            }

            return next();
        }

        if (!req.user.companyId) {
            return res.status(403).json({
                success: false,
                message: "User is not assigned to a company"
            });
        }

        if (
            requestedCompanyId &&
            !mongoose.isValidObjectId(requestedCompanyId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid company ID"
            });
        }

        if (
            requestedCompanyId &&
            req.user.companyId.toString() !== requestedCompanyId.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this company"
            });
        }

        const company = await Company.findOne({
            _id: req.user.companyId,
            status: "ACTIVE"
        });

        if (!company) {
            return res.status(403).json({
                success: false,
                message: "Company is not active or does not exist"
            });
        }

        req.companyId = company._id;
        req.company = company;

        return next();
    } catch (error) {
        console.error("Company access error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Company access verification failed"
        });
    }
};

module.exports = companyAccess;
