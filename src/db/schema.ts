import {
  pgTable,
  serial,
  text,
  timestamp,
  numeric,
  boolean,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ==========================================
// 1. ENUMS
// ==========================================
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "bank_staff",
  "customer",
]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "inactive",
  "blocked",
]);

export const accountTypeEnum = pgEnum("account_type", [
  "savings",
  "current",
  "business",
]);

export const accountStatusEnum = pgEnum("account_status", [
  "active",
  "frozen",
  "closed",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "deposit",
  "withdrawal",
  "fund_transfer",
  "loan_disbursement",
  "loan_repayment",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "completed",
  "failed",
  "reversed",
]);

export const requestTypeEnum = pgEnum("request_type", [
  "deposit",
  "withdrawal",
]);

export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "approved",
  "rejected",
]);

export const loanTypeEnum = pgEnum("loan_type", [
  "personal",
  "home",
  "business",
  "education",
]);

export const loanStatusEnum = pgEnum("loan_status", [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "active",
  "completed",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "transfer",
  "deposit",
  "withdrawal",
  "loan",
  "security",
  "system",
]);

// ==========================================
// 2. USERS TABLE
// ==========================================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").default("customer").notNull(),
  status: userStatusEnum("status").default("active").notNull(),
  phone: text("phone"),
  address: text("address"),
  transactionPin: text("transaction_pin"), // Hashed 4 or 6 digit PIN for customers
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==========================================
// 3. BANK ACCOUNTS TABLE
// ==========================================
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  accountNumber: text("account_number").notNull().unique(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  accountType: accountTypeEnum("account_type").default("savings").notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 })
    .default("0.00")
    .notNull(),
  status: accountStatusEnum("status").default("active").notNull(),
  dailyTransferLimit: numeric("daily_transfer_limit", { precision: 15, scale: 2 })
    .default("50000.00")
    .notNull(),
  maxSingleTransactionLimit: numeric("max_single_transaction_limit", {
    precision: 15,
    scale: 2,
  })
    .default("25000.00")
    .notNull(),
  minBalance: numeric("min_balance", { precision: 15, scale: 2 })
    .default("500.00")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==========================================
// 4. TRANSACTIONS TABLE
// ==========================================
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  transactionId: text("transaction_id").notNull().unique(),
  senderAccountId: integer("sender_account_id").references(() => accounts.id),
  receiverAccountId: integer("receiver_account_id").references(() => accounts.id),
  transactionType: transactionTypeEnum("transaction_type").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  transactionFee: numeric("transaction_fee", { precision: 15, scale: 2 })
    .default("0.00")
    .notNull(),
  status: transactionStatusEnum("status").default("completed").notNull(),
  description: text("description"),
  reference: text("reference"),
  isSuspicious: boolean("is_suspicious").default(false).notNull(),
  flaggedReason: text("flagged_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==========================================
// 5. DEPOSIT & WITHDRAWAL REQUESTS TABLE
// ==========================================
export const depositWithdrawalRequests = pgTable("deposit_withdrawal_requests", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .references(() => accounts.id, { onDelete: "cascade" })
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  type: requestTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  description: text("description"),
  status: requestStatusEnum("status").default("pending").notNull(),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==========================================
// 6. LOANS TABLE
// ==========================================
export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  loanId: text("loan_id").notNull().unique(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  accountId: integer("account_id")
    .references(() => accounts.id, { onDelete: "cascade" })
    .notNull(),
  loanType: loanTypeEnum("loan_type").default("personal").notNull(),
  requestedAmount: numeric("requested_amount", { precision: 15, scale: 2 }).notNull(),
  approvedAmount: numeric("approved_amount", { precision: 15, scale: 2 }),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 })
    .default("8.50")
    .notNull(),
  durationMonths: integer("duration_months").notNull(),
  monthlyIncome: numeric("monthly_income", { precision: 15, scale: 2 }).notNull(),
  employmentStatus: text("employment_status").notNull(),
  applicationDescription: text("application_description"),
  status: loanStatusEnum("status").default("pending").notNull(),
  remainingBalance: numeric("remaining_balance", { precision: 15, scale: 2 }),
  monthlyInstallment: numeric("monthly_installment", { precision: 15, scale: 2 }),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==========================================
// 7. LOAN REPAYMENTS TABLE
// ==========================================
export const loanRepayments = pgTable("loan_repayments", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id")
    .references(() => loans.id, { onDelete: "cascade" })
    .notNull(),
  transactionId: integer("transaction_id").references(() => transactions.id),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  repaymentDate: timestamp("repayment_date").defaultNow().notNull(),
  remainingBalanceAfter: numeric("remaining_balance_after", {
    precision: 15,
    scale: 2,
  }).notNull(),
});

// ==========================================
// 8. NOTIFICATIONS TABLE
// ==========================================
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: notificationTypeEnum("type").default("system").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==========================================
// 9. BANK SETTINGS TABLE
// ==========================================
export const bankSettings = pgTable("bank_settings", {
  id: serial("id").primaryKey(),
  defaultDailyTransferLimit: numeric("default_daily_transfer_limit", {
    precision: 15,
    scale: 2,
  })
    .default("50000.00")
    .notNull(),
  defaultMaxSingleTransaction: numeric("default_max_single_transaction", {
    precision: 15,
    scale: 2,
  })
    .default("25000.00")
    .notNull(),
  defaultMinAccountBalance: numeric("default_min_account_balance", {
    precision: 15,
    scale: 2,
  })
    .default("500.00")
    .notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==========================================
// 10. RELATIONS
// ==========================================
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  loans: many(loans),
  notifications: many(notifications),
  requests: many(depositWithdrawalRequests),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  sentTransactions: many(transactions, { relationName: "sentTransactions" }),
  receivedTransactions: many(transactions, {
    relationName: "receivedTransactions",
  }),
  loans: many(loans),
  requests: many(depositWithdrawalRequests),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  senderAccount: one(accounts, {
    fields: [transactions.senderAccountId],
    references: [accounts.id],
    relationName: "sentTransactions",
  }),
  receiverAccount: one(accounts, {
    fields: [transactions.receiverAccountId],
    references: [accounts.id],
    relationName: "receivedTransactions",
  }),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  user: one(users, {
    fields: [loans.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [loans.accountId],
    references: [accounts.id],
  }),
  repayments: many(loanRepayments),
}));

export const loanRepaymentsRelations = relations(loanRepayments, ({ one }) => ({
  loan: one(loans, {
    fields: [loanRepayments.loanId],
    references: [loans.id],
  }),
  transaction: one(transactions, {
    fields: [loanRepayments.transactionId],
    references: [transactions.id],
  }),
}));

export const depositWithdrawalRequestsRelations = relations(
  depositWithdrawalRequests,
  ({ one }) => ({
    user: one(users, {
      fields: [depositWithdrawalRequests.userId],
      references: [users.id],
    }),
    account: one(accounts, {
      fields: [depositWithdrawalRequests.accountId],
      references: [accounts.id],
    }),
  })
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
