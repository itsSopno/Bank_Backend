import type { Request, Response } from "express";
import { eq, and, or, gte, lte, desc, sql, like } from "drizzle-orm";
import { db } from "../config/server.js";
import {
  accounts,
  transactions,
  depositWithdrawalRequests,
  notifications,
  users,
} from "../db/schema.js";
import { comparePin } from "../utils/auth.utils.js";
import { generateTransactionId } from "../utils/banking.util.js";
import type {
  FundTransferInput,
  DepositWithdrawalRequestInput,
  ReviewRequestInput,
} from "../validators/transaction.validators.js";

/**
 * ১. অ্যাটমিক ফান্ড ট্রান্সফার (Atomic Fund Transfer)
 * ACID Compliance: উভয় অ্যাকাউন্ট একসাথে আপডেট হবে বা Rollback হবে।
 */
export const transferFunds = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const {
      senderAccountId,
      recipientAccountNumber,
      amount,
      description,
      transactionPin,
    } = req.body as FundTransferInput;

    // ১. প্রেরকের ইউজার ও হ্যাশ করা পিন চেক করা
    const [senderUser] = await db
      .select({ transactionPin: users.transactionPin, status: users.status })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!senderUser || !senderUser.transactionPin) {
      res.status(400).json({
        success: false,
        message:
          "Transaction PIN is not set for your account. Please set a PIN first.",
      });
      return;
    }

    // পিন ভেরিফিকেশন
    const isPinValid = await comparePin(
      transactionPin,
      senderUser.transactionPin
    );
    if (!isPinValid) {
      res.status(401).json({
        success: false,
        message: "Invalid transaction PIN.",
      });
      return;
    }

    // ২. প্রেরকের অ্যাকাউন্ট চেক (মালিকানা ও সক্রিয়তা)
    const [senderAccount] = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, senderAccountId),
          eq(accounts.userId, req.user.id)
        )
      )
      .limit(1);

    if (!senderAccount) {
      res.status(404).json({
        success: false,
        message: "Sender account not found or does not belong to you.",
      });
      return;
    }

    if (senderAccount.status !== "active") {
      res.status(403).json({
        success: false,
        message: `Sender account is currently ${senderAccount.status}. Transfer cannot proceed.`,
      });
      return;
    }

    // ৩. প্রাপকের অ্যাকাউন্ট চেক
    const [recipientAccount] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.accountNumber, recipientAccountNumber))
      .limit(1);

    if (!recipientAccount) {
      res.status(404).json({
        success: false,
        message: "Recipient account number does not exist.",
      });
      return;
    }

    if (recipientAccount.id === senderAccount.id) {
      res.status(400).json({
        success: false,
        message: "Cannot transfer money to the same account.",
      });
      return;
    }

    if (recipientAccount.status !== "active") {
      res.status(400).json({
        success: false,
        message: "Recipient account is currently inactive or frozen.",
      });
      return;
    }

    // ৪. ফাইন্যান্সিয়াল লিমিট ও ব্যালেন্স ভ্যালিডেশন
    const senderBalance = Number(senderAccount.balance);
    const minBalance = Number(senderAccount.minBalance);
    const maxSingleLimit = Number(senderAccount.maxSingleTransactionLimit);
    const fee = 0.0; // বর্তমান ট্রান্সফার ফি ০
    const totalDeduction = amount + fee;

    // সিঙ্গেল ট্রানজ্যাকশন লিমিট
    if (amount > maxSingleLimit) {
      res.status(400).json({
        success: false,
        message: `Transfer amount exceeds maximum single transaction limit of $${maxSingleLimit.toLocaleString()}.`,
      });
      return;
    }

    // পর্যাপ্ত ব্যালেন্স আছে কি না
    if (senderBalance - totalDeduction < minBalance) {
      res.status(400).json({
        success: false,
        message: `Insufficient funds. Minimum required balance after transfer is $${minBalance}. Available: $${senderBalance}.`,
      });
      return;
    }

    // সন্দেহজনক লেনদেন যাচাই (Rule: $20,000 এর বেশি হলে ফ্ল্যাগ হবে)
    const isSuspicious = amount >= 20000;
    const flaggedReason = isSuspicious
      ? "High value transaction exceeding threshold for admin review."
      : null;

    const transactionId = generateTransactionId();

    // ৫. ডাটাবেজ অ্যাটমিক ট্রানজ্যাকশন এক্সিকিউশন (ACID Guarantee)
    const result = await db.transaction(async (tx) => {
      // ৫.১ প্রেরকের অ্যাকাউন্ট থেকে টাকা কাটা
      const [updatedSender] = await tx
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} - ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, senderAccount.id))
        .returning();

      // ৫.২ প্রাপকের অ্যাকাউন্টে টাকা যোগ করা
      const [updatedRecipient] = await tx
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, recipientAccount.id))
        .returning();

      // ৫.৩ লেনদেনের রেকর্ড তৈরি করা
      const [createdTxn] = await tx
        .insert(transactions)
        .values({
          transactionId,
          senderAccountId: senderAccount.id,
          receiverAccountId: recipientAccount.id,
          transactionType: "fund_transfer",
          amount: amount.toFixed(2),
          transactionFee: fee.toFixed(2),
          status: "completed",
          description:
            description ||
            `Fund transfer to ${recipientAccount.accountNumber}`,
          reference: `TRF-${senderAccount.accountNumber}->${recipientAccount.accountNumber}`,
          isSuspicious,
          flaggedReason,
        })
        .returning();

      // ৫.৪ উভয় কাস্টমারকে নোটিফিকেশন পাঠানো
      // প্রেরককে
      await tx.insert(notifications).values({
        userId: senderAccount.userId,
        title: "Fund Transfer Successful",
        message: `You successfully transferred $${amount.toFixed(2)} to A/C ${recipientAccount.accountNumber}. Ref: ${transactionId}`,
        type: "transfer",
      });

      // প্রাপককে
      await tx.insert(notifications).values({
        userId: recipientAccount.userId,
        title: "Money Received",
        message: `You received $${amount.toFixed(2)} from A/C ${senderAccount.accountNumber}. Ref: ${transactionId}`,
        type: "transfer",
      });

      return {
        transaction: createdTxn,
        senderNewBalance: updatedSender.balance,
      };
    });

    res.status(200).json({
      success: true,
      message: "Fund transfer completed successfully.",
      transactionId,
      transaction: result.transaction,
      senderBalance: result.senderNewBalance,
    });
  } catch (error) {
    console.error("Fund Transfer Error:", error);
    res.status(500).json({
      success: false,
      message: "Fund transfer failed due to internal server error.",
    });
  }
};

