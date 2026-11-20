import { z } from "zod";

/**
 * ইউজার রেজিস্ট্রেশন ইনপুট ভ্যালিডেশন স্কিমা
 */
export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .trim(),
  email: z
    .string()
    .email("Please provide a valid email address")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long"),
  role: z.enum(["admin", "bank_staff", "customer"]).optional().default("customer"),
  phone: z.string().optional(),
  address: z.string().optional(),
  transactionPin: z
    .string()
    .regex(/^\d{4}$/, "Transaction PIN must be exactly 4 digits")
    .optional(),
});

/**
 * ইউজার লগইন ইনপুট ভ্যালিডেশন স্কিমা
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, "Password is required"),
});

/**
 * কাস্টমারের ৪ ডিজিটের ট্রানজ্যাকশন পিন সেট বা আপডেট করার স্কিমা
 */
export const setPinSchema = z.object({
  pin: z
    .string()
    .regex(/^\d{4}$/, "PIN must be exactly 4 numeric digits"),
  currentPassword: z
    .string()
    .min(1, "Current password is required"),
});

// TypeScript Types যাতে আমরা কন্ট্রোলারে টাইপ সেফটি পাই
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SetPinInput = z.infer<typeof setPinSchema>;
