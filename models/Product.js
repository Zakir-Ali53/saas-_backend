const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
            index: true
        },

        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        sku: {
            type: String,
            required: true,
            trim: true,
            uppercase: true
        },

        description: {
            type: String,
            trim: true
        },

        unit: {
            type: String,
            required: true,
            trim: true,
            default: "PCS"
        },

        purchasePrice: {
            type: Number,
            default: 0,
            min: 0
        },

        salePrice: {
            type: Number,
            default: 0,
            min: 0
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

productSchema.index(
    {
        companyId: 1,
        sku: 1
    },
    {
        unique: true
    }
);

productSchema.index({
    companyId: 1,
    categoryId: 1
});

module.exports = mongoose.model("Product", productSchema);