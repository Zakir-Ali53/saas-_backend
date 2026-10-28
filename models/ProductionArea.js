const mongoose = require("mongoose");

const productionAreaSchema = new mongoose.Schema(
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

        description: {
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

productionAreaSchema.index(
    {
        companyId: 1,
        code: 1
    },
    {
        unique: true
    }
);

module.exports = mongoose.model(
    "ProductionArea",
    productionAreaSchema
);