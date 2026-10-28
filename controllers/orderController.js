
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Branch = require("../models/Branch");
const Inventory = require("../models/Inventory");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const getOrderFilter = (req) => {
    const filter = {
        _id: req.params.id
    };

    if (req.user.role !== "SUPER_ADMIN") {
        filter.companyId = req.user.companyId;
    }

    if (
        ["BRANCH_ADMIN", "BRANCH_MANAGER", "STAFF"].includes(
            req.user.role
        )
    ) {
        filter.branchId = req.user.branchId;
    }

    return filter;
};

const getOrdersFilter = (req) => {
    const filter = {};

    if (req.user.role === "SUPER_ADMIN") {
        if (req.query.companyId) {
            filter.companyId = req.query.companyId;
        }
    } else {
        filter.companyId = req.user.companyId;
    }

    if (req.query.branchId) {
        if (
            req.user.branchId &&
            ["BRANCH_ADMIN", "BRANCH_MANAGER", "STAFF"].includes(
                req.user.role
            ) &&
            String(req.query.branchId) !== String(req.user.branchId)
        ) {
            filter.branchId = req.user.branchId;
        } else {
            filter.branchId = req.query.branchId;
        }
    } else if (
        ["BRANCH_ADMIN", "BRANCH_MANAGER", "STAFF"].includes(
            req.user.role
        )
    ) {
        filter.branchId = req.user.branchId;
    }

    if (req.query.orderStatus) {
        filter.orderStatus = req.query.orderStatus;
    }

    if (req.query.paymentStatus) {
        filter.paymentStatus = req.query.paymentStatus;
    }

    return filter;
};

