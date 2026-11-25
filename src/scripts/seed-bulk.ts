import { db } from "../config/server.js";

async function seedBulk() {
  console.log("⚡ Starting High-Speed 100,000 Records Seeder on Supabase...");
  const startTime = Date.now();

  try {
    // 1. Get existing account IDs to ensure foreign key integrity
    const accountRows = await db.execute(
      "SELECT id FROM bank.accounts ORDER BY id"
    );
    const accountIds = (accountRows as any[]).map((r) => r.id);

    if (accountIds.length === 0) {
      console.error("❌ No accounts found. Please run 'npm run db:seed' first.");
      process.exit(1);
    }

    console.log(`Available account IDs: [${accountIds.join(", ")}]`);
    console.log("Generating and inserting 100,000 transactions directly in PostgreSQL engine...");

    // 2. High-Performance Server-Side Bulk Generation
    const sqlQuery = `
      INSERT INTO bank.transactions (
        transaction_id,
        sender_account_id,
        receiver_account_id,
        transaction_type,
        amount,
        transaction_fee,
        status,
        description,
        reference,
        is_suspicious,
        flagged_reason,
        created_at
      )
      SELECT
        'TXN-' || to_char(created_date, 'YYYYMMDD') || '-' || lpad(s::text, 7, '0') || upper(substring(md5(random()::text) from 1 for 4)) AS transaction_id,
        CASE 
          WHEN txn_type IN ('deposit', 'loan_disbursement') THEN NULL
          ELSE (${accountIds[0]} + (floor(random() * ${accountIds.length}))::int)
        END AS sender_account_id,
        CASE 
          WHEN txn_type IN ('withdrawal', 'loan_repayment') THEN NULL
          ELSE (${accountIds[0]} + (floor(random() * ${accountIds.length}))::int)
        END AS receiver_account_id,
        txn_type::bank.transaction_type AS transaction_type,
        round((random() * 3500 + 15)::numeric, 2) AS amount,
        '0.00'::numeric AS transaction_fee,
        CASE 
          WHEN random() < 0.88 THEN 'completed'::bank.transaction_status
          WHEN random() < 0.95 THEN 'pending'::bank.transaction_status
          ELSE 'failed'::bank.transaction_status
        END AS status,
        'Automated simulated transaction #' || s AS description,
        'REF-BULK-' || s AS reference,
        CASE WHEN random() < 0.02 THEN true ELSE false END AS is_suspicious,
        CASE WHEN random() < 0.02 THEN 'Unusual transaction pattern flagged by fraud detection engine' ELSE NULL END AS flagged_reason,
        created_date AS created_at
      FROM generate_series(1, 100000) AS s,
      LATERAL (
        SELECT 
          (ARRAY['fund_transfer', 'deposit', 'withdrawal', 'loan_disbursement', 'loan_repayment'])[floor(random() * 5 + 1)] AS txn_type,
          NOW() - (random() * interval '365 days') AS created_date
      ) AS params;
    `;

    await db.execute(sqlQuery);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 3. Count total records in database
    const [countResult] = (await db.execute(
      "SELECT count(*) as total FROM bank.transactions"
    )) as any[];

    console.log(`\n🎉 SUCCESS! 100,000 Transactions generated and inserted in ${duration} seconds!`);
    console.log(`📊 Total Transactions now in Supabase Database: ${Number(countResult.total).toLocaleString()} records!`);
    console.log("-------------------------------------------------------------------");
    console.log("All transactions are distributed across 12 months with realistic amounts,");
    console.log("statuses, and transaction types. Recharts graphs and pagination are now ultra-rich!\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Bulk Seeding Error:", error);
    process.exit(1);
  }
}

seedBulk();
