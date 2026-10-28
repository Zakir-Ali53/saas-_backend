
const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Company name is required"],
            trim: true,
            minlength: [2, "Company name must be at least 2 characters"],
            maxlength: [120, "Company name cannot exceed 120 characters"]
        },

        email: {
            type: String,
            required: [true, "Company email is required"],
            lowercase: true,
            trim: true,
            maxlength: [254, "Company email is too long"],
            match: [
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                "Please provide a valid company email"
            ],
            unique: true
        },

        phone: {
            type: String,
            trim: true,
            maxlength: [30, "Phone number is too long"]
        },

        address: {
            type: String,
            trim: true,
            maxlength: [500, "Address cannot exceed 500 characters"]
        },

        maxBranches: {
            type: Number,
            required: true,
            default: 5,
            min: 0,
            max: 10000,
            validate: {
                validator: Number.isInteger,
                message: "Maximum branches must be a whole number"
            }
        },

        maxProductionAreas: {
            type: Number,
            required: true,
            default: 3,
            min: 0,
            max: 10000,
            validate: {
                validator: Number.isInteger,
                message: "Maximum production areas must be a whole number"
            }
        },

        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
            default: "ACTIVE",
            index: true
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

companySchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Company", companySchema);
