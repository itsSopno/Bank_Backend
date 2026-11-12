import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
    ssl: process.env.NODE_ENV === "production" ? "require" : false
});


export const db = drizzle(client);

export const testDBConnection = async () => {
    try {
        await client.unsafe('SELECT 1');
        console.log("Database connected sucessfully");
    } catch (error) {
        console.error("Database connection faied : ", error)
    }
}