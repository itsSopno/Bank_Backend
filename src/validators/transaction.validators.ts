import { z } from "zod";

/**
 * ফান্ড ট্রান্সফার ভ্যালিডেশন স্কিমা
 */
export const fundTransferSchema = z.object({
  senderAccountId: z
    .number()
    .int()
    .positive("Sender account ID must be valid"),
  recipientAccountNumber: z
    .string()
    .min(5, "Invalid recipient account number")
    .trim(),
  amount: z
    .number()
    .positive("Transfer amount must be greater than 0")
    .max(10000000, "Amount exceeds system limit"),
  description: z.string().max(255).optional(),
  transactionPin: z
    .string()
    .regex(/^\d{4}$/, "Transaction PIN must be 4 numeric digits"),
});

/**
 * ডিপোজিট বা উইথড্রয়াল রিকোয়েস্ট স্কিমা
 */
export const depositWithdrawalRequestSchema = z.object({
  accountId: z
    .number()
    .int()
    .positive("Account ID must be valid"),
  type: z.enum(["deposit", "withdrawal"]),
  amount: z
    .number()
    .positive("Amount must be greater than 0"),
  description: z.string().max(255).optional(),
});

/**
 * ডিপোজিট / উইথড্রয়াল অ্যাপ্রুভাল বা রিজেকশন স্কিমা
 */
export const reviewRequestSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().max(255).optional(),
});

/**
 * ট্রানজ্যাকশন কোয়েরি ফিল্টার স্কিমা
 */
export const transactionQuerySchema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("10"),
  search: z.string().optional(),
  type: z
    .enum([
      "deposit",
      "withdrawal",
      "fund_transfer",
      "loan_disbursement",
      "loan_repayment",
    ])
    .optional(),
  status: z.enum(["pending", "completed", "failed", "reversed"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  accountId: z.string().optional(),
});

export type FundTransferInput = z.infer<typeof fundTransferSchema>;
export type DepositWithdrawalRequestInput = z.infer<
  typeof depositWithdrawalRequestSchema
>;
export type ReviewRequestInput = z.infer<typeof reviewRequestSchema>;
