import { z } from "zod";

/**
 * লোন আবেদন স্কিমা (Customer)
 */
export const applyLoanSchema = z.object({
  accountId: z.number().int().positive(),
  loanType: z.enum(["personal", "home", "business", "education"]).default("personal"),
  requestedAmount: z
    .number()
    .positive("Loan amount must be greater than 0")
    .max(5000000, "Maximum loan amount is $5,000,000"),
  durationMonths: z
    .number()
    .int()
    .min(6, "Minimum loan duration is 6 months")
    .max(120, "Maximum loan duration is 120 months"),
  monthlyIncome: z
    .number()
    .positive("Monthly income is required and must be greater than 0"),
  employmentStatus: z
    .string()
    .min(2, "Employment status is required")
    .trim(),
  applicationDescription: z.string().max(500).optional(),
});

/**
 * স্টাফ রিভিউ ও ইন্টারনাল নোট স্কিমা (Bank Staff)
 */
export const staffReviewLoanSchema = z.object({
  internalNotes: z.string().min(2, "Internal note is required").max(1000),
  forwardToAdmin: z.boolean().default(true),
});

/**
 * অ্যাডমিন লোন অ্যাপ্রুভাল বা রিজেকশন স্কিমা (Admin only)
 */
export const adminReviewLoanSchema = z.object({
  action: z.enum(["approve", "reject"]),
  approvedAmount: z.number().positive().optional(),
  interestRate: z.number().positive().max(30).optional().default(8.5),
  rejectionReason: z.string().max(255).optional(),
});

/**
 * লোন কিস্তি পরিশোধ স্কিমা (Customer Repay)
 */
export const repayLoanSchema = z.object({
  accountId: z.number().int().positive(),
  amount: z.number().positive("Repayment amount must be greater than 0"),
  transactionPin: z
    .string()
    .regex(/^\d{4}$/, "Transaction PIN must be 4 digits"),
});

export type ApplyLoanInput = z.infer<typeof applyLoanSchema>;
export type StaffReviewLoanInput = z.infer<typeof staffReviewLoanSchema>;
export type AdminReviewLoanInput = z.infer<typeof adminReviewLoanSchema>;
export type RepayLoanInput = z.infer<typeof repayLoanSchema>;

