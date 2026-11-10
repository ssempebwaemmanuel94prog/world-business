"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  bootstrapMigrationHistory
} = require("../scripts/migration-bootstrap");

const businessColumns = [
  ["id", "bigint", "NO", "nextval('businesses_id_seq'::regclass)"],
  ["business_name", "text", "NO", null],
  ["country", "text", "NO", null],
  ["city", "text", "NO", null],
  ["category", "text", "NO", null],
  ["description", "text", "NO", null],
  ["website", "text", "YES", null],
  ["business_email", "text", "YES", null],
  ["business_phone", "text", "YES", null],
  ["contact_person", "text", "YES", null],
  ["created_at", "timestamp with time zone", "NO", "CURRENT_TIMESTAMP"]
].map(([column_name, data_type, is_nullable, column_default]) => ({
  column_name,
  data_type,
  is_nullable,
  column_default
}));

const historyColumns = [
  {
    column_name: "version",
    data_type: "text",
    is_nullable: "NO",
    column_default: null
  },
  {
    column_name: "applied_at",
    data_type: "timestamp with time zone",
    is_nullable: "NO",
    column_default: "CURRENT_TIMESTAMP"
  }
];

function makeConnection(options = {}) {
  const queries = [];
  const tables = options.tables || ["businesses"];
  const columns = options.businessColumns || businessColumns;
  const history = options.historyColumns || historyColumns;
  const appliedVersions = options.appliedVersions || [];
  const tableColumns = options.tableColumns || {};

  const connection = {
    queries,

    async query(sql, params = []) {
      const normalized = sql.trim().replace(/\s+/g, " ");
      queries.push({ sql: normalized, params });

      if (normalized === "ROLLBACK" && options.failRollback) {
        throw new Error("Simulated rollback failure");
      }

      if (options.failOn && normalized.startsWith(options.failOn)) {
        throw new Error(options.failureMessage || "Simulated database failure");
      }

      if (/FROM\\s+(?:public\\.)?schema_migrations/i.test(normalized) &&
          /SELECT\\s+version/i.test(normalized)) {
        return {
          rows: appliedVersions.map((version) => ({ version }))
        };
      }

      if (normalized === "BEGIN" ||
          normalized === "COMMIT" ||
          normalized === "ROLLBACK" ||
          normalized.startsWith("SELECT pg_advisory_xact_lock") ||
          normalized.startsWith("LOCK TABLE") ||
          normalized.startsWith("CREATE TABLE")) {
        return { rows: [] };
      }

      if (normalized.includes("FROM pg_tables")) {
        return {
          rows: tables.map((tablename) => ({ tablename }))
        };
      }

      if (normalized.includes("FROM information_schema.columns")) {
        const tableName = params[0];

        return {
          rows: tableColumns[tableName] ||
            (tableName === "businesses" ? columns : history)
        };
      }

      if (normalized.includes("FROM pg_constraint")) {
        const expected = params[0] === "businesses" ? "id" : "version";
        return {
          rows: (
            options.badPrimaryKey ||
            (options.badHistoryPrimaryKey && params[0] === "schema_migrations")
          )
            ? [{ columns: ["wrong_column"] }]
            : [{ columns: [expected] }]
        };
      }

      if (normalized.includes("pg_get_serial_sequence")) {
        return {
          rows: [{
            sequence_name: options.badSequence
              ? "public.wrong_sequence"
              : "public.businesses_id_seq"
          }]
        };
      }

      if (normalized.startsWith("SELECT COUNT(*)")) {
        return {
          rows: [{ total: options.businessCount ?? "0" }]
        };
      }

      throw new Error(`Unexpected test query: ${normalized}`);
    }
  };

  return connection;
}

test("creates migration history for a valid empty baseline", async () => {
  const connection = makeConnection();

  assert.deepEqual(
    await bootstrapMigrationHistory(connection),
    { created: true }
  );

  assert.ok(
    connection.queries.some((query) =>
      query.sql.includes("LOCK TABLE public.businesses IN SHARE ROW EXCLUSIVE MODE")
    )
  );
  assert.ok(
    connection.queries.some((query) =>
      query.sql.startsWith("CREATE TABLE public.schema_migrations")
    )
  );
  assert.equal(
    connection.queries.at(-1).sql,
    "COMMIT"
  );
});

test("accepts an existing valid migration history table", async () => {
  const connection = makeConnection({
    tables: [
      "businesses",
      "schema_migrations",
      "users",
      "business_claims",
      "business_memberships",
      "spotlight_ads",
      "spotlight_ad_images",
      "spotlight_ad_events"
    ]
  });

  assert.deepEqual(
    await bootstrapMigrationHistory(connection),
    { created: false }
  );

  assert.equal(
    connection.queries.some((query) =>
      query.sql.startsWith("CREATE TABLE public.schema_migrations")
    ),
    false
  );
  assert.equal(connection.queries.at(-1).sql, "COMMIT");
});

