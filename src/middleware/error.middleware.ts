import type { Request, Response, NextFunction } from "express";

export class AppError extends Error {
    public statusCode: number;
    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * name : golobal error handelar
 */

export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    const statusCode = err.statusCode || 500;
    const message = err.message || " Internal Server Error";
    console.error(`[Error] ${req.method} ${req.originalUrl} >>`, err)

    res.status(statusCode).json({
        sucess: false,
        message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    })
}
/**
 * 404 Not Found Middleware
 * যদি কোনো রিকোয়েস্টের URL আমাদের ডিফাইন করা কোনো রাউটের সাথে না মেলে
 */
export const notFoundHandler = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found on this server`,
    });
};