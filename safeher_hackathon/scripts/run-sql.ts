import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const sql = process.argv.slice(2).join(" ").trim();

  if (!sql) {
    console.error("Usage: pnpm exec tsx scripts/run-sql.ts \"SELECT * FROM incidents LIMIT 5\"");
    process.exit(1);
  }

  const uri = process.env.DATABASE_URL;
  if (!uri) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  const connectionUrl = new URL(uri);
  connectionUrl.searchParams.delete("sslmode");

  const pool = new Pool({
    connectionString: connectionUrl.toString(),
    ssl: { rejectUnauthorized: false },
  });

  try {
    const result = await pool.query(sql);
    console.log(result.rows);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error("RUN_SQL_ERROR", error);
  process.exit(1);
});
