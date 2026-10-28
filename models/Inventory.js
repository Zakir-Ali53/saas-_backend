const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
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

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },

    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },

    minStockLevel: {
      type: Number,
      default: 10,
      min: 0
    },

    unit: {
      type: String,
      default: "pcs",
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

inventorySchema.index(
  { companyId: 1, branchId: 1, productId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Inventory", inventorySchema);