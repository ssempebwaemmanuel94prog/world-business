"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { validateMigrationTarget } = require("./migration-target");
const {
  APPROVED_MIGRATIONS,
  getPendingMigrations
} = require("./migration-plan");
const { validateAppliedHistory } = require("./migration-history");
const { bootstrapMigrationHistory } = require("./migration-bootstrap");
const { validateMigrationIntegrity } = require("./migration-integrity");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

function readApprovedMigrationFiles() {
  const files = new Map();

  for (const version of APPROVED_MIGRATIONS) {
    const filePath = path.join(MIGRATIONS_DIR, `${version}.sql`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Approved migration file is missing: ${version}`);
    }

    const sql = fs.readFileSync(filePath, "utf8");

    if (!sql.trim()) {
      throw new Error(`Approved migration file is empty: ${version}`);
    }

    files.set(version, sql);
  }

  return files;
}

async function readMigrationHistory(connection) {
  const historyTable = await connection.query(
    "SELECT to_regclass('public.schema_migrations') AS table_name"
  );

  if (!historyTable.rows[0].table_name) {
    throw new Error(
      "Migration history table is missing. Stop for independent database assessment. No migration was applied."
    );
  }

  const history = await connection.query(
    "SELECT version FROM public.schema_migrations"
  );

  const appliedVersions = history.rows.map((row) => row.version);
  validateAppliedHistory(appliedVersions);

  return appliedVersions;
}

async function main() {
  const args = process.argv.slice(2);

  if (!args.includes("--apply")) {
    throw new Error(
      "Migration not run. To apply deliberately, use --apply with --target and --confirm-target."
    );
  }

  const targetIndex = args.indexOf("--target");
  const confirmIndex = args.indexOf("--confirm-target");
  const targetName =
    targetIndex >= 0 ? args[targetIndex + 1] : undefined;
  const confirmedName =
    confirmIndex >= 0 ? args[confirmIndex + 1] : undefined;

  if (confirmedName !== targetName) {
    throw new Error(
      "Migration not run. --confirm-target must exactly match --target."
    );
  }

  const targetCheck = validateMigrationTarget({
    databaseUrl: process.env.DATABASE_URL,
    targetName,
    confirmTarget: confirmedName === targetName
  });

  if (!targetCheck.ok) {
    throw new Error(
      `Migration target rejected: ${targetCheck.reason}. No database connection was opened.`
    );
  }

  // Preflight approved SQL files before creating a connection pool.
  const migrationFiles = readApprovedMigrationFiles();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    enableChannelBinding: true
  });

  try {
    const connection = await pool.connect();

    try {
      const businessTable = await connection.query(
        "SELECT to_regclass('public.businesses') AS table_name"
      );

      if (!businessTable.rows[0].table_name) {
        throw new Error(
          "The existing businesses table was not found. No migration was applied."
        );
      }

      const bootstrapResult = await bootstrapMigrationHistory(connection);

      if (bootstrapResult.created) {
        console.log(
          "Migration history table prepared after baseline verification."
        );
      }

      let appliedVersions = await readMigrationHistory(connection);
      await validateMigrationIntegrity(connection, appliedVersions);

      let pendingMigrations = getPendingMigrations(appliedVersions);

      if (pendingMigrations.length === 0) {
        console.log("All approved migrations are already applied.");
        return;
      }

      for (const version of pendingMigrations) {
        if (!migrationFiles.has(version)) {
          throw new Error(`Approved migration SQL is unavailable: ${version}`);
        }

        console.log(`Applying migration: ${version}`);

        // Each approved SQL file controls its own transaction.
        await connection.query(migrationFiles.get(version));

        appliedVersions = await readMigrationHistory(connection);
        await validateMigrationIntegrity(connection, appliedVersions);
        console.log(`Migration applied successfully: ${version}`);

        pendingMigrations = getPendingMigrations(appliedVersions);
      }

      console.log("All approved migrations are applied.");
    } finally {
      connection.release();
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { readMigrationHistory };
