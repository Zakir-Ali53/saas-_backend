
const mongoose = require("mongoose");
const Production = require("../models/Production");
const Inventory = require("../models/Inventory");
const Product = require("../models/Product");
const Branch = require("../models/Branch");
const Company = require("../models/Company");
const ProductionArea = require("../models/ProductionArea");

const BRANCH_ROLES = ["BRANCH_ADMIN", "BRANCH_MANAGER", "STAFF"];
const VALID_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const EDITABLE_STATUSES = ["PLANNED", "IN_PROGRESS"];

const isValidId = (id) =>
    typeof id === "string" &&
    mongoose.isValidObjectId(id) &&
    String(new mongoose.Types.ObjectId(id)) === id.toLowerCase();

const validQuantity = (value) => {
    if (
        value === "" ||
        value === null ||
        typeof value === "boolean" ||
        (typeof value !== "number" && typeof value !== "string")
    ) {
        return false;
    }

    const number = Number(value);
    return Number.isFinite(number) && number > 0;
};

const getProductionFilter = (req) => {
    const { role, companyId, branchId, productionAreaId } = req.user;
    const filter = {};

    if (role === "SUPER_ADMIN") {
        if (req.query.companyId) {
            filter.companyId = req.query.companyId;
        }
    } else {
        filter.companyId = companyId;
    }

    if (BRANCH_ROLES.includes(role)) {
        filter.branchId = branchId || null;
    }

    if (role === "PRODUCTION_MANAGER") {
        filter.productionAreaId = productionAreaId || null;
    }

    return filter;
};

const getSingleProductionFilter = (req) => ({
    ...getProductionFilter(req),
    _id: req.params.id
});

const populateProduction = (query) =>
    query
        .populate("companyId", "name")
        .populate("branchId", "name code")
        .populate("productionAreaId", "name code")
        .populate("finishedProductId", "name sku unit")
        .populate("rawMaterials.productId", "name sku unit")
        .populate("createdBy", "name email role");

const setAuditContext = (req, production) => {
    if (!production) return;

    req.auditCompanyId = production.companyId;
    req.auditBranchId = production.branchId;
    req.auditTargetId = production._id;
};

const sendError = (res, error, label) => {
    console.error(`${label}:`, error.message);

    return res.status(500).json({
        success: false,
        message: "An internal server error occurred"
    });
};

const validateProductionResources = async ({
    companyId,
    branchId,
    productionAreaId,
    finishedProductId
}) => {
    const company = await Company.findById(companyId).lean();

    if (!company || (company.status && company.status !== "ACTIVE")) {
        return { error: "Company not found or inactive" };
    }

    const branch = await Branch.findOne({
        _id: branchId,
        companyId,
        status: "ACTIVE"
    }).lean();

    if (!branch) {
        return { error: "Active branch not found in this company" };
    }

    const area = await ProductionArea.findOne({
        _id: productionAreaId,
        companyId,
        status: "ACTIVE"
    }).lean();

    if (!area) {
        return { error: "Active production area not found in this company" };
    }

    const finishedProduct = await Product.findOne({
        _id: finishedProductId,
        companyId,
        status: "ACTIVE"
    }).lean();

    if (!finishedProduct) {
        return { error: "Active finished product not found in this company" };
    }

    return { company, branch, area, finishedProduct };
};

