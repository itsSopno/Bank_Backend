import type { Request, Response } from "express";
import { eq, and, desc, sql, like } from "drizzle-orm";
import { db } from "../config/server.js";
import { accounts, users, transactions } from "../db/schema.js";
import { generateAccountNumber, generateTransactionId } from "../utils/banking.util.js";
import type {
  CreateAccountInput,
  UpdateAccountStatusInput,
  UpdateAccountLimitsInput,
} from "../validators/account.validators.js";

/**
 * ১. নতুন ব্যাংক অ্যাকাউন্ট তৈরি (Admin & Staff)
 */
export const createAccount = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      userId,
      accountType,
      initialDeposit = 0,
      dailyTransferLimit = 50000,
      maxSingleTransactionLimit = 25000,
      minBalance = 500,
    } = req.body as CreateAccountInput;

    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    const accountNumber = generateAccountNumber();

    const created = await db.transaction(async (tx) => {
      const [newAcc] = await tx
        .insert(accounts)
        .values({
          accountNumber,
          userId,
          accountType,
          balance: initialDeposit.toFixed(2),
          status: "active",
          dailyTransferLimit: dailyTransferLimit.toFixed(2),
          maxSingleTransactionLimit: maxSingleTransactionLimit.toFixed(2),
          minBalance: minBalance.toFixed(2),
        })
        .returning();

      // যদি প্রাথমিক ডিপোজিট থাকে তবে ডিপোজিট ট্রানজ্যাকশন রেকর্ড তৈরি করা
      if (initialDeposit > 0) {
        await tx.insert(transactions).values({
          transactionId: generateTransactionId(),
          receiverAccountId: newAcc.id,
          transactionType: "deposit",
          amount: initialDeposit.toFixed(2),
          transactionFee: "0.00",
          status: "completed",
          description: "Initial account opening deposit",
          reference: `INIT-DEP-${newAcc.accountNumber}`,
        });
      }

      return newAcc;
    });

    res.status(201).json({
      success: true,
      message: "Bank account created successfully.",
      account: created,
    });
  } catch (error) {
    console.error("Create Account Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error creating bank account.",
    });
  }
};

/**
 * ২. সকল অ্যাকাউন্ট দেখা (Admin & Staff)
 */
export const getAllAccounts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { page = "1", limit = "10", search, status, type } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, parseInt(limit as string, 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];

    if (search) {
      conditions.push(like(accounts.accountNumber, `%${search}%`));
    }
    if (status) {
      conditions.push(eq(accounts.status, status as any));
    }
    if (type) {
      conditions.push(eq(accounts.accountType, type as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(accounts)
      .where(whereClause);

    const total = Number(countResult.count);

    const accountList = await db
      .select({
        id: accounts.id,
        accountNumber: accounts.accountNumber,
        userId: accounts.userId,
        userName: users.name,
        userEmail: users.email,
        accountType: accounts.accountType,
        balance: accounts.balance,
        status: accounts.status,
        dailyTransferLimit: accounts.dailyTransferLimit,
        maxSingleTransactionLimit: accounts.maxSingleTransactionLimit,
        minBalance: accounts.minBalance,
        createdAt: accounts.createdAt,
      })
      .from(accounts)
      .innerJoin(users, eq(accounts.userId, users.id))
      .where(whereClause)
      .orderBy(desc(accounts.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.status(200).json({
      success: true,
      accounts: accountList,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get All Accounts Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching accounts.",
    });
  }
};

/**
 * ৩. কাস্টমারের নিজস্ব অ্যাকাউন্টসমূহ দেখা (Customer)
 */
export const getMyAccounts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const myAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, req.user.id))
      .orderBy(accounts.id);

    res.status(200).json({
      success: true,
      accounts: myAccounts,
    });
  } catch (error) {
    console.error("Get My Accounts Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching your accounts.",
    });
  }
};

/**
 * ৪. একক অ্যাকাউন্টের বিস্তারিত ও লেনদেন হিস্ট্রি
 */
