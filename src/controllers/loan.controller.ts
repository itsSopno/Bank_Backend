import type { Request, Response } from "express";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { db } from "../config/server.js";
import {
  loans,
  loanRepayments,
  accounts,
  users,
  transactions,
  notifications,
} from "../db/schema.js";
import { comparePin } from "../utils/auth.utils.js";
import {
  generateLoanId,
  generateTransactionId,
  calculateLoanEMI,
} from "../utils/banking.util.js";
import type {
  ApplyLoanInput,
  StaffReviewLoanInput,
  AdminReviewLoanInput,
  RepayLoanInput,
} from "../validators/loan.validators.js";

/**
 * ১. লোন আবেদন (Customer)
 */
export const applyLoan = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const {
      accountId,
      loanType,
      requestedAmount,
      durationMonths,
      monthlyIncome,
      employmentStatus,
      applicationDescription,
    } = req.body as ApplyLoanInput;

    // অ্যাকাউন্ট চেক
    const [account] = await db
      .select()
      .from(accounts)
      .where(
        and(eq(accounts.id, accountId), eq(accounts.userId, req.user.id))
      )
      .limit(1);

    if (!account) {
      res.status(404).json({
        success: false,
        message: "Disbursement bank account not found or access denied.",
      });
      return;
    }

    if (account.status !== "active") {
      res.status(400).json({
        success: false,
        message: "Designated bank account is not active.",
      });
      return;
    }

    const loanId = generateLoanId();
    const interestRate = "8.50";

    const [newLoan] = await db
      .insert(loans)
      .values({
        loanId,
        userId: req.user.id,
        accountId,
        loanType,
        requestedAmount: requestedAmount.toFixed(2),
        interestRate,
        durationMonths,
        monthlyIncome: monthlyIncome.toFixed(2),
        employmentStatus,
        applicationDescription: applicationDescription || null,
        status: "pending",
      })
      .returning();

    // নোটিফিকেশন তৈরি
    await db.insert(notifications).values({
      userId: req.user.id,
      title: "Loan Application Submitted",
      message: `Your application for a $${requestedAmount.toLocaleString()} ${loanType} loan (Ref: ${loanId}) has been received and is under review.`,
      type: "loan",
    });

    res.status(201).json({
      success: true,
      message: "Loan application submitted successfully.",
      loan: newLoan,
    });
  } catch (error) {
    console.error("Apply Loan Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error submitting loan application.",
    });
  }
};

/**
 * ২. সকল লোন আবেদন দেখা (Admin & Staff)
 */
export const getAllLoans = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { page = "1", limit = "10", status, type } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, parseInt(limit as string, 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    if (status) {
      conditions.push(eq(loans.status, status as any));
    }
    if (type) {
      conditions.push(eq(loans.loanType, type as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(loans)
      .where(whereClause);

    const total = Number(countResult.count);

    const loanList = await db
      .select({
        id: loans.id,
        loanId: loans.loanId,
        userId: loans.userId,
        userName: users.name,
        userEmail: users.email,
        accountNumber: accounts.accountNumber,
        loanType: loans.loanType,
        requestedAmount: loans.requestedAmount,
        approvedAmount: loans.approvedAmount,
        interestRate: loans.interestRate,
        durationMonths: loans.durationMonths,
        monthlyIncome: loans.monthlyIncome,
        employmentStatus: loans.employmentStatus,
        status: loans.status,
        remainingBalance: loans.remainingBalance,
        monthlyInstallment: loans.monthlyInstallment,
        internalNotes: loans.internalNotes,
        createdAt: loans.createdAt,
      })
      .from(loans)
      .innerJoin(users, eq(loans.userId, users.id))
      .innerJoin(accounts, eq(loans.accountId, accounts.id))
      .where(whereClause)
      .orderBy(desc(loans.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.status(200).json({
      success: true,
      loans: loanList,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get All Loans Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching loans.",
    });
  }
};

/**
 * ৩. কাস্টমারের নিজস্ব লোনসমূহ দেখা (Customer)
 */
export const getMyLoans = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const myLoans = await db
      .select()
      .from(loans)
      .where(eq(loans.userId, req.user.id))
      .orderBy(desc(loans.createdAt));

    res.status(200).json({
      success: true,
      loans: myLoans,
    });
  } catch (error) {
    console.error("Get My Loans Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching your loans.",
    });
  }
};

/**
 * ৪. একক লোনের বিস্তারিত ও রিপেমেন্ট হিস্ট্রি
 */
export const getLoanById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const loanIdParam = req.params.id as string;

    const [loan] = await db
      .select()
      .from(loans)
      .where(
        or(
          eq(loans.loanId, loanIdParam),
          eq(loans.id, parseInt(loanIdParam, 10) || 0)
        )
      )
      .limit(1);

    if (!loan) {
      res.status(404).json({ success: false, message: "Loan not found." });
      return;
    }

    if (req.user?.role === "customer" && loan.userId !== req.user.id) {
      res.status(403).json({ success: false, message: "Access forbidden." });
      return;
    }

    // রিপেমেন্ট হিস্ট্রি
    const repayments = await db
      .select()
      .from(loanRepayments)
      .where(eq(loanRepayments.loanId, loan.id))
      .orderBy(desc(loanRepayments.repaymentDate));

    res.status(200).json({
      success: true,
      loan,
      repayments,
    });
  } catch (error) {
    console.error("Get Loan Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching loan details.",
    });
  }
};

