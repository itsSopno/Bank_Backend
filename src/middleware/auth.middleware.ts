import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../config/server.js";
import { users } from "../db/schema.js";
import type { AuthUser } from "../types/index.js";

interface DecodedToken {
  id: number;
  email: string;
  role: "admin" | "bank_staff" | "customer";
  iat?: number;
  exp?: number;
}

/**
 * Authentication Middleware
 * Verifies JWT token, checks DB for active user status, and sets req.user
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // -------------------------------------------------------------
    // Condition 1: Extract Token from Header or Cookie
    // -------------------------------------------------------------
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // If token is missing, reject immediately
    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication failed. No token provided.",
      });
      return;
    }

    // -------------------------------------------------------------
    // Condition 2: Verify Token Signature & Expiry
    // -------------------------------------------------------------
    const secret = process.env.JWT_SECRET || "default-secret-key";
    let decoded: DecodedToken;

    try {
      decoded = jwt.verify(token, secret) as DecodedToken;
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        res.status(401).json({
          success: false,
          message: "Session expired. Please log in again.",
        });
        return;
      }
      res.status(401).json({
        success: false,
        message: "Invalid token or signature verification failed.",
      });
      return;
    }

    // -------------------------------------------------------------
    // Condition 3: Verify User Existence in Database
    // -------------------------------------------------------------
    const [existingUser] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (!existingUser) {
      res.status(401).json({
        success: false,
        message: "User account no longer exists.",
      });
      return;
    }

    // -------------------------------------------------------------
    // Condition 4: Strict Banking Security - Check Account Status
    // -------------------------------------------------------------
    if (existingUser.status === "blocked") {
      res.status(403).json({
        success: false,
        message:
          "Your account has been blocked by the bank. Please contact administration.",
      });
      return;
    }

    if (existingUser.status === "inactive") {
      res.status(403).json({
        success: false,
        message:
          "Your account is currently inactive. Please complete verification.",
      });
      return;
    }

    // -------------------------------------------------------------
    // Condition 5: Attach verified user to req and proceed
    // -------------------------------------------------------------
    req.user = existingUser as AuthUser;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during authentication.",
    });
  }
};

