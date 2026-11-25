import { z } from "zod";

/**
 * ব্যাংক অ্যাকাউন্ট তৈরির স্কিমা (Admin & Staff)
 */
export const createAccountSchema = z.object({
  userId: z.number().int().positive(),
  accountType: z.enum(["savings", "current", "business"]).default("savings"),
  initialDeposit: z.number().min(0).default(0),
  dailyTransferLimit: z.number().positive().optional().default(50000),
  maxSingleTransactionLimit: z.number().positive().optional().default(25000),
  minBalance: z.number().min(0).optional().default(500),
});

/**
 * অ্যাকাউন্ট স্ট্যাটাস আপডেট স্কিমা (Freeze / Unfreeze / Close)
 */
export const updateAccountStatusSchema = z.object({
  status: z.enum(["active", "frozen", "closed"]),
});

/**
 * অ্যাকাউন্ট লিমিট আপডেট স্কিমা (Admin only)
 */
export const updateAccountLimitsSchema = z.object({
  dailyTransferLimit: z.number().positive().optional(),
  maxSingleTransactionLimit: z.number().positive().optional(),
  minBalance: z.number().min(0).optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountStatusInput = z.infer<typeof updateAccountStatusSchema>;
export type UpdateAccountLimitsInput = z.infer<typeof updateAccountLimitsSchema>;

