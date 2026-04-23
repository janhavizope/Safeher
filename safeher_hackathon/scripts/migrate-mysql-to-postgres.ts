import "dotenv/config";
import mysql from "mysql2/promise";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";

type AnyRow = Record<string, any>;

async function ensurePgSchema(pgPool: Pool) {
  const exists = await pgPool.query("SELECT to_regclass('public.users') AS t");
  if (exists.rows[0]?.t) {
    return;
  }

  const sqlPath = path.resolve(process.cwd(), "drizzle_pg", "0000_initial.sql");
  const sql = readFileSync(sqlPath, "utf8");
  await pgPool.query(sql);
}

async function copyTable(
  mysqlPool: mysql.Pool,
  pgPool: Pool,
  mysqlQuery: string,
  pgInsertSql: string,
  mapper: (row: AnyRow) => any[]
) {
  const [rows] = await mysqlPool.query(mysqlQuery);
  for (const row of rows as AnyRow[]) {
    await pgPool.query(pgInsertSql, mapper(row));
  }
  return (rows as AnyRow[]).length;
}

async function setSequences(pgPool: Pool) {
  const seqQueries = [
    `SELECT setval(pg_get_serial_sequence('"users"', 'id'), COALESCE((SELECT MAX("id") FROM "users"), 1), true);`,
    `SELECT setval(pg_get_serial_sequence('"incidents"', 'id'), COALESCE((SELECT MAX("id") FROM "incidents"), 1), true);`,
    `SELECT setval(pg_get_serial_sequence('"alertSubscriptions"', 'id'), COALESCE((SELECT MAX("id") FROM "alertSubscriptions"), 1), true);`,
    `SELECT setval(pg_get_serial_sequence('"media_attachments"', 'id'), COALESCE((SELECT MAX("id") FROM "media_attachments"), 1), true);`,
    `SELECT setval(pg_get_serial_sequence('"rate_limit_log"', 'id'), COALESCE((SELECT MAX("id") FROM "rate_limit_log"), 1), true);`,
  ];

  for (const q of seqQueries) {
    await pgPool.query(q);
  }
}

async function main() {
  const mysqlUrl = process.env.MYSQL_SOURCE_URL;
  const pgUrl = process.env.DATABASE_URL;

  if (!mysqlUrl) {
    throw new Error("MYSQL_SOURCE_URL missing in .env");
  }
  if (!pgUrl) {
    throw new Error("DATABASE_URL missing in .env");
  }

  const mysqlPool = mysql.createPool({ uri: mysqlUrl });
  const pgConnectionUrl = new URL(pgUrl);
  pgConnectionUrl.searchParams.delete("sslmode");

  const pgPool = new Pool({
    connectionString: pgConnectionUrl.toString(),
    ssl: { rejectUnauthorized: false },
  });

  try {
    await ensurePgSchema(pgPool);

    await pgPool.query("BEGIN");

    // Truncate destination tables in dependency-safe order.
    await pgPool.query('TRUNCATE TABLE "media_attachments", "rate_limit_log", "alertSubscriptions", "incidents", "users" RESTART IDENTITY CASCADE;');

    const usersCount = await copyTable(
      mysqlPool,
      pgPool,
      "SELECT id, openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn FROM users ORDER BY id",
      'INSERT INTO "users" ("id","openId","name","email","loginMethod","role","createdAt","updatedAt","lastSignedIn") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      r => [r.id, r.openId, r.name, r.email, r.loginMethod, r.role, r.createdAt, r.updatedAt, r.lastSignedIn]
    );

    const incidentsCount = await copyTable(
      mysqlPool,
      pgPool,
      "SELECT id, latitude, longitude, incidentType, severity, description, mediaUrls, reportedAt, submittedAt, ipHash, status, adminNotes, llmClassification, trackingPin, reporterAlias FROM incidents ORDER BY id",
      'INSERT INTO "incidents" ("id","latitude","longitude","incidentType","severity","description","mediaUrls","reportedAt","submittedAt","ipHash","status","adminNotes","llmClassification","trackingPin","reporterAlias") VALUES ($1,$2,$3,$4,$5,$6,$7::json,$8,$9,$10,$11,$12,$13::json,$14,$15)',
      r => [
        r.id,
        r.latitude,
        r.longitude,
        r.incidentType,
        r.severity,
        r.description,
        r.mediaUrls ? JSON.stringify(r.mediaUrls) : null,
        r.reportedAt,
        r.submittedAt,
        r.ipHash,
        r.status,
        r.adminNotes,
        r.llmClassification ? JSON.stringify(r.llmClassification) : null,
        r.trackingPin,
        r.reporterAlias,
      ]
    );

    const alertsCount = await copyTable(
      mysqlPool,
      pgPool,
      "SELECT id, email, latitude, longitude, radiusKm, createdAt FROM alertSubscriptions ORDER BY id",
      'INSERT INTO "alertSubscriptions" ("id","email","latitude","longitude","radiusKm","createdAt") VALUES ($1,$2,$3,$4,$5,$6)',
      r => [r.id, r.email, r.latitude, r.longitude, r.radiusKm, r.createdAt]
    );

    const mediaCount = await copyTable(
      mysqlPool,
      pgPool,
      "SELECT id, incidentId, s3Key, s3Url, mimeType, fileSize, uploadedAt FROM media_attachments ORDER BY id",
      'INSERT INTO "media_attachments" ("id","incidentId","s3Key","s3Url","mimeType","fileSize","uploadedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)',
      r => [r.id, r.incidentId, r.s3Key, r.s3Url, r.mimeType, r.fileSize, r.uploadedAt]
    );

    const rateLimitCount = await copyTable(
      mysqlPool,
      pgPool,
      "SELECT id, ipHash, attemptedAt, endpoint FROM rate_limit_log ORDER BY id",
      'INSERT INTO "rate_limit_log" ("id","ipHash","attemptedAt","endpoint") VALUES ($1,$2,$3,$4)',
      r => [r.id, r.ipHash, r.attemptedAt, r.endpoint]
    );

    await setSequences(pgPool);
    await pgPool.query("COMMIT");

    console.log("Migration complete");
    console.log({ usersCount, incidentsCount, alertsCount, mediaCount, rateLimitCount });
  } catch (error) {
    await pgPool.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await mysqlPool.end();
    await pgPool.end();
  }
}

main().catch(error => {
  console.error("MYSQL_TO_PG_MIGRATION_FAILED", error);
  process.exit(1);
});