// Create Order
const createOrder = async (req, res) => {
    const deductedStock = [];

    try {
        const {
            companyId,
            branchId,
            orderNumber,
            customerName,
            customerPhone,
            items,
            discount = 0,
            paymentStatus = "PENDING"
        } = req.body;

        const finalCompanyId =
            req.user.role === "SUPER_ADMIN"
                ? companyId
                : req.user.companyId;

        if (
            !finalCompanyId ||
            !branchId ||
            !orderNumber ||
            !Array.isArray(items) ||
            items.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Company, branch, order number and order items are required"
            });
        }

        if (
            !isValidId(finalCompanyId) ||
            !isValidId(branchId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid company or branch ID"
            });
        }

        if (
            req.user.role !== "SUPER_ADMIN" &&
            !req.user.companyId
        ) {
            return res.status(403).json({
                success: false,
                message: "Your account is not assigned to a company"
            });
        }

        if (
            req.user.branchId &&
            ["BRANCH_ADMIN", "BRANCH_MANAGER", "STAFF"].includes(
                req.user.role
            ) &&
            String(req.user.branchId) !== String(branchId)
        ) {
            return res.status(403).json({
                success: false,
                message: "You can only create orders for your own branch"
            });
        }

        const finalDiscount = Number(discount);

        if (
            !Number.isFinite(finalDiscount) ||
            finalDiscount < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Discount must be a valid non-negative number"
            });
        }

        const branch = await Branch.findOne({
            _id: branchId,
            companyId: finalCompanyId
        });

        if (!branch) {
            return res.status(404).json({
                success: false,
                message: "Branch not found in this company"
            });
        }

        const existingOrder = await Order.findOne({
            companyId: finalCompanyId,
            branchId,
            orderNumber
        });

        if (existingOrder) {
            return res.status(409).json({
                success: false,
                message: "Order number already exists in this branch"
            });
        }

        const processedItems = [];
        const requestedQuantities = new Map();
        let subtotal = 0;

        for (const item of items) {
            if (
                !item.productId ||
                !isValidId(item.productId)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Each order item must have a valid product ID"
                });
            }

            const quantity = Number(item.quantity);

            if (
                !Number.isFinite(quantity) ||
                quantity <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Product quantity must be a valid number greater than 0"
                });
            }

            const product = await Product.findOne({
                _id: item.productId,
                companyId: finalCompanyId
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found in this company"
                });
            }

            const unitPrice =
                item.unitPrice !== undefined
                    ? Number(item.unitPrice)
                    : Number(product.price || 0);

            if (
                !Number.isFinite(unitPrice) ||
                unitPrice < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Unit price must be a valid non-negative number"
                });
            }

            const totalPrice = unitPrice * quantity;

            if (!Number.isFinite(totalPrice)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid item total"
                });
            }

            subtotal += totalPrice;

            processedItems.push({
                productId: product._id,
                quantity,
                unitPrice,
                totalPrice
            });

            const productKey = String(product._id);

            requestedQuantities.set(
                productKey,
                (requestedQuantities.get(productKey) || 0) + quantity
            );
        }

        if (
            !Number.isFinite(subtotal) ||
            finalDiscount > subtotal
        ) {
            return res.status(400).json({
                success: false,
                message: "Discount cannot be greater than subtotal"
            });
        }

        const totalAmount = subtotal - finalDiscount;

        const validPaymentStatuses = [
            "PENDING",
            "PAID",
            "PARTIAL",
            "REFUNDED"
        ];

        if (!validPaymentStatuses.includes(paymentStatus)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment status"
            });
        }

        for (const [productId, quantity] of requestedQuantities) {
            const inventory = await Inventory.findOneAndUpdate(
                {
                    companyId: finalCompanyId,
                    branchId,
                    productId,
                    quantity: { $gte: quantity }
                },
                {
                    $inc: { quantity: -quantity }
                },
                { new: true }
            );

            if (!inventory) {
                throw new Error(
                    `Insufficient stock or inventory missing for product ${productId}`
                );
            }

            deductedStock.push({
                companyId: finalCompanyId,
                branchId,
                productId,
                quantity
            });
        }

        const order = await Order.create({
            companyId: finalCompanyId,
            branchId,
            orderNumber: String(orderNumber).trim(),
            customerName,
            customerPhone,
            items: processedItems,
            subtotal,
            discount: finalDiscount,
            totalAmount,
            paymentStatus,
            orderStatus: "CONFIRMED",
            createdBy: req.user._id
        });

        const populatedOrder = await Order.findById(order._id)
            .populate("companyId", "name")
            .populate("branchId", "name code")
            .populate("items.productId", "name sku price")
            .populate("createdBy", "name email role");

        return res.status(201).json({
            success: true,
            message: "Order created and stock deducted successfully",
            order: populatedOrder
        });
    } catch (error) {
        for (const stock of deductedStock.reverse()) {
            try {
                await Inventory.updateOne(
                    {
                        companyId: stock.companyId,
                        branchId: stock.branchId,
                        productId: stock.productId
                    },
                    {
                        $inc: { quantity: stock.quantity }
                    }
                );
            } catch (rollbackError) {
                console.error(
                    "Stock rollback error:",
                    rollbackError.message
                );
            }
        }

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Order number already exists in this branch"
            });
        }

        if (
            error.message.startsWith("Insufficient stock") ||
            error.message.startsWith("Inventory missing")
        ) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        console.error("Create order error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to create order"
        });
    }
};

// Get Orders
const getOrders = async (req, res) => {
    try {
        const filter = getOrdersFilter(req);

        const orders = await Order.find(filter)
            .populate("companyId", "name")
            .populate("branchId", "name code")
            .populate("items.productId", "name sku price")
            .populate("createdBy", "name email role")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: orders.length,
            orders
        });
    } catch (error) {
        console.error("Get orders error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to get orders"
        });
    }
};

// Get Single Order
const getOrderById = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }

        const order = await Order.findOne(getOrderFilter(req))
            .populate("companyId", "name")
            .populate("branchId", "name code")
            .populate("items.productId", "name sku price")
            .populate("createdBy", "name email role");

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        return res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        console.error("Get order error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to get order"
        });
    }
};

