import type { Request, Response } from "express";
import { eq, sql, desc, and } from "drizzle-orm";
import { db } from "../config/server.js";
import {
  users,
  accounts,
  transactions,
  loans,
  depositWithdrawalRequests,
} from "../db/schema.js";

/**
 * ১. অ্যাডমিন ড্যাশবোর্ড ওভারভিউ ও অ্যানালিটিক্স (Recharts-এর জন্য প্রস্তুত)
 */
export const getAdminAnalytics = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    // মোট কাস্টমার
    const [customersCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, "customer"));

    // মোট ব্যাংক অ্যাকাউন্ট ও মোট রিজার্ভ ব্যালেন্স
    const [accountsSummary] = await db
      .select({
        count: sql<number>`count(*)`,
        totalBalance: sql<string>`coalesce(sum(balance), 0)`,
      })
      .from(accounts);

    // মোট ডিপোজিট ও উইথড্রয়াল অ্যামাউন্ট
    const [depositSummary] = await db
      .select({
        totalDeposit: sql<string>`coalesce(sum(amount), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.transactionType, "deposit"),
          eq(transactions.status, "completed")
        )
      );

    const [withdrawalSummary] = await db
      .select({
        totalWithdrawal: sql<string>`coalesce(sum(amount), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.transactionType, "withdrawal"),
          eq(transactions.status, "completed")
        )
      );

    // মোট ট্রানজ্যাকশন সংখ্যা
    const [txnCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions);

    // পেন্ডিং লোন অ্যাপ্লিকেশন
    const [pendingLoansCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(loans)
      .where(eq(loans.status, "pending"));

    // পেন্ডিং ডিপোজিট/উইথড্র রিকোয়েস্ট
    const [pendingRequestsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(depositWithdrawalRequests)
      .where(eq(depositWithdrawalRequests.status, "pending"));

    // মাসিক লেনদেন ভলিউম (Monthly Transaction Volume - শেষ ৬ মাস)
    const monthlyVolume = await db
      .select({
        month: sql<string>`to_char(${transactions.createdAt}, 'Mon YYYY')`,
        volume: sql<number>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(eq(transactions.status, "completed"))
      .groupBy(sql`to_char(${transactions.createdAt}, 'Mon YYYY')`)
      .orderBy(sql`min(${transactions.createdAt})`)
      .limit(6);

    // অ্যাকাউন্ট টাইপ ডিস্ট্রিবিউশন (Savings vs Current vs Business)
    const accountDistribution = await db
      .select({
        type: accounts.accountType,
        count: sql<number>`count(*)`,
        totalBalance: sql<string>`coalesce(sum(balance), 0)`,
      })
      .from(accounts)
      .groupBy(accounts.accountType);

    // লোন অ্যাপ্রুভাল স্ট্যাটিসটিক্স
    const loanStats = await db
      .select({
        status: loans.status,
        count: sql<number>`count(*)`,
        totalAmount: sql<string>`coalesce(sum(cast(${loans.requestedAmount} as numeric)), 0)`,
      })
      .from(loans)
      .groupBy(loans.status);

    res.status(200).json({
      success: true,
      analytics: {
        totalCustomers: Number(customersCount.count),
        totalAccounts: Number(accountsSummary.count),
        totalBankBalance: Number(accountsSummary.totalBalance),
        totalDeposits: Number(depositSummary.totalDeposit),
        totalWithdrawals: Number(withdrawalSummary.totalWithdrawal),
        totalTransactions: Number(txnCount.count),
        pendingLoans: Number(pendingLoansCount.count),
        pendingRequests: Number(pendingRequestsCount.count),
        monthlyTransactionVolume: monthlyVolume,
        accountDistribution,
        loanStatistics: loanStats,
      },
    });
  } catch (error) {
    console.error("Admin Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching admin analytics.",
    });
  }
};

/**
 * ২. কাস্টমার ব্যক্তিগত ফাইন্যান্সিয়াল অ্যানালিটিক্স
 */
export const getCustomerAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const userAccounts = await db
      .select({ id: accounts.id, balance: accounts.balance })
      .from(accounts)
      .where(eq(accounts.userId, req.user.id));

    const totalBalance = userAccounts.reduce(
      (sum, acc) => sum + Number(acc.balance),
      0
    );
    const accountIds = userAccounts.map((a) => a.id);

    if (accountIds.length === 0) {
      res.status(200).json({
        success: true,
        analytics: {
          totalBalance: 0,
          totalSent: 0,
          totalReceived: 0,
          monthlySpending: [],
          transactionDistribution: [],
        },
      });
      return;
    }

    // মোট খরচ ও প্রাপ্তি
    const [sentSummary] = await db
      .select({
        total: sql<string>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)`,
      })
      .from(transactions)
      .where(
        and(
          sql`${transactions.senderAccountId} IN ${accountIds}`,
          eq(transactions.status, "completed")
        )
      );

    const [receivedSummary] = await db
      .select({
        total: sql<string>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)`,
      })
      .from(transactions)
      .where(
        and(
          sql`${transactions.receiverAccountId} IN ${accountIds}`,
          eq(transactions.status, "completed")
        )
      );

    // মাসিক খরচ (Monthly Spending History)
    const monthlySpending = await db
      .select({
        month: sql<string>`to_char(${transactions.createdAt}, 'Mon YYYY')`,
        amount: sql<number>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)`,
      })
      .from(transactions)
      .where(
        and(
          sql`${transactions.senderAccountId} IN ${accountIds}`,
          eq(transactions.status, "completed")
        )
      )
      .groupBy(sql`to_char(${transactions.createdAt}, 'Mon YYYY')`)
      .orderBy(sql`min(${transactions.createdAt})`)
      .limit(6);

    // ট্রানজ্যাকশন টাইপ ডিস্ট্রিবিউশন
    const txnDistribution = await db
      .select({
        type: transactions.transactionType,
        count: sql<number>`count(*)`,
        total: sql<string>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)`,
      })
      .from(transactions)
      .where(
        and(
          sql`${transactions.senderAccountId} IN ${accountIds} OR ${transactions.receiverAccountId} IN ${accountIds}`,
          eq(transactions.status, "completed")
        )
      )
      .groupBy(transactions.transactionType);

    res.status(200).json({
      success: true,
      analytics: {
        totalBalance,
        totalSent: Number(sentSummary.total),
        totalReceived: Number(receivedSummary.total),
        monthlySpending,
        transactionDistribution: txnDistribution,
      },
    });
  } catch (error) {
    console.error("Customer Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching customer analytics.",
    });
  }
};

/**
 * ৩. ব্যাংক স্টাফ অপারেশনাল অ্যানালিটিক্স
 */
export const getStaffAnalytics = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const [pendingRequests] = await db
      .select({ count: sql<number>`count(*)` })
      .from(depositWithdrawalRequests)
      .where(eq(depositWithdrawalRequests.status, "pending"));

    const [pendingLoans] = await db
      .select({ count: sql<number>`count(*)` })
      .from(loans)
      .where(eq(loans.status, "pending"));

    const [suspiciousTxns] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(eq(transactions.isSuspicious, true));

    res.status(200).json({
      success: true,
      analytics: {
        pendingDepositWithdrawalRequests: Number(pendingRequests.count),
        pendingLoanApplications: Number(pendingLoans.count),
        flaggedSuspiciousTransactions: Number(suspiciousTxns.count),
      },
    });
  } catch (error) {
    console.error("Staff Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching staff analytics.",
    });
  }
};

