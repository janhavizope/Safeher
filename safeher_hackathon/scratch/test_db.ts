import "dotenv/config";
import { Pool } from "pg";

async function testConnection() {
  console.log("Testing database connection to:", process.env.DATABASE_URL);
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing!");
    process.exit(1);
  }

  const connectionUrl = new URL(process.env.DATABASE_URL);
  connectionUrl.searchParams.delete("sslmode");

  const pool = new Pool({
    connectionString: connectionUrl.toString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    console.log("Successfully connected to the database!");
    const res = await client.query("SELECT NOW()");
    console.log("Current time from DB:", res.rows[0]);
    client.release();
    process.exit(0);
  } catch (err) {
    console.error("Failed to connect to the database:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