/**
 * ২. ডিপোজিট / উইথড্রয়াল রিকোয়েস্ট তৈরি (Customer)
 */
export const requestDepositWithdrawal = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { accountId, type, amount, description } =
      req.body as DepositWithdrawalRequestInput;

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
        message: "Account not found or access denied.",
      });
      return;
    }

    if (account.status !== "active") {
      res.status(400).json({
        success: false,
        message: `Account is currently ${account.status}.`,
      });
      return;
    }

    // উইথড্রয়ালের ক্ষেত্রে পর্যাপ্ত ব্যালেন্স আছে কি না
    if (type === "withdrawal") {
      const balance = Number(account.balance);
      const minBalance = Number(account.minBalance);
      if (balance - amount < minBalance) {
        res.status(400).json({
          success: false,
          message: `Insufficient balance for withdrawal. Minimum balance must be $${minBalance}.`,
        });
        return;
      }
    }

    const [newRequest] = await db
      .insert(depositWithdrawalRequests)
      .values({
        accountId,
        userId: req.user.id,
        type,
        amount: amount.toFixed(2),
        description: description || `${type.toUpperCase()} request`,
        status: "pending",
      })
      .returning();

    res.status(201).json({
      success: true,
      message: `${type.toUpperCase()} request submitted successfully. Awaiting approval.`,
      request: newRequest,
    });
  } catch (error) {
    console.error("Deposit/Withdrawal Request Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error submitting request.",
    });
  }
};

