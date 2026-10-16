require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const MIGRATION_VERSION = "001_accounts_and_spotlight";
const MIGRATION_FILE = path.join(
  __dirname,
  "..",
  "migrations",
  `${MIGRATION_VERSION}.sql`
);

async function main() {
  if (process.argv[2] !== "--apply") {
    throw new Error(
      "Migration not run. To apply it deliberately, use: node scripts/migrate.js --apply"
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. Configure it privately before running migrations."
    );
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const connection = await pool.connect();

    try {
      const businessTable = await connection.query(
        "SELECT to_regclass('public.businesses') AS table_name"
      );

      if (!businessTable.rows[0].table_name) {
        throw new Error("The existing businesses table was not found. No migration was applied.");
      }

      const result = await connection.query(
        "SELECT to_regclass('public.schema_migrations') AS table_name"
      );

      if (result.rows[0].table_name) {
        const existing = await connection.query(
          "SELECT version FROM schema_migrations WHERE version = $1",
          [MIGRATION_VERSION]
        );

        if (existing.rowCount > 0) {
          console.log(`Migration already applied: ${MIGRATION_VERSION}`);
          return;
        }
      }

      const sql = fs.readFileSync(MIGRATION_FILE, "utf8");

      console.log(`Applying migration: ${MIGRATION_VERSION}`);

      await connection.query(sql);

      console.log(`Migration applied successfully: ${MIGRATION_VERSION}`);
    } finally {
      connection.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
});