/**
 * ৫. স্টাফ লোন রিভিউ ও ইন্টারনাল নোট (Bank Staff)
 * স্টাফ লোন অনুমোদন করতে পারবে না; শুধু নোট যুক্ত করে ফরওয়ার্ড করতে পারবে।
 */
export const staffReviewLoan = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const loanIdParam = req.params.id as string;
    const { internalNotes, forwardToAdmin } = req.body as StaffReviewLoanInput;

    const [loan] = await db
      .select()
      .from(loans)
      .where(
        or(
          eq(loans.loanId, loanIdParam),
          eq(loans.id, parseInt(loanIdParam, 10) || 0)
        )
      )
      .limit(1);

    if (!loan) {
      res.status(404).json({ success: false, message: "Loan not found." });
      return;
    }

    const newStatus = forwardToAdmin ? "under_review" : loan.status;

    const [updated] = await db
      .update(loans)
      .set({
        internalNotes: internalNotes,
        status: newStatus,
        reviewedBy: req.user!.id,
        updatedAt: new Date(),
      })
      .where(eq(loans.id, loan.id))
      .returning();

    res.status(200).json({
      success: true,
      message: "Staff notes added and application updated.",
      loan: updated,
    });
  } catch (error) {
    console.error("Staff Review Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error reviewing loan.",
    });
  }
};

/**
 * ৬. অ্যাডমিন লোন অনুমোদন বা বাতিল (Admin only)
 * অনুমোদন হলে স্বয়ংক্রিয়ভাবে ডিসবার্সমেন্ট ট্রানজ্যাকশন হয়ে কাস্টমারের একাউন্টে টাকা জমা হবে!
 */
export const adminReviewLoan = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const loanIdParam = req.params.id as string;
    const { action, approvedAmount, interestRate = 8.5, rejectionReason } =
      req.body as AdminReviewLoanInput;

    const [loan] = await db
      .select()
      .from(loans)
      .where(
        or(
          eq(loans.loanId, loanIdParam),
          eq(loans.id, parseInt(loanIdParam, 10) || 0)
        )
      )
      .limit(1);

    if (!loan) {
      res.status(404).json({ success: false, message: "Loan not found." });
      return;
    }

    if (loan.status === "active" || loan.status === "completed") {
      res.status(400).json({
        success: false,
        message: `Loan is already ${loan.status}.`,
      });
      return;
    }

    // রিজেক্ট করা হলে
    if (action === "reject") {
      const [updated] = await db
        .update(loans)
        .set({
          status: "rejected",
          internalNotes: rejectionReason || loan.internalNotes,
          reviewedBy: req.user!.id,
          updatedAt: new Date(),
        })
        .where(eq(loans.id, loan.id))
        .returning();

      await db.insert(notifications).values({
        userId: loan.userId,
        title: "Loan Application Rejected",
        message: `Your loan application (Ref: ${loan.loanId}) was rejected. Reason: ${rejectionReason || "Eligibility criteria not met."}`,
        type: "loan",
      });

      res.status(200).json({
        success: true,
        message: "Loan application rejected.",
        loan: updated,
      });
      return;
    }

    // অ্যাপ্রুভ করা হলে -> ডিসবার্সমেন্ট এবং কিস্তি হিসাব
    const finalAmount = approvedAmount || Number(loan.requestedAmount);
    const emi = calculateLoanEMI(finalAmount, interestRate, loan.durationMonths);
    const totalRepayable = (emi * loan.durationMonths).toFixed(2);
    const transactionId = generateTransactionId();

    const approvalResult = await db.transaction(async (tx) => {
      // ১. কাস্টমারের অ্যাকাউন্টে লোন ডিসবার্স করা (টাকা জমা করা)
      const [updatedAccount] = await tx
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} + ${finalAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, loan.accountId))
        .returning();

      // ২. ডিসবার্সমেন্ট ট্রানজ্যাকশন রেকর্ড
      await tx.insert(transactions).values({
        transactionId,
        receiverAccountId: loan.accountId,
        transactionType: "loan_disbursement",
        amount: finalAmount.toFixed(2),
        transactionFee: "0.00",
        status: "completed",
        description: `Loan disbursement for ${loan.loanType} loan (Ref: ${loan.loanId})`,
        reference: `DISB-${loan.loanId}`,
      });

      // ৩. লোনের স্ট্যাটাস active ও ব্যালেন্স সেট করা
      const [activatedLoan] = await tx
        .update(loans)
        .set({
          status: "active",
          approvedAmount: finalAmount.toFixed(2),
          interestRate: interestRate.toFixed(2),
          monthlyInstallment: emi.toFixed(2),
          remainingBalance: totalRepayable,
          reviewedBy: req.user!.id,
          updatedAt: new Date(),
        })
        .where(eq(loans.id, loan.id))
        .returning();

      // ৪. কাস্টমারকে নোটিফিকেশন পাঠানো
      await tx.insert(notifications).values({
        userId: loan.userId,
        title: "Loan Approved & Disbursed!",
        message: `Congratulations! Your loan of $${finalAmount.toLocaleString()} has been approved and credited to your account. Monthly EMI: $${emi}.`,
        type: "loan",
      });

      return { activatedLoan, updatedAccount };
    });

    res.status(200).json({
      success: true,
      message: "Loan approved and funds disbursed successfully.",
      loan: approvalResult.activatedLoan,
      disbursementTransactionId: transactionId,
    });
  } catch (error) {
    console.error("Admin Review Loan Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error approving loan.",
    });
  }
};

