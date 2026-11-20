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