/**
 * ৩. ডিপোজিট / উইথড্রয়াল রিকোয়েস্ট অনুমোদন বা বাতিল (Admin / Bank Staff)
 */
export const reviewDepositWithdrawal = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const requestId = parseInt(req.params.id as string, 10);
    const { action, rejectionReason } = req.body as ReviewRequestInput;

    const [request] = await db
      .select()
      .from(depositWithdrawalRequests)
      .where(eq(depositWithdrawalRequests.id, requestId))
      .limit(1);

    if (!request) {
      res.status(404).json({ success: false, message: "Request not found." });
      return;
    }

    if (request.status !== "pending") {
      res.status(400).json({
        success: false,
        message: `Request is already ${request.status}.`,
      });
      return;
    }

    const reqAmount = Number(request.amount);

    // রিজেক্ট করা হলে
    if (action === "reject") {
      const [updated] = await db
        .update(depositWithdrawalRequests)
        .set({
          status: "rejected",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
          rejectionReason: rejectionReason || "Request rejected by staff.",
          updatedAt: new Date(),
        })
        .where(eq(depositWithdrawalRequests.id, requestId))
        .returning();

      await db.insert(notifications).values({
        userId: request.userId,
        title: `${request.type.toUpperCase()} Rejected`,
        message: `Your ${request.type} request for $${reqAmount.toFixed(2)} was rejected. Reason: ${rejectionReason || "Not specified."}`,
        type: request.type as any,
      });

      res.status(200).json({
        success: true,
        message: `Request rejected successfully.`,
        request: updated,
      });
      return;
    }

    // অ্যাপ্রুভ করা হলে -> অ্যাটমিক ব্যালেন্স আপডেট ও ট্রানজ্যাকশন সৃষ্টি
    const transactionId = generateTransactionId();

    const approvalResult = await db.transaction(async (tx) => {
      let updatedAccount;

      if (request.type === "deposit") {
        [updatedAccount] = await tx
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} + ${reqAmount}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, request.accountId))
          .returning();

        await tx.insert(transactions).values({
          transactionId,
          receiverAccountId: request.accountId,
          transactionType: "deposit",
          amount: reqAmount.toFixed(2),
          transactionFee: "0.00",
          status: "completed",
          description: request.description || "Deposit approved",
          reference: `DEP-REQ-${request.id}`,
        });
      } else {
        // Withdrawal
        const [acc] = await tx
          .select()
          .from(accounts)
          .where(eq(accounts.id, request.accountId))
          .limit(1);

        if (!acc || Number(acc.balance) < reqAmount) {
          throw new Error("Insufficient account balance for withdrawal.");
        }

        [updatedAccount] = await tx
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} - ${reqAmount}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, request.accountId))
          .returning();

        await tx.insert(transactions).values({
          transactionId,
          senderAccountId: request.accountId,
          transactionType: "withdrawal",
          amount: reqAmount.toFixed(2),
          transactionFee: "0.00",
          status: "completed",
          description: request.description || "Withdrawal approved",
          reference: `WTH-REQ-${request.id}`,
        });
      }

      const [updatedReq] = await tx
        .update(depositWithdrawalRequests)
        .set({
          status: "approved",
          reviewedBy: req.user!.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(depositWithdrawalRequests.id, requestId))
        .returning();

      await tx.insert(notifications).values({
        userId: request.userId,
        title: `${request.type.toUpperCase()} Approved`,
        message: `Your ${request.type} request of $${reqAmount.toFixed(2)} has been approved. Trans Ref: ${transactionId}`,
        type: request.type as any,
      });

      return { updatedReq, newBalance: updatedAccount.balance };
    });

    res.status(200).json({
      success: true,
      message: `${request.type.toUpperCase()} approved successfully.`,
      request: approvalResult.updatedReq,
      newBalance: approvalResult.newBalance,
      transactionId,
    });
  } catch (error: any) {
    console.error("Review Request Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to review request.",
    });
  }
};

/**
 * ৪. ট্রানজ্যাকশন হিস্ট্রি দেখা (Search, Filter, Pagination)
 */