// Create Production
const createProduction = async (req, res) => {
    try {
        const {
            companyId,
            branchId,
            productionAreaId,
            finishedProductId,
            finishedQuantity,
            rawMaterials = [],
            productionDate,
            notes,
            status = "PLANNED"
        } = req.body;

        const role = req.user.role;
        const finalCompanyId =
            role === "SUPER_ADMIN" ? companyId : req.user.companyId;

        if (
            !finalCompanyId ||
            !branchId ||
            !productionAreaId ||
            !finishedProductId
        ) {
            return res.status(400).json({
                success: false,
                message: "Company, branch, production area and finished product are required"
            });
        }

        if (
            !isValidId(String(finalCompanyId)) ||
            !isValidId(branchId) ||
            !isValidId(productionAreaId) ||
            !isValidId(finishedProductId)
        ) {
            return res.status(400).json({
                success: false,
                message: "One or more IDs are invalid"
            });
        }

        if (role !== "SUPER_ADMIN" && !req.user.companyId) {
            return res.status(403).json({
                success: false,
                message: "Your account is not assigned to a company"
            });
        }

        if (
            BRANCH_ROLES.includes(role) &&
            String(req.user.branchId) !== String(branchId)
        ) {
            return res.status(403).json({
                success: false,
                message: "You can only use your assigned branch"
            });
        }

        if (
            role === "PRODUCTION_MANAGER" &&
            (!req.user.productionAreaId ||
                String(req.user.productionAreaId) !== String(productionAreaId))
        ) {
            return res.status(403).json({
                success: false,
                message: "You can only use your assigned production area"
            });
        }

        if (!validQuantity(finishedQuantity)) {
            return res.status(400).json({
                success: false,
                message: "Finished quantity must be greater than zero"
            });
        }

        if (!Array.isArray(rawMaterials) || rawMaterials.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Raw materials must be an array containing at most 100 items"
            });
        }

        if (!EDITABLE_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Initial status must be PLANNED or IN_PROGRESS"
            });
        }

        if (
            productionDate !== undefined &&
            (typeof productionDate !== "string" ||
                !productionDate.trim() ||
                !Number.isFinite(Date.parse(productionDate)))
        ) {
            return res.status(400).json({
                success: false,
                message: "Production date must be a valid date string"
            });
        }

        if (
            notes !== undefined &&
            (typeof notes !== "string" || notes.length > 2000)
        ) {
            return res.status(400).json({
                success: false,
                message: "Notes must be text up to 2000 characters"
            });
        }

        const resources = await validateProductionResources({
            companyId: String(finalCompanyId),
            branchId,
            productionAreaId,
            finishedProductId
        });

        if (resources.error) {
            return res.status(400).json({
                success: false,
                message: resources.error
            });
        }

        if (
            role === "PRODUCTION_MANAGER" &&
            resources.area.managerId &&
            String(resources.area.managerId) !== String(req.user._id)
        ) {
            return res.status(403).json({
                success: false,
                message: "You are not the manager assigned to this production area"
            });
        }

        const materialTotals = new Map();

        for (const material of rawMaterials) {
            if (
                !material ||
                !isValidId(material.productId) ||
                !validQuantity(material.quantityUsed)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Each raw material requires a valid product ID and positive quantity"
                });
            }

            if (String(material.productId) === String(finishedProductId)) {
                return res.status(400).json({
                    success: false,
                    message: "Finished product cannot also be a raw material"
                });
            }

            const product = await Product.findOne({
                _id: material.productId,
                companyId: finalCompanyId,
                status: "ACTIVE"
            }).lean();

            if (!product) {
                return res.status(400).json({
                    success: false,
                    message: "A raw material product is inactive or belongs to another company"
                });
            }

            const unit = material.unit === undefined ? "pcs" : material.unit;

            if (
                typeof unit !== "string" ||
                !unit.trim() ||
                unit.trim().length > 30
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Each raw material unit must be valid text up to 30 characters"
                });
            }

            const key = String(product._id);
            const previous = materialTotals.get(key);

            if (previous) {
                if (previous.unit !== unit.trim()) {
                    return res.status(400).json({
                        success: false,
                        message: "Duplicate raw materials must use the same unit"
                    });
                }

                previous.quantityUsed += Number(material.quantityUsed);

                if (!Number.isFinite(previous.quantityUsed)) {
                    return res.status(400).json({
                        success: false,
                        message: "Combined raw material quantity is too large"
                    });
                }
            } else {
                materialTotals.set(key, {
                    productId: product._id,
                    quantityUsed: Number(material.quantityUsed),
                    unit: unit.trim()
                });
            }
        }

        const production = await Production.create({
            companyId: finalCompanyId,
            branchId,
            productionAreaId,
            finishedProductId,
            finishedQuantity: Number(finishedQuantity),
            rawMaterials: [...materialTotals.values()],
            productionDate: productionDate
                ? new Date(productionDate)
                : new Date(),
            notes: notes?.trim(),
            status,
            createdBy: req.user._id
        });

        setAuditContext(req, production);

        const result = await populateProduction(
            Production.findById(production._id)
        );

        return res.status(201).json({
            success: true,
            message: "Production created successfully",
            production: result
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A duplicate record conflicts with a database constraint"
            });
        }

        return sendError(res, error, "Create production error");
    }
};

// Get Production Records
const getProductions = async (req, res) => {
    try {
        const role = req.user.role;
        const filter = getProductionFilter(req);

        if (role === "SUPER_ADMIN" && !req.query.companyId) {
            return res.status(400).json({
                success: false,
                message: "Provide companyId to view production records"
            });
        }

        if (req.query.companyId && !isValidId(req.query.companyId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid company ID"
            });
        }

        if (
            role !== "SUPER_ADMIN" &&
            req.query.companyId &&
            String(req.query.companyId) !== String(req.user.companyId)
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot access another company's records"
            });
        }

        if (req.query.branchId) {
            if (!isValidId(req.query.branchId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid branch ID"
                });
            }

            if (
                BRANCH_ROLES.includes(role) &&
                String(req.query.branchId) !== String(req.user.branchId)
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You cannot access another branch"
                });
            }

            filter.branchId = req.query.branchId;
        }

        if (req.query.productionAreaId) {
            if (!isValidId(req.query.productionAreaId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid production area ID"
                });
            }

            if (
                role === "PRODUCTION_MANAGER" &&
                String(req.query.productionAreaId) !==
                    String(req.user.productionAreaId)
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You cannot access another production area"
                });
            }

            filter.productionAreaId = req.query.productionAreaId;
        }

        if (req.query.status) {
            if (!VALID_STATUSES.includes(req.query.status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid production status"
                });
            }

            filter.status = req.query.status;
        }

        const productions = await populateProduction(
            Production.find(filter)
                .sort({ createdAt: -1 })
                .limit(500)
        );

        return res.status(200).json({
            success: true,
            count: productions.length,
            productions
        });
    } catch (error) {
        return sendError(res, error, "Get productions error");
    }
};