/**
 * ৭. লোন কিস্তি পরিশোধ করা (Customer Repayment)
 */
export const repayLoan = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const loanIdParam = req.params.id as string;
    const { accountId, amount, transactionPin } = req.body as RepayLoanInput;

    // ১. পিন যাচাই
    const [user] = await db
      .select({ transactionPin: users.transactionPin })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!user || !user.transactionPin) {
      res.status(400).json({ success: false, message: "PIN not set." });
      return;
    }

    const isPinValid = await comparePin(transactionPin, user.transactionPin);
    if (!isPinValid) {
      res.status(401).json({ success: false, message: "Invalid transaction PIN." });
      return;
    }

    // ২. লোন ও অ্যাকাউন্ট যাচাই
    const [loan] = await db
      .select()
      .from(loans)
      .where(
        and(
          or(
            eq(loans.loanId, loanIdParam),
            eq(loans.id, parseInt(loanIdParam, 10) || 0)
          ),
          eq(loans.userId, req.user.id)
        )
      )
      .limit(1);

    if (!loan || loan.status !== "active") {
      res.status(400).json({
        success: false,
        message: "Active loan not found.",
      });
      return;
    }

    const [account] = await db
      .select()
      .from(accounts)
      .where(
        and(eq(accounts.id, accountId), eq(accounts.userId, req.user.id))
      )
      .limit(1);

    if (!account || Number(account.balance) < amount) {
      res.status(400).json({
        success: false,
        message: "Insufficient account balance to pay repayment.",
      });
      return;
    }

    const remainingBal = Number(loan.remainingBalance || 0);
    const actualPayAmount = Math.min(amount, remainingBal);
    const newRemainingBal = Math.max(0, remainingBal - actualPayAmount);
    const isCompleted = newRemainingBal === 0;

    const transactionId = generateTransactionId();

    const repaymentResult = await db.transaction(async (tx) => {
      // অ্যাকাউন্ট থেকে টাকা কাটা
      await tx
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} - ${actualPayAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, account.id));

      // রিপেমেন্ট ট্রানজ্যাকশন তৈরি
      const [repaymentTxn] = await tx
        .insert(transactions)
        .values({
          transactionId,
          senderAccountId: account.id,
          transactionType: "loan_repayment",
          amount: actualPayAmount.toFixed(2),
          transactionFee: "0.00",
          status: "completed",
          description: `Loan repayment for ${loan.loanId}`,
          reference: `REPAY-${loan.loanId}`,
        })
        .returning();

      // লোন রিপেমেন্ট হিস্ট্রি রেকর্ড
      await tx.insert(loanRepayments).values({
        loanId: loan.id,
        transactionId: repaymentTxn.id,
        amount: actualPayAmount.toFixed(2),
        remainingBalanceAfter: newRemainingBal.toFixed(2),
      });

      // লোন স্ট্যাটাস ও রিমেইনিং ব্যালেন্স আপডেট
      const [updatedLoan] = await tx
        .update(loans)
        .set({
          remainingBalance: newRemainingBal.toFixed(2),
          status: isCompleted ? "completed" : "active",
          updatedAt: new Date(),
        })
        .where(eq(loans.id, loan.id))
        .returning();

      // নোটিফিকেশন
      await tx.insert(notifications).values({
        userId: req.user!.id,
        title: isCompleted ? "Loan Fully Repaid! 🎉" : "Loan Repayment Received",
        message: isCompleted
          ? `Congratulations! You have fully paid off your loan ${loan.loanId}.`
          : `Repayment of $${actualPayAmount.toFixed(2)} recorded. Remaining loan balance: $${newRemainingBal.toFixed(2)}.`,
        type: "loan",
      });

      return updatedLoan;
    });

    res.status(200).json({
      success: true,
      message: isCompleted
        ? "Congratulations! Your loan has been fully repaid."
        : "Loan repayment processed successfully.",
      loan: repaymentResult,
      transactionId,
    });
  } catch (error) {
    console.error("Repay Loan Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error processing repayment.",
    });
  }
};
