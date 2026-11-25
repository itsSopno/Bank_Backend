import { Router } from "express";
import {
  transferFunds,
  requestDepositWithdrawal,
  reviewDepositWithdrawal,
  getTransactions,
  getTransactionById,
  getPendingRequests,
  flagTransaction,
} from "../controllers/transaction.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  fundTransferSchema,
  depositWithdrawalRequestSchema,
  reviewRequestSchema,
} from "../validators/transaction.validators.js";

const router = Router();

// ফান্ড ট্রান্সফার (Customer)
router.post(
  "/transfer",
  authenticate,
  validate(fundTransferSchema),
  transferFunds
);

// ডিপোজিট / উইথড্রয়াল রিকোয়েস্ট তৈরি (Customer)
router.post(
  "/request",
  authenticate,
  validate(depositWithdrawalRequestSchema),
  requestDepositWithdrawal
);

// পেন্ডিং ডিপোজিট / উইথড্রয়াল রিকোয়েস্ট লিস্ট (Admin & Staff)
router.get(
  "/pending-requests",
  authenticate,
  authorizeRoles("admin", "bank_staff"),
  getPendingRequests
);

// ডিপোজিট / উইথড্রয়াল রিকোয়েস্ট অনুমোদন বা বাতিল (Admin & Staff)
router.patch(
  "/request/:id/review",
  authenticate,
  authorizeRoles("admin", "bank_staff"),
  validate(reviewRequestSchema),
  reviewDepositWithdrawal
);

// ট্রানজ্যাকশন হিস্ট্রি (Search, Date Filter, Type Filter, Pagination)
router.get("/history", authenticate, getTransactions);

// সন্দেহজনক ট্রানজ্যাকশন ফ্ল্যাগ করা (Staff)
router.patch(
  "/:id/flag",
  authenticate,
  authorizeRoles("admin", "bank_staff"),
  flagTransaction
);

// একক ট্রানজ্যাকশন ও রিসিট ডেটা
router.get("/:id", authenticate, getTransactionById);

export default router;

