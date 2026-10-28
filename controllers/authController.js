
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");

const saveAuthLog = async ({
    userId,
    companyId = null,
    action,
    description,
    req
}) => {
    try {
        await AuditLog.create({
            userId,
            companyId,
            action,
            module: "AUTH",
            description,
            ipAddress: req.ip
        });
    } catch (error) {
        console.error("Authentication audit log error:", error.message);
    }
};

const validatePassword = (password) => {
    return typeof password === "string" && password.length >= 8;
};

const createPasswordHash = async (password) => {
    return bcrypt.hash(password, 12);
};

// Signup
const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== "string" ||
            !name.trim() ||
            typeof email !== "string" ||
            !email.trim() ||
            !validatePassword(password)
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email and a password of at least 8 characters are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User already exists with this email"
            });
        }

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: await createPasswordHash(password),
            role: "STAFF"
        });

        await saveAuthLog({
            userId: user._id,
            companyId: user.companyId,
            action: "SIGNUP",
            description: "New user signed up",
            req
        });

        return res.status(201).json({
            success: true,
            message: "Signup successful",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "User already exists with this email"
            });
        }

        console.error("Signup error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Signup failed"
        });
    }
};

// Login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            !email.trim() ||
            typeof password !== "string" ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        }).select("+password");

        if (!user) {
            await saveAuthLog({
                action: "LOGIN_FAILED",
                description: "Login failed: account not found",
                req
            });

            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            await saveAuthLog({
                userId: user._id,
                companyId: user.companyId,
                action: "LOGIN_FAILED",
                description: "Login failed: invalid password",
                req
            });

            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        if (user.status !== "ACTIVE") {
            await saveAuthLog({
                userId: user._id,
                companyId: user.companyId,
                action: "LOGIN_BLOCKED",
                description: "Login blocked: account is not active",
                req
            });

            return res.status(403).json({
                success: false,
                message: "Your account is not active"
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured");
        }

        const token = jwt.sign(
            {
                userId: user._id,
                role: user.role,
                companyId: user.companyId,
                branchId: user.branchId,
                productionAreaId: user.productionAreaId
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        await saveAuthLog({
            userId: user._id,
            companyId: user.companyId,
            action: "LOGIN_SUCCESS",
            description: "User logged in successfully",
            req
        });

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                companyId: user.companyId,
                branchId: user.branchId,
                productionAreaId: user.productionAreaId,
                status: user.status
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
};

// Create initial Super Admin
const createSuperAdmin = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== "string" ||
            !name.trim() ||
            typeof email !== "string" ||
            !email.trim() ||
            !validatePassword(password)
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email and a password of at least 8 characters are required"
            });
        }

        const existingSuperAdmin = await User.exists({
            role: "SUPER_ADMIN"
        });

        if (existingSuperAdmin) {
            return res.status(409).json({
                success: false,
                message: "Super Admin already exists"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (await User.exists({ email: normalizedEmail })) {
            return res.status(409).json({
                success: false,
                message: "User already exists with this email"
            });
        }

        const superAdmin = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: await createPasswordHash(password),
            role: "SUPER_ADMIN",
            companyId: null,
            branchId: null,
            productionAreaId: null,
            status: "ACTIVE"
        });

        await saveAuthLog({
            userId: superAdmin._id,
            action: "SUPER_ADMIN_CREATED",
            description: "Initial Super Admin account created",
            req
        });

        return res.status(201).json({
            success: true,
            message: "Super Admin created successfully",
            user: {
                id: superAdmin._id,
                name: superAdmin.name,
                email: superAdmin.email,
                role: superAdmin.role,
                status: superAdmin.status
            }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Super Admin or email already exists"
            });
        }

        console.error("Create Super Admin error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to create Super Admin"
        });
    }
};

// Request password reset
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase()
        });

        const genericMessage =
            "If an account exists for this email, password reset instructions will be provided.";

        if (!user) {
            return res.status(200).json({
                success: true,
                message: genericMessage
            });
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");

        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);

        await user.save();

        await saveAuthLog({
            userId: user._id,
            companyId: user.companyId,
            action: "PASSWORD_RESET_REQUESTED",
            description: "Password reset requested",
            req
        });

        // Email delivery will be connected in the SMTP setup step.
        // Never return the reset token in an API response.

        return res.status(200).json({
            success: true,
            message: genericMessage
        });
    } catch (error) {
        console.error("Forgot password error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to process password reset request"
        });
    }
};

// Reset password using a token received through email
const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!token || !validatePassword(password)) {
            return res.status(400).json({
                success: false,
                message: "A valid reset token and a password of at least 8 characters are required"
            });
        }

        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: new Date() }
        }).select("+passwordResetToken +passwordResetExpires");

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Reset token is invalid or expired"
            });
        }

        user.password = await createPasswordHash(password);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;

        await user.save();

        await saveAuthLog({
            userId: user._id,
            companyId: user.companyId,
            action: "PASSWORD_RESET_SUCCESS",
            description: "Password reset completed",
            req
        });

        return res.status(200).json({
            success: true,
            message: "Password reset successful. Please log in with your new password."
        });
    } catch (error) {
        console.error("Reset password error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Password reset failed"
        });
    }
};

// Change password for an authenticated user
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (
            typeof currentPassword !== "string" ||
            !currentPassword ||
            !validatePassword(newPassword)
        ) {
            return res.status(400).json({
                success: false,
                message: "Current password and a new password of at least 8 characters are required"
            });
        }

        const user = await User.findById(req.user.userId)
            .select("+password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const matches = await bcrypt.compare(
            currentPassword,
            user.password
        );

        if (!matches) {
            return res.status(401).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        user.password = await createPasswordHash(newPassword);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;

        await user.save();

        await saveAuthLog({
            userId: user._id,
            companyId: user.companyId,
            action: "PASSWORD_CHANGED",
            description: "Password changed by authenticated user",
            req
        });

        return res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });
    } catch (error) {
        console.error("Change password error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Password change failed"
        });
    }
};

module.exports = {
    signup,
    login,
    createSuperAdmin,
    forgotPassword,
    resetPassword,
    changePassword
};
