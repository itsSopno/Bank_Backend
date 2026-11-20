import type { Request, Response } from "express";
import { eq, and, desc, sql, like, or } from "drizzle-orm";
import { db } from "../config/server.js";
import { users, accounts, loans, transactions } from "../db/schema.js";

/**
 * ১. সকল কাস্টমার তালিকা দেখা ও সার্চ করা (Admin & Staff)
 */
export const getAllCustomers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { page = "1", limit = "10", search, status } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, parseInt(limit as string, 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [eq(users.role, "customer")];

    if (search) {
      conditions.push(
        or(
          like(users.name, `%${search}%`),
          like(users.email, `%${search}%`),
          like(users.phone, `%${search}%`)
        )
      );
    }

    if (status) {
      conditions.push(eq(users.status, status as any));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);

    const total = Number(countResult.count);

    const customerList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        address: users.address,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.status(200).json({
      success: true,
      customers: customerList,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get All Customers Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching customers.",
    });
  }
};

/**
 * ২. একক কাস্টমারের বিস্তারিত প্রোফাইল, অ্যাকাউন্টসমূহ ও লোন হিস্ট্রি
 */
export const getCustomerById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const customerId = parseInt(req.params.id as string, 10);

    const [customer] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        address: users.address,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.id, customerId), eq(users.role, "customer")))
      .limit(1);

    if (!customer) {
      res.status(404).json({ success: false, message: "Customer not found." });
      return;
    }

    // কাস্টমারের ব্যাংক অ্যাকাউন্টসমূহ
    const customerAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, customer.id));

    // কাস্টমারের লোনসমূহ
    const customerLoans = await db
      .select()
      .from(loans)
      .where(eq(loans.userId, customer.id))
      .orderBy(desc(loans.createdAt));

    // কাস্টমারের সাম্প্রতিক ট্রানজ্যাকশনসমূহ
    const accountIds = customerAccounts.map((a) => a.id);
    let customerTxns: any[] = [];
    if (accountIds.length > 0) {
      customerTxns = await db
        .select()
        .from(transactions)
        .where(
          or(
            sql`${transactions.senderAccountId} IN ${accountIds}`,
            sql`${transactions.receiverAccountId} IN ${accountIds}`
          )
        )
        .orderBy(desc(transactions.createdAt))
        .limit(10);
    }

    res.status(200).json({
      success: true,
      customer,
      accounts: customerAccounts,
      loans: customerLoans,
      recentTransactions: customerTxns,
    });
  } catch (error) {
    console.error("Get Customer Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching customer details.",
    });
  }
};

/**
 * ৩. কাস্টমার স্ট্যাটাস আপডেট (Activate, Deactivate, Block) (Admin only)
 */
export const updateCustomerStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const customerId = parseInt(req.params.id as string, 10);
    const { status } = req.body;

    if (!["active", "inactive", "blocked"].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Status must be active, inactive, or blocked.",
      });
      return;
    }

    const [updated] = await db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, customerId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
      });

    if (!updated) {
      res.status(404).json({ success: false, message: "Customer not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Customer status updated to ${status}.`,
      customer: updated,
    });
  } catch (error) {
    console.error("Update Customer Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error updating customer status.",
    });
  }
};
