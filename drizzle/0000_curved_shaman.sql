CREATE SCHEMA IF NOT EXISTS "bank";
--> statement-breakpoint
CREATE TYPE "bank"."account_status" AS ENUM('active', 'frozen', 'closed');--> statement-breakpoint
CREATE TYPE "bank"."account_type" AS ENUM('savings', 'current', 'business');--> statement-breakpoint
CREATE TYPE "bank"."loan_status" AS ENUM('pending', 'under_review', 'approved', 'rejected', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "bank"."loan_type" AS ENUM('personal', 'home', 'business', 'education');--> statement-breakpoint
CREATE TYPE "bank"."notification_type" AS ENUM('transfer', 'deposit', 'withdrawal', 'loan', 'security', 'system');--> statement-breakpoint
CREATE TYPE "bank"."request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "bank"."request_type" AS ENUM('deposit', 'withdrawal');--> statement-breakpoint
CREATE TYPE "bank"."transaction_status" AS ENUM('pending', 'completed', 'failed', 'reversed');--> statement-breakpoint
CREATE TYPE "bank"."transaction_type" AS ENUM('deposit', 'withdrawal', 'fund_transfer', 'loan_disbursement', 'loan_repayment');--> statement-breakpoint
CREATE TYPE "bank"."user_role" AS ENUM('admin', 'bank_staff', 'customer');--> statement-breakpoint
CREATE TYPE "bank"."user_status" AS ENUM('active', 'inactive', 'blocked');--> statement-breakpoint
CREATE TABLE "bank"."accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_number" text NOT NULL,
	"user_id" integer NOT NULL,
	"account_type" "bank"."account_type" DEFAULT 'savings' NOT NULL,
	"balance" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"status" "bank"."account_status" DEFAULT 'active' NOT NULL,
	"daily_transfer_limit" numeric(15, 2) DEFAULT '50000.00' NOT NULL,
	"max_single_transaction_limit" numeric(15, 2) DEFAULT '25000.00' NOT NULL,
	"min_balance" numeric(15, 2) DEFAULT '500.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_account_number_unique" UNIQUE("account_number")
);
--> statement-breakpoint
CREATE TABLE "bank"."bank_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"default_daily_transfer_limit" numeric(15, 2) DEFAULT '50000.00' NOT NULL,
	"default_max_single_transaction" numeric(15, 2) DEFAULT '25000.00' NOT NULL,
	"default_min_account_balance" numeric(15, 2) DEFAULT '500.00' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank"."deposit_withdrawal_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"type" "bank"."request_type" NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"description" text,
	"status" "bank"."request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank"."loan_repayments" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_id" integer NOT NULL,
	"transaction_id" integer,
	"amount" numeric(15, 2) NOT NULL,
	"repayment_date" timestamp DEFAULT now() NOT NULL,
	"remaining_balance_after" numeric(15, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank"."loans" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"loan_type" "bank"."loan_type" DEFAULT 'personal' NOT NULL,
	"requested_amount" numeric(15, 2) NOT NULL,
	"approved_amount" numeric(15, 2),
	"interest_rate" numeric(5, 2) DEFAULT '8.50' NOT NULL,
	"duration_months" integer NOT NULL,
	"monthly_income" numeric(15, 2) NOT NULL,
	"employment_status" text NOT NULL,
	"application_description" text,
	"status" "bank"."loan_status" DEFAULT 'pending' NOT NULL,
	"remaining_balance" numeric(15, 2),
	"monthly_installment" numeric(15, 2),
	"reviewed_by" integer,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loans_loan_id_unique" UNIQUE("loan_id")
);
--> statement-breakpoint
CREATE TABLE "bank"."notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" "bank"."notification_type" DEFAULT 'system' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank"."transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"sender_account_id" integer,
	"receiver_account_id" integer,
	"transaction_type" "bank"."transaction_type" NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"transaction_fee" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"status" "bank"."transaction_status" DEFAULT 'completed' NOT NULL,
	"description" text,
	"reference" text,
	"is_suspicious" boolean DEFAULT false NOT NULL,
	"flagged_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "bank"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" "bank"."user_role" DEFAULT 'customer' NOT NULL,
	"status" "bank"."user_status" DEFAULT 'active' NOT NULL,
	"phone" text,
	"address" text,
	"transaction_pin" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bank"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "bank"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank"."deposit_withdrawal_requests" ADD CONSTRAINT "deposit_withdrawal_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "bank"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank"."deposit_withdrawal_requests" ADD CONSTRAINT "deposit_withdrawal_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "bank"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank"."deposit_withdrawal_requests" ADD CONSTRAINT "deposit_withdrawal_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "bank"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank"."loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "bank"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank"."loan_repayments" ADD CONSTRAINT "loan_repayments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "bank"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank"."loans" ADD CONSTRAINT "loans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "bank"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank"."loans" ADD CONSTRAINT "loans_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "bank"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank"."loans" ADD CONSTRAINT "loans_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "bank"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "bank"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank"."transactions" ADD CONSTRAINT "transactions_sender_account_id_accounts_id_fk" FOREIGN KEY ("sender_account_id") REFERENCES "bank"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank"."transactions" ADD CONSTRAINT "transactions_receiver_account_id_accounts_id_fk" FOREIGN KEY ("receiver_account_id") REFERENCES "bank"."accounts"("id") ON DELETE no action ON UPDATE no action;