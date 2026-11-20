import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export interface TokenPayLoad {
    id: number;
    email: string;
    role: "admin" | "bank_staff" | "customer",
}

export const hashPassword = async (password: string): Promise<string> => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};


/**
 * name : hash user password ,
 */

export const comparePassword = async (
    plain: string,
    hashed: string

): Promise<boolean> => {
    return await bcrypt.compare(plain, hashed);

}

/**
 * note : if customer hashed 4 pr 6 digit pin 
 */

export const hashPin = async (pin: string): Promise<string> => {
    return await bcrypt.hash(pin, SALT_ROUNDS);

}

/**
 * note : verify pin during injection
 */

export const comparePin = async (
    plainPin: string,
    hashedPin: string,
): Promise<boolean> => {
    return await bcrypt.compare(plainPin, hashedPin);
}

/**
 * des : create jwt toker for user
 */

export const genareteToken = (payload: TokenPayLoad): string => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN as any,
    })
}