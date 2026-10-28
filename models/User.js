
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },

        password: {
            type: String,
            required: true,
            select: false
        },

        role: {
            type: String,
            enum: [
                "SUPER_ADMIN",
                "COMPANY_ADMIN",
                "BRANCH_ADMIN",
                "BRANCH_MANAGER",
                "PRODUCTION_MANAGER",
                "STAFF"
            ],
            default: "STAFF"
        },

        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            default: null,
            index: true
        },

        branchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Branch",
            default: null,
            index: true
        },

        productionAreaId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProductionArea",
            default: null,
            index: true
        },

        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
            default: "ACTIVE"
        },

        passwordResetToken: {
            type: String,
            select: false
        },

        passwordResetExpires: {
            type: Date,
            select: false
        }
    },
    {
        timestamps: true
    }
);

userSchema.index({
    companyId: 1,
    role: 1
});

userSchema.index({
    companyId: 1,
    branchId: 1
});

userSchema.index({
    companyId: 1,
    productionAreaId: 1
});

// Allow only one SUPER_ADMIN account in the database.
userSchema.index(
    { role: 1 },
    {
        unique: true,
        partialFilterExpression: {
            role: "SUPER_ADMIN"
        },
        name: "unique_super_admin_role"
    }
);

module.exports = mongoose.model("User", userSchema);