export const getTransactions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const {
      page = "1",
      limit = "10",
      search,
      type,
      status,
      startDate,
      endDate,
      accountId,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, parseInt(limit as string, 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];

    // যদি সাধারণ কাস্টমার হয়, তবে শুধুমাত্র নিজের অ্যাকাউন্টগুলোর ট্রানজ্যাকশন দেখতে পারবে
    if (req.user.role === "customer") {
      const userAccounts = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.userId, req.user.id));

      const accountIds = userAccounts.map((a) => a.id);
      if (accountIds.length === 0) {
        res.status(200).json({
          success: true,
          transactions: [],
          pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 },
        });
        return;
      }

      conditions.push(
        or(
          sql`${transactions.senderAccountId} IN ${accountIds}`,
          sql`${transactions.receiverAccountId} IN ${accountIds}`
        )
      );
    } else if (accountId) {
      const accId = parseInt(accountId as string, 10);
      conditions.push(
        or(
          eq(transactions.senderAccountId, accId),
          eq(transactions.receiverAccountId, accId)
        )
      );
    }

    if (search) {
      conditions.push(like(transactions.transactionId, `%${search}%`));
    }

    if (type) {
      conditions.push(eq(transactions.transactionType, type as any));
    }

    if (status) {
      conditions.push(eq(transactions.status, status as any));
    }

    if (startDate) {
      conditions.push(gte(transactions.createdAt, new Date(startDate as string)));
    }

    if (endDate) {
      conditions.push(lte(transactions.createdAt, new Date(endDate as string)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(whereClause);

    const total = Number(countResult.count);

    const txnList = await db
      .select()
      .from(transactions)
      .where(whereClause)
      .orderBy(desc(transactions.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.status(200).json({
      success: true,
      transactions: txnList,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get Transactions Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching transactions.",
    });
  }
};

/**
 * ৫. একক ট্রানজ্যাকশন ও রিসিট ডেটা দেখা
 */
export const getTransactionById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const [txn] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.transactionId, id as string))
      .limit(1);

    if (!txn) {
      res.status(404).json({ success: false, message: "Transaction not found." });
      return;
    }

    res.status(200).json({
      success: true,
      transaction: txn,
    });
  } catch (error) {
    console.error("Get Transaction Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching transaction details.",
    });
  }
};

/**
 * ৬. পেন্ডিং ডিপোজিট ও উইথড্রয়াল রিকোয়েস্ট লিস্ট (Admin & Staff)
 */
export const getPendingRequests = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const pendingList = await db
      .select({
        id: depositWithdrawalRequests.id,
        accountId: depositWithdrawalRequests.accountId,
        userId: depositWithdrawalRequests.userId,
        userName: users.name,
        userEmail: users.email,
        accountNumber: accounts.accountNumber,
        type: depositWithdrawalRequests.type,
        amount: depositWithdrawalRequests.amount,
        description: depositWithdrawalRequests.description,
        status: depositWithdrawalRequests.status,
        createdAt: depositWithdrawalRequests.createdAt,
      })
      .from(depositWithdrawalRequests)
      .innerJoin(users, eq(depositWithdrawalRequests.userId, users.id))
      .innerJoin(accounts, eq(depositWithdrawalRequests.accountId, accounts.id))
      .where(eq(depositWithdrawalRequests.status, "pending"))
      .orderBy(desc(depositWithdrawalRequests.createdAt));

    res.status(200).json({
      success: true,
      requests: pendingList,
    });
  } catch (error) {
    console.error("Get Pending Requests Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching pending requests.",
    });
  }
};

/**
 * ৭. সন্দেহজনক ট্রানজ্যাকশন ফ্ল্যাগ করা (Bank Staff for Admin review)
 */
export const flagTransaction = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const [updated] = await db
      .update(transactions)
      .set({
        isSuspicious: true,
        flaggedReason: reason || "Flagged for manual review by bank staff.",
      })
      .where(eq(transactions.transactionId, id as string))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, message: "Transaction not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Transaction flagged successfully for admin review.",
      transaction: updated,
    });
  } catch (error) {
    console.error("Flag Transaction Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error flagging transaction.",
    });
  }
};

