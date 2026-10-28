const mongoose = require("mongoose");

const productionSchema = new mongoose.Schema(
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

    productionAreaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductionArea",
      required: true,
      index: true
    },

    finishedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },

    finishedQuantity: {
      type: Number,
      required: true,
      min: 0
    },

    rawMaterials: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true
        },

        quantityUsed: {
          type: Number,
          required: true,
          min: 0
        },

        unit: {
          type: String,
          default: "pcs",
          trim: true
        }
      }
    ],

    productionDate: {
      type: Date,
      default: Date.now
    },

    notes: {
      type: String,
      trim: true
    },

    status: {
      type: String,
      enum: ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "PLANNED"
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

module.exports = mongoose.model("Production", productionSchema);