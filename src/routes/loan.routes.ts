import { Router } from "express";
import {
  applyLoan,
  getAllLoans,
  getMyLoans,
  getLoanById,
  staffReviewLoan,
  adminReviewLoan,
  repayLoan,
} from "../controllers/loan.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  applyLoanSchema,
  staffReviewLoanSchema,
  adminReviewLoanSchema,
  repayLoanSchema,
} from "../validators/loan.validators.js";

const router = Router();

// লোন আবেদন (Customer)
router.post("/apply", authenticate, validate(applyLoanSchema), applyLoan);

// কাস্টমারের নিজস্ব লোনসমূহ (Customer)
router.get("/my-loans", authenticate, getMyLoans);

// সকল লোন আবেদন তালিকা (Admin & Staff)
router.get(
  "/all",
  authenticate,
  authorizeRoles("admin", "bank_staff"),
  getAllLoans
);

// স্টাফ লোন রিভিউ ও ইন্টারনাল নোট (Staff only)
router.patch(
  "/:id/staff-review",
  authenticate,
  authorizeRoles("bank_staff"),
  validate(staffReviewLoanSchema),
  staffReviewLoan
);

// অ্যাডমিন লোন অনুমোদন বা বাতিল ও ফান্ড ডিসবার্সমেন্ট (Admin only)
router.patch(
  "/:id/admin-review",
  authenticate,
  authorizeRoles("admin"),
  validate(adminReviewLoanSchema),
  adminReviewLoan
);

// লোন কিস্তি পরিশোধ (Customer)
router.post("/:id/repay", authenticate, validate(repayLoanSchema), repayLoan);

// একক লোনের বিস্তারিত ও রিপেমেন্ট হিস্ট্রি
router.get("/:id", authenticate, getLoanById);

export default router;

