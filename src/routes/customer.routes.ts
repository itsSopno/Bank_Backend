import { Router } from "express";
import {
  getAllCustomers,
  getCustomerById,
  updateCustomerStatus,
} from "../controllers/customer.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/rbac.middleware.js";

const router = Router();

// কাস্টমার তালিকা দেখা ও সার্চ (Admin & Staff)
router.get("/", authenticate, authorizeRoles("admin", "bank_staff"), getAllCustomers);

// একক কাস্টমারের বিস্তারিত প্রোফাইল, অ্যাকাউন্টসমূহ ও লোন হিস্ট্রি (Admin & Staff)
router.get("/:id", authenticate, authorizeRoles("admin", "bank_staff"), getCustomerById);

// কাস্টমার অ্যাকাউন্ট একটিভ/ডিঅ্যাকটিভ/ব্লক করা (Admin only)
router.patch("/:id/status", authenticate, authorizeRoles("admin"), updateCustomerStatus);

export default router;
