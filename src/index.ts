import express, { type Application, type Request, type Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";

// Routes Import
import authRoutes from "./routes/auth.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import accountRoutes from "./routes/account.routes.js";
import loanRoutes from "./routes/loan.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

// Middlewares
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";

dotenv.config();
const app: Application = express();

app.use(
  cors({
    origin: (_origin, callback) => callback(null, true),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-Requested-With",
      "cache-control",
      "remember-me",
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request Logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Health Check
app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Digital Banking Management System API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// MOUNT API ROUTES
// ==========================================
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationRoutes);

// 404 Route Not Found Handler
app.use(notFoundHandler);

// Centralized Global Error Handler
app.use(errorHandler);

export default app;