export const getAccountById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const accountId = parseInt(req.params.id as string, 10);

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      res.status(404).json({ success: false, message: "Account not found." });
      return;
    }

    // সিকিউরিটি: কাস্টমার শুধুমাত্র নিজের অ্যাকাউন্ট দেখতে পারবে
    if (req.user?.role === "customer" && account.userId !== req.user.id) {
      res.status(403).json({ success: false, message: "Access forbidden." });
      return;
    }

    // সাম্প্রতিক ৫টি ট্রানজ্যাকশন
    const recentTxns = await db
      .select()
      .from(transactions)
      .where(
        sql`${transactions.senderAccountId} = ${account.id} OR ${transactions.receiverAccountId} = ${account.id}`
      )
      .orderBy(desc(transactions.createdAt))
      .limit(5);

    res.status(200).json({
      success: true,
      account,
      recentTransactions: recentTxns,
    });
  } catch (error) {
    console.error("Get Account Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching account details.",
    });
  }
};

/**
 * ৫. অ্যাকাউন্ট স্ট্যাটাস আপডেট (Freeze / Unfreeze / Close) (Admin & Staff)
 */
export const updateAccountStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const accountId = parseInt(req.params.id as string, 10);
    const { status } = req.body as UpdateAccountStatusInput;

    const [updated] = await db
      .update(accounts)
      .set({ status, updatedAt: new Date() })
      .where(eq(accounts.id, accountId))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, message: "Account not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Account has been set to ${status}.`,
      account: updated,
    });
  } catch (error) {
    console.error("Update Account Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error updating account status.",
    });
  }
};

/**
 * ৬. অ্যাকাউন্ট লেনদেন লিমিট পরিবর্তন (Admin only)
 */
export const updateAccountLimits = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const accountId = parseInt(req.params.id as string, 10);
    const { dailyTransferLimit, maxSingleTransactionLimit, minBalance } =
      req.body as UpdateAccountLimitsInput;

    const updateFields: any = { updatedAt: new Date() };
    if (dailyTransferLimit !== undefined) {
      updateFields.dailyTransferLimit = dailyTransferLimit.toFixed(2);
    }
    if (maxSingleTransactionLimit !== undefined) {
      updateFields.maxSingleTransactionLimit = maxSingleTransactionLimit.toFixed(2);
    }
    if (minBalance !== undefined) {
      updateFields.minBalance = minBalance.toFixed(2);
    }

    const [updated] = await db
      .update(accounts)
      .set(updateFields)
      .where(eq(accounts.id, accountId))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, message: "Account not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Account limits updated successfully.",
      account: updated,
    });
  } catch (error) {
    console.error("Update Account Limits Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error updating account limits.",
    });
  }
};

/**
 * ৭. অ্যাকাউন্ট স্টেটমেন্ট এক্সপোর্ট ডেটা (CSV / JSON)
 */
export const getAccountStatement = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const accountId = parseInt(req.params.id as string, 10);
    const { startDate, endDate, format = "json" } = req.query;

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      res.status(404).json({ success: false, message: "Account not found." });
      return;
    }

    if (req.user?.role === "customer" && account.userId !== req.user.id) {
      res.status(403).json({ success: false, message: "Access forbidden." });
      return;
    }

    const conditions: any[] = [
      sql`${transactions.senderAccountId} = ${account.id} OR ${transactions.receiverAccountId} = ${account.id}`,
    ];

    if (startDate) {
      conditions.push(sql`${transactions.createdAt} >= ${new Date(startDate as string)}`);
    }
    if (endDate) {
      conditions.push(sql`${transactions.createdAt} <= ${new Date(endDate as string)}`);
    }

    const statementTxns = await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.createdAt));

    if (format === "csv") {
      const csvHeader = "Transaction ID,Date,Type,Amount,Fee,Status,Description\n";
      const csvRows = statementTxns
        .map(
          (t) =>
            `"${t.transactionId}","${t.createdAt.toISOString()}","${t.transactionType}","${t.amount}","${t.transactionFee}","${t.status}","${t.description || ""}"`
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=statement-${account.accountNumber}.csv`
      );
      res.status(200).send(csvHeader + csvRows);
      return;
    }

    res.status(200).json({
      success: true,
      account: {
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        balance: account.balance,
      },
      transactions: statementTxns,
    });
  } catch (error) {
    console.error("Get Statement Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error generating statement.",
    });
  }
};