// Get Single Production
const getProductionById = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid production ID"
            });
        }

        const production = await populateProduction(
            Production.findOne(getSingleProductionFilter(req))
        );

        if (!production) {
            return res.status(404).json({
                success: false,
                message: "Production record not found"
            });
        }

        return res.status(200).json({
            success: true,
            production
        });
    } catch (error) {
        return sendError(res, error, "Get production error");
    }
};

// Complete Production Atomically
const completeProduction = async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid production ID"
        });
    }

    let session;

    try {
        session = await mongoose.startSession();
        let completedId = null;

        await session.withTransaction(async () => {
            const production = await Production.findOne(
                getSingleProductionFilter(req)
            ).session(session);

            if (!production) {
                throw new Error("PRODUCTION_NOT_FOUND");
            }

            if (!EDITABLE_STATUSES.includes(production.status)) {
                throw new Error("PRODUCTION_NOT_COMPLETABLE");
            }

            const area = await ProductionArea.findOne({
                _id: production.productionAreaId,
                companyId: production.companyId,
                status: "ACTIVE"
            }).session(session).lean();

            if (!area) {
                throw new Error("PRODUCTION_AREA_INACTIVE");
            }

            if (
                req.user.role === "PRODUCTION_MANAGER" &&
                (!req.user.productionAreaId ||
                    String(req.user.productionAreaId) !== String(area._id) ||
                    (area.managerId &&
                        String(area.managerId) !== String(req.user._id)))
            ) {
                throw new Error("PRODUCTION_AREA_FORBIDDEN");
            }

            const materials = new Map();

            for (const item of production.rawMaterials) {
                const key = String(item.productId);
                materials.set(
                    key,
                    (materials.get(key) || 0) + Number(item.quantityUsed)
                );
            }

            for (const [productId, quantity] of materials) {
                const stock = await Inventory.findOneAndUpdate(
                    {
                        companyId: production.companyId,
                        branchId: production.branchId,
                        productId,
                        status: "ACTIVE",
                        quantity: { $gte: quantity }
                    },
                    { $inc: { quantity: -quantity } },
                    {
                        new: true,
                        session,
                        runValidators: true
                    }
                );

                if (!stock) {
                    throw new Error("INSUFFICIENT_OR_MISSING_STOCK");
                }
            }

            let finishedStock = await Inventory.findOneAndUpdate(
                {
                    companyId: production.companyId,
                    branchId: production.branchId,
                    productId: production.finishedProductId,
                    status: "ACTIVE"
                },
                {
                    $inc: { quantity: production.finishedQuantity }
                },
                {
                    new: true,
                    session,
                    runValidators: true
                }
            );

            if (!finishedStock) {
                finishedStock = await Inventory.findOneAndUpdate(
                    {
                        companyId: production.companyId,
                        branchId: production.branchId,
                        productId: production.finishedProductId,
                        status: "INACTIVE"
                    },
                    {
                        $inc: { quantity: production.finishedQuantity },
                        $set: { status: "ACTIVE" }
                    },
                    {
                        new: true,
                        session,
                        runValidators: true
                    }
                );
            }

            if (!finishedStock) {
                await Inventory.create(
                    [{
                        companyId: production.companyId,
                        branchId: production.branchId,
                        productId: production.finishedProductId,
                        quantity: production.finishedQuantity,
                        minStockLevel: 10,
                        unit: "pcs",
                        status: "ACTIVE"
                    }],
                    { session }
                );
            }

            const updated = await Production.findOneAndUpdate(
                {
                    _id: production._id,
                    companyId: production.companyId,
                    status: production.status
                },
                { $set: { status: "COMPLETED" } },
                {
                    new: true,
                    session,
                    runValidators: true
                }
            );

            if (!updated) {
                throw new Error("PRODUCTION_STATUS_CONFLICT");
            }

            completedId = updated._id;
        });

        const auditProduction = await Production.findById(completedId)
            .select("companyId branchId")
            .lean();

        setAuditContext(req, auditProduction);

        const completedProduction = await populateProduction(
            Production.findById(completedId)
        );

        return res.status(200).json({
            success: true,
            message: "Production completed and stock updated successfully",
            production: completedProduction
        });
    } catch (error) {
        const errors = {
            PRODUCTION_NOT_FOUND: [404, "Production record not found"],
            PRODUCTION_NOT_COMPLETABLE: [
                400,
                "Only planned or in-progress production can be completed"
            ],
            PRODUCTION_AREA_INACTIVE: [
                400,
                "Production area is inactive or no longer exists"
            ],
            PRODUCTION_AREA_FORBIDDEN: [
                403,
                "You are not assigned to this production area"
            ],
            INSUFFICIENT_OR_MISSING_STOCK: [
                400,
                "An active raw-material inventory record is missing or has insufficient stock"
            ],
            PRODUCTION_STATUS_CONFLICT: [
                409,
                "Production changed concurrently. Please retry"
            ]
        };

        if (errors[error.message]) {
            const [status, message] = errors[error.message];

            return res.status(status).json({
                success: false,
                message
            });
        }

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Inventory changed concurrently. Please retry"
            });
        }

        return sendError(res, error, "Complete production error");
    } finally {
        if (session) {
            await session.endSession();
        }
    }
};

