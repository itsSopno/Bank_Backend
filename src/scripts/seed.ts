import { db } from "../config/server.js";
import { users, accounts, bankSettings } from "../db/schema.js";
import { hashPassword, hashPin } from "../utils/auth.utils.js";

async function seed() {
  console.log("🌱 Starting Database Seeding on Supabase (bank schema)...");

  const defaultPassword = await hashPassword("Password123!");
  const defaultPin = await hashPin("1234");
  const customer2Pin = await hashPin("5678");

  // 1. Seed Admin
  console.log("Creating Admin user...");
  const [admin] = await db
    .insert(users)
    .values({
      name: "Super Admin",
      email: "admin@bank.com",
      password: defaultPassword,
      role: "admin",
      status: "active",
      phone: "+1234567890",
      address: "Bank HQ, Central City",
    })
    .onConflictDoNothing()
    .returning();

  // 2. Seed Bank Staff
  console.log("Creating Bank Staff user...");
  const [staff] = await db
    .insert(users)
    .values({
      name: "Senior Bank Staff",
      email: "staff@bank.com",
      password: defaultPassword,
      role: "bank_staff",
      status: "active",
      phone: "+1234567891",
      address: "Main Branch, Central City",
    })
    .onConflictDoNothing()
    .returning();

  // 3. Seed Customer 1
  console.log("Creating Customer 1 (John Doe)...");
  const [customer1] = await db
    .insert(users)
    .values({
      name: "John Doe",
      email: "customer@bank.com",
      password: defaultPassword,
      role: "customer",
      status: "active",
      phone: "+1234567892",
      address: "45 Wall Street, Financial District",
      transactionPin: defaultPin,
    })
    .onConflictDoNothing()
    .returning();

  if (customer1) {
    console.log("Creating accounts for Customer 1...");
    await db.insert(accounts).values([
      {
        accountNumber: "1001111111",
        userId: customer1.id,
        accountType: "savings",
        balance: "25000.00",
        status: "active",
        dailyTransferLimit: "50000.00",
        maxSingleTransactionLimit: "25000.00",
        minBalance: "500.00",
      },
      {
        accountNumber: "1002222222",
        userId: customer1.id,
        accountType: "current",
        balance: "50000.00",
        status: "active",
        dailyTransferLimit: "100000.00",
        maxSingleTransactionLimit: "50000.00",
        minBalance: "1000.00",
      },
    ]);
  }

  // 4. Seed Customer 2
  console.log("Creating Customer 2 (Alice Smith)...");
  const [customer2] = await db
    .insert(users)
    .values({
      name: "Alice Smith",
      email: "customer2@bank.com",
      password: defaultPassword,
      role: "customer",
      status: "active",
      phone: "+1234567893",
      address: "12 Lakeview Avenue",
      transactionPin: customer2Pin,
    })
    .onConflictDoNothing()
    .returning();

  if (customer2) {
    console.log("Creating account for Customer 2...");
    await db.insert(accounts).values([
      {
        accountNumber: "1003333333",
        userId: customer2.id,
        accountType: "savings",
        balance: "15000.00",
        status: "active",
        dailyTransferLimit: "50000.00",
        maxSingleTransactionLimit: "25000.00",
        minBalance: "500.00",
      },
    ]);
  }

  // 5. Seed Bank Settings
  console.log("Setting default bank settings...");
  await db.insert(bankSettings).values({
    defaultDailyTransferLimit: "100000.00",
    defaultMaxSingleTransaction: "50000.00",
    defaultMinAccountBalance: "500.00",
  });

  console.log("\n✅ Database Seeding completed successfully!");
  console.log("=========================================");
  console.log("DEMO CREDENTIALS (for testing & evaluation):");
  console.log("👑 Admin:     admin@bank.com     / Password123!");
  console.log("👔 Staff:     staff@bank.com     / Password123!");
  console.log("👤 Customer1: customer@bank.com  / Password123! (PIN: 1234)");
  console.log("   - Savings A/C: 1001111111 (Balance: $25,000.00)");
  console.log("   - Current A/C: 1002222222 (Balance: $50,000.00)");
  console.log("👤 Customer2: customer2@bank.com / Password123! (PIN: 5678)");
  console.log("   - Savings A/C: 1003333333 (Balance: $15,000.00)");
  console.log("=========================================\n");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});

