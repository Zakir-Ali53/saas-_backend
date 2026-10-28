
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
    {
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            default: null,
            index: true
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },

        action: {
            type: String,
            required: true,
            trim: true,
            index: true
        },

        module: {
            type: String,
            required: true,
            trim: true,
            index: true
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500
        },

        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },

        targetType: {
            type: String,
            trim: true
        },

        branchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Branch",
            default: null,
            index: true
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: undefined
        },

        ipAddress: {
            type: String,
            trim: true
        }
    },
    {
        timestamps: true
    }
);

auditLogSchema.index({
    companyId: 1,
    createdAt: -1
});

auditLogSchema.index({
    userId: 1,
    createdAt: -1
});

auditLogSchema.index({
    module: 1,
    action: 1,
    createdAt: -1
});

module.exports = mongoose.model("AuditLog", auditLogSchema);