import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodSchema } from "zod";


/**
 * Request body validation Middleware using Zod
 * 
 */

export const validate = (schema: ZodSchema) => {
    return async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            req.body = await schema.parseAsync(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const formattedErrors = error.issues.map((err) => ({
                    field: err.path.join("."),
                    message: err.message,
                }));
                res.status(400).json({
                    success: false,
                    message: "Validation failed . Invalid input data.",
                    errors: formattedErrors,
                });
                return;
            }
            res.status(500).json({
                sucess: false,
                message: "Internal server error during validation"
            });

        }
    }
}