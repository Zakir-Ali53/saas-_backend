const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema(
    {
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
            index: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        code: {
            type: String,
            required: true,
            trim: true,
            uppercase: true
        },

        phone: {
            type: String,
            trim: true
        },

        address: {
            type: String,
            trim: true
        },

        managerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE"],
            default: "ACTIVE"
        }
    },
    {
        timestamps: true
    }
);

branchSchema.index(
    {
        companyId: 1,
        code: 1
    },
    {
        unique: true
    }
);

module.exports = mongoose.model("Branch", branchSchema);