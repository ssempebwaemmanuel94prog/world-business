"use strict";

const EXPECTED_BUSINESS_COLUMNS = Object.freeze({
  id: ["bigint", "NO"],
  business_name: ["text", "NO"],
  country: ["text", "NO"],
  city: ["text", "NO"],
  category: ["text", "NO"],
  description: ["text", "NO"],
  website: ["text", "YES"],
  business_email: ["text", "YES"],
  business_phone: ["text", "YES"],
  contact_person: ["text", "YES"],
  created_at: ["timestamp with time zone", "NO"]
});

const EXPECTED_HISTORY_COLUMNS = Object.freeze({
  version: ["text", "NO"],
  applied_at: ["timestamp with time zone", "NO"]
});

async function getColumns(connection, tableName) {
  const result = await connection.query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );

  return result.rows;
}

function validateColumns(rows, expected, tableName) {
  const names = Object.keys(expected);

  if (rows.length !== names.length) {
    throw new Error(
      `Bootstrap refused: unexpected ${tableName} column count.`
    );
  }

  for (const row of rows) {
    const definition = expected[row.column_name];

    if (
      !definition ||
      row.data_type !== definition[0] ||
      row.is_nullable !== definition[1]
    ) {
      throw new Error(
        `Bootstrap refused: unexpected ${tableName} column: ${row.column_name}.`
      );
    }
  }
}

async function hasPrimaryKey(connection, tableName, expectedColumn) {
  const result = await connection.query(
    `SELECT array_agg(att.attname ORDER BY key_column.ordinality) AS columns
     FROM pg_constraint con
     JOIN pg_class tbl ON tbl.oid = con.conrelid
     JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
     JOIN LATERAL unnest(con.conkey) WITH ORDINALITY
       AS key_column(attnum, ordinality) ON TRUE
     JOIN pg_attribute att
       ON att.attrelid = tbl.oid
      AND att.attnum = key_column.attnum
     WHERE ns.nspname = 'public'
       AND tbl.relname = $1
       AND con.contype = 'p'
     GROUP BY con.oid`,
    [tableName]
  );

  return (
    result.rows.length === 1 &&
    JSON.stringify(result.rows[0].columns) ===
      JSON.stringify([expectedColumn])
  );
}

async function validateBusinessBaseline(connection) {
  const columns = await getColumns(connection, "businesses");
  validateColumns(
    columns,
    EXPECTED_BUSINESS_COLUMNS,
    "businesses"
  );

  const idColumn = columns.find(
    (column) => column.column_name === "id"
  );
  const createdAtColumn = columns.find(
    (column) => column.column_name === "created_at"
  );

  if (
    !idColumn.column_default ||
    !/^nextval\(\s*'(?:(?:public)\.)?businesses_id_seq'::regclass\s*\)$/i.test(
      idColumn.column_default.trim()
    )
  ) {
    throw new Error(
      "Bootstrap refused: businesses.id default does not reference businesses_id_seq."
    );
  }

  if (
    !createdAtColumn.column_default ||
    !/^(CURRENT_TIMESTAMP|now\(\))$/i.test(
      createdAtColumn.column_default.trim()
    )
  ) {
    throw new Error(
      "Bootstrap refused: unexpected businesses.created_at default."
    );
  }

  if (!(await hasPrimaryKey(connection, "businesses", "id"))) {
    throw new Error(
      "Bootstrap refused: businesses must have id as its sole primary key."
    );
  }

  const sequence = await connection.query(
    `SELECT pg_get_serial_sequence(
       'public.businesses',
       'id'
     ) AS sequence_name`
  );

  if (
    sequence.rows[0].sequence_name !==
    "public.businesses_id_seq"
  ) {
    throw new Error(
      "Bootstrap refused: businesses.id sequence does not match the expected baseline."
    );
  }
}

async function validateHistoryTable(connection) {
  const columns = await getColumns(connection, "schema_migrations");

  validateColumns(
    columns,
    EXPECTED_HISTORY_COLUMNS,
    "schema_migrations"
  );

  const appliedAt = columns.find(
    (column) => column.column_name === "applied_at"
  );

  if (
    !appliedAt.column_default ||
    !/^(CURRENT_TIMESTAMP|now\(\))$/i.test(
      appliedAt.column_default.trim()
    )
  ) {
    throw new Error(
      "Bootstrap refused: unexpected schema_migrations.applied_at default."
    );
  }

  if (
    !(await hasPrimaryKey(
      connection,
      "schema_migrations",
      "version"
    ))
  ) {
    throw new Error(
      "Bootstrap refused: schema_migrations must have version as its sole primary key."
    );
  }
}

async function bootstrapMigrationHistory(connection) {
  await connection.query("BEGIN");

  try {
    await connection.query(
      "SELECT pg_advisory_xact_lock(741852963)"
    );

    const tables = await connection.query(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
       ORDER BY tablename`
    );

    const tableNames = tables.rows.map((row) => row.tablename);
    const historyExists = tableNames.includes("schema_migrations");

    if (!tableNames.includes("businesses")) {
      throw new Error(
        "Bootstrap refused: businesses table is missing."
      );
    }

    if (historyExists) {
      await validateHistoryTable(connection);
      await connection.query("COMMIT");

      return { created: false };
    }

    if (tableNames.some((name) => name !== "businesses")) {
      throw new Error(
        "Bootstrap refused: unexpected public tables found."
      );
    }

    await connection.query(
      "LOCK TABLE public.businesses IN SHARE ROW EXCLUSIVE MODE"
    );

    await validateBusinessBaseline(connection);

    const countResult = await connection.query(
      "SELECT COUNT(*)::bigint AS total FROM public.businesses"
    );

    if (countResult.rows[0].total !== "0") {
      throw new Error(
        "Bootstrap refused: businesses table is not empty."
      );
    }

    await connection.query(
      `CREATE TABLE public.schema_migrations (
         version TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
       )`
    );

    await connection.query("COMMIT");

    return { created: true };
  } catch (error) {
    try {
      await connection.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }

    throw error;
  }
}

module.exports = { bootstrapMigrationHistory };
