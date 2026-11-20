import type { Request, Response, NextFunction } from 'express';
type Role = "admin" | 'bank_staff' | 'customer';
/**
 * Role-Based acess controll RBAC middlewaree 
 */
export const authorizeRoles = (...allowedRoles: Role[]) => {
    return (
        req: Request, res: Response, next: NextFunction
    ): void => {
        if (!req.user) {
            res.status(401).json({
                sucess: false,
                message: 'Unauthorized . please authentication first'
            });
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                sucess: false,
                message: `Forbidden. Role '${req.user.role}' does not have permission to access this resource.`
            })
            return;
        }

        next();
    }
}