// Update Production Details
const updateProduction = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid production ID"
            });
        }

        const allowedFields = ["productionDate", "notes", "status"];
        const suppliedFields = Object.keys(req.body);

        if (
            suppliedFields.length === 0 ||
            suppliedFields.some((field) => !allowedFields.includes(field))
        ) {
            return res.status(400).json({
                success: false,
                message: "Only productionDate, notes and status can be updated"
            });
        }

        const updates = {};

        if (Object.hasOwn(req.body, "productionDate")) {
            if (
                typeof req.body.productionDate !== "string" ||
                !req.body.productionDate.trim() ||
                !Number.isFinite(Date.parse(req.body.productionDate))
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Production date must be a valid date string"
                });
            }

            updates.productionDate = new Date(req.body.productionDate);
        }

        if (Object.hasOwn(req.body, "notes")) {
            if (
                typeof req.body.notes !== "string" ||
                req.body.notes.length > 2000
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Notes must be text up to 2000 characters"
                });
            }

            updates.notes = req.body.notes.trim();
        }

        if (Object.hasOwn(req.body, "status")) {
            if (!EDITABLE_STATUSES.includes(req.body.status)) {
                return res.status(400).json({
                    success: false,
                    message: "Status can only be PLANNED or IN_PROGRESS"
                });
            }

            updates.status = req.body.status;
        }

        const filter = getSingleProductionFilter(req);
        const current = await Production.findOne(filter);

        if (!current) {
            return res.status(404).json({
                success: false,
                message: "Production record not found"
            });
        }

        if (!EDITABLE_STATUSES.includes(current.status)) {
            return res.status(400).json({
                success: false,
                message: "Completed or cancelled production cannot be edited"
            });
        }

        if (
            req.user.role === "PRODUCTION_MANAGER" &&
            String(current.productionAreaId) !==
                String(req.user.productionAreaId)
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot edit another production area"
            });
        }

        const production = await Production.findOneAndUpdate(
            {
                ...filter,
                status: current.status
            },
            { $set: updates },
            {
                new: true,
                runValidators: true
            }
        );

        if (!production) {
            return res.status(409).json({
                success: false,
                message: "Production changed concurrently. Please reload and retry"
            });
        }

        setAuditContext(req, production);

        const result = await populateProduction(
            Production.findById(production._id)
        );

        return res.status(200).json({
            success: true,
            message: "Production updated successfully",
            production: result
        });
    } catch (error) {
        return sendError(res, error, "Update production error");
    }
};

// Cancel Production
const cancelProduction = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid production ID"
            });
        }

        const filter = getSingleProductionFilter(req);

        const production = await Production.findOneAndUpdate(
            {
                ...filter,
                status: { $in: EDITABLE_STATUSES }
            },
            { $set: { status: "CANCELLED" } },
            {
                new: true,
                runValidators: true
            }
        );

        if (!production) {
            const existing = await Production.findOne(filter);

            if (!existing) {
                return res.status(404).json({
                    success: false,
                    message: "Production record not found"
                });
            }

            return res.status(400).json({
                success: false,
                message: "Only planned or in-progress production can be cancelled"
            });
        }

        setAuditContext(req, production);

        const result = await populateProduction(
            Production.findById(production._id)
        );

        return res.status(200).json({
            success: true,
            message: "Production cancelled successfully",
            production: result
        });
    } catch (error) {
        return sendError(res, error, "Cancel production error");
    }
};

module.exports = {
    createProduction,
    getProductions,
    getProductionById,
    completeProduction,
    updateProduction,
    cancelProduction
};
