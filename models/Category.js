const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
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

        description: {
            type: String,
            trim: true
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

categorySchema.index(
    {
        companyId: 1,
        name: 1
    },
    {
        unique: true
    }
);

module.exports = mongoose.model("Category", categorySchema);