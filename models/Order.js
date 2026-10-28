const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        unitPrice: {
            type: Number,
            required: true,
            min: 0
        },

        totalPrice: {
            type: Number,
            required: true,
            min: 0
        }
    },
    {
        _id: true
    }
);

const orderSchema = new mongoose.Schema(
    {
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
            index: true
        },

        branchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Branch",
            required: true,
            index: true
        },

        orderNumber: {
            type: String,
            required: true,
            trim: true
        },

        customerName: {
            type: String,
            trim: true
        },

        customerPhone: {
            type: String,
            trim: true
        },

        items: {
            type: [orderItemSchema],
            required: true,
            validate: {
                validator: function (items) {
                    return items.length > 0;
                },
                message: "Order must contain at least one item"
            }
        },

        subtotal: {
            type: Number,
            required: true,
            min: 0
        },

        discount: {
            type: Number,
            default: 0,
            min: 0
        },

        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },

        paymentStatus: {
            type: String,
            enum: ["PENDING", "PAID", "PARTIAL", "REFUNDED"],
            default: "PENDING"
        },

        orderStatus: {
            type: String,
            enum: [
                "PENDING",
                "CONFIRMED",
                "COMPLETED",
                "CANCELLED"
            ],
            default: "PENDING"
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

orderSchema.index(
    {
        companyId: 1,
        branchId: 1,
        orderNumber: 1
    },
    {
        unique: true
    }
);

module.exports = mongoose.model("Order", orderSchema);