// Update Order Status
const updateOrderStatus = async (req, res) => {
    try {
        const { orderStatus, paymentStatus } = req.body;

        if (
            orderStatus === undefined &&
            paymentStatus === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Provide an order status or payment status to update"
            });
        }

        if (orderStatus !== undefined) {
            const validOrderStatuses = [
                "PENDING",
                "CONFIRMED",
                "COMPLETED",
                "CANCELLED"
            ];

            if (!validOrderStatuses.includes(orderStatus)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid order status"
                });
            }

            if (orderStatus === "CANCELLED") {
                return res.status(400).json({
                    success: false,
                    message: "Use the cancel order endpoint to cancel an order and restore stock"
                });
            }
        }

        if (
            paymentStatus !== undefined &&
            !["PENDING", "PAID", "PARTIAL", "REFUNDED"].includes(
                paymentStatus
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment status"
            });
        }

        if (!isValidId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }

        const order = await Order.findOne(getOrderFilter(req));

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        if (order.orderStatus === "CANCELLED") {
            return res.status(400).json({
                success: false,
                message: "Cancelled order cannot be updated"
            });
        }

        if (
            order.orderStatus === "COMPLETED" &&
            orderStatus !== undefined &&
            orderStatus !== "COMPLETED"
        ) {
            return res.status(400).json({
                success: false,
                message: "Completed order status cannot be changed"
            });
        }

        if (orderStatus !== undefined) {
            order.orderStatus = orderStatus;
        }

        if (paymentStatus !== undefined) {
            order.paymentStatus = paymentStatus;
        }

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Order updated successfully",
            order
        });
    } catch (error) {
        console.error("Update order status error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to update order status"
        });
    }
};

// Cancel Order
const cancelOrder = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }

        const order = await Order.findOne(getOrderFilter(req));

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        if (order.orderStatus === "CANCELLED") {
            return res.status(400).json({
                success: false,
                message: "Order is already cancelled"
            });
        }

        if (order.orderStatus === "COMPLETED") {
            return res.status(400).json({
                success: false,
                message: "Completed order cannot be cancelled"
            });
        }

        const stockToRestore = new Map();

        for (const item of order.items) {
            const productId = String(item.productId);

            stockToRestore.set(
                productId,
                (stockToRestore.get(productId) || 0) + Number(item.quantity)
            );
        }

        const inventories = [];

        for (const [productId, quantity] of stockToRestore) {
            const inventory = await Inventory.findOne({
                companyId: order.companyId,
                branchId: order.branchId,
                productId
            });

            if (!inventory) {
                return res.status(409).json({
                    success: false,
                    message: "Cannot cancel order because inventory is missing for a product"
                });
            }

            inventories.push({
                productId,
                quantity
            });
        }

        const updatedOrder = await Order.findOneAndUpdate(
            {
                _id: order._id,
                orderStatus: { $nin: ["CANCELLED", "COMPLETED"] }
            },
            {
                $set: { orderStatus: "CANCELLED" }
            },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(409).json({
                success: false,
                message: "Order status changed. Please refresh and try again"
            });
        }

        const restoredStock = [];

        try {
            for (const stock of inventories) {
                const result = await Inventory.updateOne(
                    {
                        companyId: order.companyId,
                        branchId: order.branchId,
                        productId: stock.productId
                    },
                    {
                        $inc: { quantity: stock.quantity }
                    }
                );

                if (result.matchedCount !== 1) {
                    throw new Error(
                        `Inventory disappeared for product ${stock.productId}`
                    );
                }

                restoredStock.push(stock);
            }
        } catch (stockError) {
            for (const stock of restoredStock.reverse()) {
                try {
                    await Inventory.updateOne(
                        {
                            companyId: order.companyId,
                            branchId: order.branchId,
                            productId: stock.productId
                        },
                        {
                            $inc: { quantity: -stock.quantity }
                        }
                    );
                } catch (rollbackError) {
                    console.error(
                        "Stock rollback error:",
                        rollbackError.message
                    );
                }
            }

            await Order.updateOne(
                {
                    _id: order._id,
                    orderStatus: "CANCELLED"
                },
                {
                    $set: { orderStatus: order.orderStatus }
                }
            );

            throw stockError;
        }

        return res.status(200).json({
            success: true,
            message: "Order cancelled and stock restored successfully",
            order: updatedOrder
        });
    } catch (error) {
        console.error("Cancel order error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to cancel order. Please review inventory and order status"
        });
    }
};

module.exports = {
    createOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
    cancelOrder
};