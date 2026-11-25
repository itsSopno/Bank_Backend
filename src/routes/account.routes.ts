import { Router } from "express";
import {
  createAccount,
  getAllAccounts,
  getMyAccounts,
  getAccountById,
  updateAccountStatus,
  updateAccountLimits,
  getAccountStatement,
} from "../controllers/account.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createAccountSchema,
  updateAccountStatusSchema,
  updateAccountLimitsSchema,
} from "../validators/account.validators.js";

const router = Router();

// কাস্টমারের নিজস্ব অ্যাকাউন্ট তালিকা (Customer)
router.get("/my-accounts", authenticate, getMyAccounts);

// নতুন ব্যাংক অ্যাকাউন্ট তৈরি (Admin & Staff)
router.post(
  "/",
  authenticate,
  authorizeRoles("admin", "bank_staff"),
  validate(createAccountSchema),
  createAccount
);

// সকল অ্যাকাউন্ট তালিকা ও সার্চ (Admin & Staff)
router.get(
  "/all",
  authenticate,
  authorizeRoles("admin", "bank_staff"),
  getAllAccounts
);

// অ্যাকাউন্ট স্টেটমেন্ট এক্সপোর্ট (CSV / JSON)
router.get("/:id/statement", authenticate, getAccountStatement);

// অ্যাকাউন্ট স্ট্যাটাস আপডেট (Freeze / Unfreeze / Close) (Admin & Staff)
router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("admin", "bank_staff"),
  validate(updateAccountStatusSchema),
  updateAccountStatus
);

// অ্যাকাউন্ট লিমিট কনফিগারেশন (Admin only)
router.patch(
  "/:id/limits",
  authenticate,
  authorizeRoles("admin"),
  validate(updateAccountLimitsSchema),
  updateAccountLimits
);

// একক অ্যাকাউন্ট বিস্তারিত
router.get("/:id", authenticate, getAccountById);

export default router;

