import { Router } from "express";
import {
  getAdminAnalytics,
  getCustomerAnalytics,
  getStaffAnalytics,
} from "../controllers/analytics.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/rbac.middleware.js";

const router = Router();

// অ্যাডমিন ড্যাশবোর্ড অ্যানালিটিক্স (Admin only)
router.get("/admin", authenticate, authorizeRoles("admin"), getAdminAnalytics);

// কাস্টমার ব্যক্তিগত ফাইন্যান্সিয়াল অ্যানালিটিক্স (Customer)
router.get("/customer", authenticate, getCustomerAnalytics);

// ব্যাংক স্টাফ অপারেশনাল অ্যানালিটিক্স (Staff & Admin)
router.get("/staff", authenticate, authorizeRoles("admin", "bank_staff"), getStaffAnalytics);

export default router;
