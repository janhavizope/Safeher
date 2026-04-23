import "dotenv/config";
import { Pool } from "pg";

async function main() {
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

  const result = await pool.query(
    "SELECT id, incidentType, severity, status, submittedAt, trackingPin FROM incidents ORDER BY id DESC LIMIT 10"
  );
  console.log(result.rows);
  await pool.end();
}

main().catch(error => {
  console.error("DB_CHECK_ERROR", error);
  process.exit(1);
});
