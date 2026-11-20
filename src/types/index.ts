export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "bank_staff" | "customer";
  status: "active" | "inactive" | "blocked";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