test("refuses unexpected public tables and rolls back", async () => {
  const connection = makeConnection({
    tables: ["businesses", "unexpected_table"]
  });

  await assert.rejects(
    bootstrapMigrationHistory(connection),
    /unexpected public tables/
  );

  assert.equal(connection.queries.at(-1).sql, "ROLLBACK");
  assert.equal(
    connection.queries.some((query) =>
      query.sql.startsWith("CREATE TABLE public.schema_migrations")
    ),
    false
  );
});

test("refuses to bootstrap when businesses contains records", async () => {
  const connection = makeConnection({
    businessCount: "1"
  });

  await assert.rejects(
    bootstrapMigrationHistory(connection),
    /businesses table is not empty/
  );

  assert.equal(connection.queries.at(-1).sql, "ROLLBACK");
});

test("refuses an unexpected businesses column and rolls back", async () => {
  const connection = makeConnection({
    businessColumns: businessColumns.slice(1)
  });

  await assert.rejects(
    bootstrapMigrationHistory(connection),
    /unexpected businesses column count/
  );

  assert.equal(connection.queries.at(-1).sql, "ROLLBACK");
});

test("refuses an unexpected businesses primary key and rolls back", async () => {
  const connection = makeConnection({
    badPrimaryKey: true
  });

  await assert.rejects(
    bootstrapMigrationHistory(connection),
    /businesses must have id as its sole primary key/
  );

  assert.equal(connection.queries.at(-1).sql, "ROLLBACK");
});

test("refuses an unexpected businesses sequence and rolls back", async () => {
  const connection = makeConnection({
    badSequence: true
  });

  await assert.rejects(
    bootstrapMigrationHistory(connection),
    /sequence does not match/
  );

  assert.equal(connection.queries.at(-1).sql, "ROLLBACK");
});


test("refuses an businesses ID default referencing the wrong sequence", async () => {
  const columns = businessColumns.map((column) =>
    column.column_name === "id"
      ? { ...column, column_default: "nextval('wrong_sequence'::regclass)" }
      : column
  );
  const connection = makeConnection({ businessColumns: columns });

  await assert.rejects(
    bootstrapMigrationHistory(connection),
    /businesses.id default does not reference businesses_id_seq/
  );

  assert.equal(connection.queries.at(-1).sql, "ROLLBACK");
});

test("refuses an unexpected businesses created_at default", async () => {
  const columns = businessColumns.map((column) =>
    column.column_name === "created_at"
      ? { ...column, column_default: "now() + interval '1 day'" }
      : column
  );
  const connection = makeConnection({ businessColumns: columns });

  await assert.rejects(
    bootstrapMigrationHistory(connection),
    /unexpected businesses.created_at default/
  );

  assert.equal(connection.queries.at(-1).sql, "ROLLBACK");
});

test("refuses an unexpected schema_migrations applied_at default", async () => {
  const columns = historyColumns.map((column) =>
    column.column_name === "applied_at"
      ? { ...column, column_default: "now() + interval '1 day'" }
      : column
  );
  const connection = makeConnection({
    tables: ["businesses", "schema_migrations"],
    historyColumns: columns
  });

  await assert.rejects(
    bootstrapMigrationHistory(connection),
    /unexpected schema_migrations.applied_at default/
  );

  assert.equal(connection.queries.at(-1).sql, "ROLLBACK");
});

test("refuses an unexpected schema_migrations primary key", async () => {
  const connection = makeConnection({
    tables: ["businesses", "schema_migrations"],
    badHistoryPrimaryKey: true
  });

  await assert.rejects(
    bootstrapMigrationHistory(connection),
    /schema_migrations must have version as its sole primary key/
  );

  assert.equal(connection.queries.at(-1).sql, "ROLLBACK");
});

test("rolls back and preserves the original database error", async () => {
  const connection = makeConnection({
    failOn: "SELECT pg_advisory_xact_lock",
    failRollback: true,
    failureMessage: "Original advisory-lock failure"
  });

  await assert.rejects(
    bootstrapMigrationHistory(connection),
    /^Error: Original advisory-lock failure$/
  );

  assert.equal(connection.queries.at(-1).sql, "ROLLBACK");
});

test("refuses a malformed existing migration history table", async () => {
  const connection = makeConnection({
    tables: ["businesses", "schema_migrations"],
    historyColumns: historyColumns.slice(1)
  });

  await assert.rejects(
    bootstrapMigrationHistory(connection),
    /unexpected schema_migrations column count/
  );

  assert.equal(connection.queries.at(-1).sql, "ROLLBACK");
});
