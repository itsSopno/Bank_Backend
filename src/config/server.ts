import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASEURL!;
const client = postgres(connectionString, { ssl: "require" });

export const db = drizzle(client);