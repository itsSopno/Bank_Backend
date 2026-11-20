import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../config/server.js';
import { users, accounts } from '../db/schema.js';
import { hashPassword, comparePin, comparePassword, hashPin, generateToken } from '../utils/auth.utils.js';

import { generateAccountNumber } from "../utils/banking.util.js";
import type {
    RegisterInput,
    LoginInput,
    SetPinInput,
} from "../validators/auth.validators.js";

/**
 * name : coustomer and user regeastration 
 * 
 */

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, email, password, role = "customer", phone, address, transactionPin } = req.body as RegisterInput;
        const [existingUser] = await db.select({ id: users.id })
            .from(users)
            .where(eq(users.email, email)
            )
            .limit(1);
        if (existingUser) {
            res.status(409).json({
                sucess: false,
                message: "An account with this email address already existis",
            });
            return;
        }

        const hashedPassword = await hashPassword(password);
        const hashedPin = transactionPin ? await hashPin(transactionPin) : null;
        const [newUser] = await db.insert(users)
            .values({
                name,
                email,
                password: hashedPassword,
                role: role as any,
                phone: phone || null,
                address: address || null,
                transactionPin: hashedPin,
            })
            .returning({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
                status: users.status,
            })
        let newAccount = null;
        if (newUser.role === "customer") {
            const accountNumber = generateAccountNumber();
            const [createdAccount] = await db
                .insert(accounts)
                .values({
                    accountNumber,
                    userId: newUser.id,
                    accountType: "savings",
                    balance: "0.00",
                    status: "active",
                })
                .returning();
            newAccount = createdAccount;
        }
        const token = generateToken({
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
        });
        // সিকিউর HttpOnly Cookie সেট করা
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000, // ৭ দিন
        });
        res.status(201).json({
            success: true,
            message: "Account registered successfully.",
            user: newUser,
            account: newAccount,
            token,
        });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error during registration.",
        });
    }
}
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body as LoginInput;
        // ইমেইল দিয়ে ইউজার খোঁজা
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
        if (!user) {
            res.status(401).json({
                success: false,
                message: "Invalid email or password.",
            });
            return;
        }
        // পাসওয়ার্ড ভেরিফাই করা
        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({
                success: false,
                message: "Invalid email or password.",
            });
            return;
        }
        // অ্যাকাউন্ট স্ট্যাটাস চেক
        if (user.status === "blocked") {
            res.status(403).json({
                success: false,
                message: "Your account is blocked. Please contact bank administration.",
            });
            return;
        }
        if (user.status === "inactive") {
            res.status(403).json({
                success: false,
                message: "Your account is currently inactive.",
            });
            return;
        }
        // ইউজারের ব্যাংক অ্যাকাউন্টগুলো তুলে আনা
        const userAccounts = await db
            .select()
            .from(accounts)
            .where(eq(accounts.userId, user.id));
        // টোকেন তৈরি করা
        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
        });
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        // সেনসিটিভ পাসওয়ার্ড ও পিন বাদ দিয়ে নিরাপদ অবজেক্ট পাঠানো
        const { password: _, transactionPin: __, ...safeUser } = user;
        res.status(200).json({
            success: true,
            message: "Login successful.",
            user: safeUser,
            accounts: userAccounts,
            token,
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error during login.",
        });
    }
};
/**
 * ৩. কারেন্ট ইউজার ও তার অ্যাকাউন্টের তথ্য পাওয়া (/me)
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const [user] = await db
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
                status: users.status,
                phone: users.phone,
                address: users.address,
                createdAt: users.createdAt,
            })
            .from(users)
            .where(eq(users.id, req.user.id))
            .limit(1);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found." });
            return;
        }
        const userAccounts = await db
            .select()
            .from(accounts)
            .where(eq(accounts.userId, user.id));
        res.status(200).json({
            success: true,
            user,
            accounts: userAccounts,
        });
    } catch (error) {
        console.error("GetMe Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error fetching user profile.",
        });
    }
};
/**
 * ৪. ট্রানজ্যাকশন পিন সেট বা পরিবর্তন করা
 */
export const setTransactionPin = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const { pin, currentPassword } = req.body as SetPinInput;
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, req.user.id))
            .limit(1);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found." });
            return;
        }
        // পাসওয়ার্ড নিশ্চিত করা
        const isPasswordValid = await comparePassword(currentPassword, user.password);
        if (!isPasswordValid) {
            res.status(400).json({
                success: false,
                message: "Current password is incorrect.",
            });
            return;
        }
        // নতুন পিন হ্যাশ করে সেভ করা
        const hashedPin = await hashPin(pin);
        await db
            .update(users)
            .set({ transactionPin: hashedPin, updatedAt: new Date() })
            .where(eq(users.id, user.id));
        res.status(200).json({
            success: true,
            message: "Transaction PIN updated successfully.",
        });
    } catch (error) {
        console.error("Set PIN Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error setting transaction PIN.",
        });
    }
};
/**
 * ৫. লগআউট
 */
export const logout = async (_req: Request, res: Response): Promise<void> => {
    res.clearCookie("token");
    res.status(200).json({
        success: true,
        message: "Logged out successfully.",
    });
};