
const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");

const isValidId = (value) => {
    return Boolean(value && mongoose.isValidObjectId(value));
};

const auditLog = (moduleName, action) => {
    return (req, res, next) => {
        let logged = false;

        const writeAuditLog = async () => {
            if (logged) return;
            logged = true;

            if (!req.user || !req.user._id) {
                return;
            }

            try {
                const successful =
                    res.statusCode >= 200 && res.statusCode < 300;

                let companyId = req.user.companyId || null;
                let branchId = req.user.branchId || null;

                // Controllers may set these after validating the resource.
                if (req.auditCompanyId !== undefined) {
                    companyId = req.auditCompanyId;
                }

                if (req.auditBranchId !== undefined) {
                    branchId = req.auditBranchId;
                }

                // For company and branch routes, use the target ID only
                // after the request has passed authorization and validation.
                if (moduleName === "COMPANY" && isValidId(req.params.id)) {
                    companyId = req.params.id;
                }

                if (moduleName === "BRANCH" && isValidId(req.params.id)) {
                    branchId = req.params.id;
                }

                if (companyId && !isValidId(companyId)) {
                    companyId = null;
                }

                if (branchId && !isValidId(branchId)) {
                    branchId = null;
                }

                const requestedTargetId =
                    req.auditTargetId || req.params.id || null;

                const targetId = isValidId(requestedTargetId)
                    ? requestedTargetId
                    : null;

                const auditData = {
                    companyId,
                    userId: req.user._id,
                    action: successful ? action : `${action}_FAILED`,
                    module: moduleName,
                    description: successful
                        ? `${action} action performed in ${moduleName}`
                        : `${action} action failed in ${moduleName}`,
                    targetId,
                    targetType: moduleName,
                    branchId,
                    ipAddress: req.ip
                };

                // Only add metadata explicitly supplied by trusted
                // server-side code, never directly from the request body.
                if (
                    req.auditMetadata &&
                    typeof req.auditMetadata === "object" &&
                    !Array.isArray(req.auditMetadata)
                ) {
                    auditData.metadata = req.auditMetadata;
                }

                await AuditLog.create(auditData);
            } catch (error) {
                console.error("Audit logging error:", error.message);
            }
        };

        res.once("finish", () => {
            void writeAuditLog();
        });

        return next();
    };
};

module.exports = auditLog;
