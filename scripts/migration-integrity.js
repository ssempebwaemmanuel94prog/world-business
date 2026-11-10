"use strict";

const { validateAppliedHistory } = require("./migration-history");

const MIGRATION_001 = "001_accounts_and_spotlight";
const MIGRATION_002 = "002_business_listing_moderation";

const TABLES_001 = Object.freeze({
  users: {
    id: ["bigint", "NO", "nextval('users_id_seq'::regclass)"],
    email: ["text", "NO", null],
    password_hash: ["text", "NO", null],
    role: ["text", "NO", "'business_owner'::text"],
    email_verified_at: ["timestamp with time zone", "YES", null],
    is_active: ["boolean", "NO", "true"],
    created_at: ["timestamp with time zone", "NO", "CURRENT_TIMESTAMP"],
    updated_at: ["timestamp with time zone", "NO", "CURRENT_TIMESTAMP"]
  },
  business_claims: {
    id: ["bigint", "NO", "nextval('business_claims_id_seq'::regclass)"],
    business_id: ["bigint", "NO", null],
    user_id: ["bigint", "NO", null],
    verification_method: ["text", "YES", null],
    verification_notes: ["text", "YES", null],
    status: ["text", "NO", "'pending'::text"],
    reviewed_by: ["bigint", "YES", null],
    reviewed_at: ["timestamp with time zone", "YES", null],
    created_at: ["timestamp with time zone", "NO", "CURRENT_TIMESTAMP"]
  },
  business_memberships: {
    id: ["bigint", "NO", "nextval('business_memberships_id_seq'::regclass)"],
    business_id: ["bigint", "NO", null],
    user_id: ["bigint", "NO", null],
    membership_role: ["text", "NO", "'owner'::text"],
    verified_at: ["timestamp with time zone", "NO", "CURRENT_TIMESTAMP"],
    created_at: ["timestamp with time zone", "NO", "CURRENT_TIMESTAMP"]
  },
  spotlight_ads: {
    id: ["bigint", "NO", "nextval('spotlight_ads_id_seq'::regclass)"],
    business_id: ["bigint", "NO", null],
    submitted_by: ["bigint", "NO", null],
    title: ["text", "NO", null],
    description: ["text", "NO", null],
    offer_price: ["numeric", "YES", null],
    original_price: ["numeric", "YES", null],
    currency: ["character", "YES", null],
    country: ["text", "NO", null],
    city: ["text", "NO", null],
    terms: ["text", "YES", null],
    contact_phone: ["text", "YES", null],
    contact_email: ["text", "YES", null],
    website: ["text", "YES", null],
    status: ["text", "NO", "'pending_review'::text"],
    starts_at: ["timestamp with time zone", "YES", null],
    ends_at: ["timestamp with time zone", "YES", null],
    reviewed_by: ["bigint", "YES", null],
    reviewed_at: ["timestamp with time zone", "YES", null],
    review_notes: ["text", "YES", null],
    created_at: ["timestamp with time zone", "NO", "CURRENT_TIMESTAMP"],
    updated_at: ["timestamp with time zone", "NO", "CURRENT_TIMESTAMP"]
  },
  spotlight_ad_images: {
    id: ["bigint", "NO", "nextval('spotlight_ad_images_id_seq'::regclass)"],
    ad_id: ["bigint", "NO", null],
    image_url: ["text", "NO", null],
    alt_text: ["text", "YES", null],
    display_order: ["integer", "NO", "0"],
    created_at: ["timestamp with time zone", "NO", "CURRENT_TIMESTAMP"]
  },
  spotlight_ad_events: {
    id: ["bigint", "NO", "nextval('spotlight_ad_events_id_seq'::regclass)"],
    ad_id: ["bigint", "NO", null],
    event_type: ["text", "NO", null],
    created_at: ["timestamp with time zone", "NO", "CURRENT_TIMESTAMP"]
  }
});

const MIGRATION_002_COLUMNS = Object.freeze({
  listing_status: ["text", "NO", "'pending_review'::text"],
  reviewed_by: ["bigint", "YES", null],
  reviewed_at: ["timestamp with time zone", "YES", null],
  review_notes: ["text", "YES", null],
  business_email_public: ["boolean", "NO", "false"],
  business_phone_public: ["boolean", "NO", "false"],
  business_email_consent_at: ["timestamp with time zone", "YES", null],
  business_phone_consent_at: ["timestamp with time zone", "YES", null]
});

const CHECKS_001 = [
  ["users", "users_role_check", "role", "CHECK (role IN ('business_owner', 'admin'))"],
  ["business_claims", "business_claims_status_check", "status", "CHECK (status IN ('pending', 'approved', 'rejected'))"],
  ["business_memberships", "business_memberships_membership_role_check", "membership_role", "CHECK (membership_role IN ('owner', 'manager'))"],
  ["spotlight_ads", "spotlight_ads_status_check", "status", "CHECK (status IN ('pending_review', 'changes_requested', 'rejected', 'approved', 'scheduled', 'active', 'expired', 'removed'))"],
  ["spotlight_ads", "spotlight_ads_check", "offer_price", "CHECK (offer_price IS NULL OR offer_price >= 0)"],
  ["spotlight_ads", "spotlight_ads_check1", "original_price", "CHECK (original_price IS NULL OR original_price >= 0)"],
  ["spotlight_ads", "spotlight_ads_check2", "offer_price", "CHECK (offer_price IS NULL OR original_price IS NULL OR offer_price <= original_price)"],
  ["spotlight_ads", "spotlight_ads_check3", "ends_at", "CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)"],
  ["spotlight_ad_images", "spotlight_ad_images_display_order_check", "display_order", "CHECK (display_order >= 0)"],
  ["spotlight_ad_events", "spotlight_ad_events_event_type_check", "event_type", "CHECK (event_type IN ('view', 'offer_click', 'contact_click'))"]
];

const FOREIGN_KEYS_001 = [
  ["business_claims", "business_claims_business_id_fkey", "business_id", "businesses", "a"],
  ["business_claims", "business_claims_user_id_fkey", "user_id", "users", "a"],
  ["business_claims", "business_claims_reviewed_by_fkey", "reviewed_by", "users", "a"],
  ["business_memberships", "business_memberships_business_id_fkey", "business_id", "businesses", "a"],
  ["business_memberships", "business_memberships_user_id_fkey", "user_id", "users", "a"],
  ["spotlight_ads", "spotlight_ads_business_id_fkey", "business_id", "businesses", "a"],
  ["spotlight_ads", "spotlight_ads_submitted_by_fkey", "submitted_by", "users", "a"],
  ["spotlight_ads", "spotlight_ads_reviewed_by_fkey", "reviewed_by", "users", "a"],
  ["spotlight_ad_images", "spotlight_ad_images_ad_id_fkey", "ad_id", "spotlight_ads", "c"],
  ["spotlight_ad_events", "spotlight_ad_events_ad_id_fkey", "ad_id", "spotlight_ads", "c"]
];

const INDEXES_001 = [
  ["idx_business_claims_user_status", "business_claims", "user_id, status"],
  ["idx_business_claims_business_status", "business_claims", "business_id, status"],
  ["idx_business_memberships_user", "business_memberships", "user_id"],
  ["idx_spotlight_ads_business_created", "spotlight_ads", "business_id, created_at"],
  ["idx_spotlight_ads_publication", "spotlight_ads", "status, starts_at, ends_at"],
  ["idx_spotlight_ad_images_order", "spotlight_ad_images", "ad_id, display_order"],
  ["idx_spotlight_ad_events_ad_type", "spotlight_ad_events", "ad_id, event_type, created_at"]
];

const CHECKS_002 = [
  [
    "businesses_listing_status_check",
    ["listing_status"],
    "CHECK (listing_status IN ('pending_review', 'approved', 'rejected'))"
  ],
  [
    "businesses_review_metadata_check",
    ["listing_status", "reviewed_by", "reviewed_at"],
    "CHECK ((listing_status = 'pending_review' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR (listing_status IN ('approved', 'rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))"
  ],
  [
    "businesses_email_consent_check",
    ["business_email_public", "business_email", "business_email_consent_at"],
    "CHECK (NOT business_email_public OR (business_email IS NOT NULL AND business_email_consent_at IS NOT NULL))"
  ],
  [
    "businesses_phone_consent_check",
    ["business_phone_public", "business_phone", "business_phone_consent_at"],
    "CHECK (NOT business_phone_public OR (business_phone IS NOT NULL AND business_phone_consent_at IS NOT NULL))"
  ]
];

const INDEX_002 = [
  "idx_businesses_listing_status",
  "businesses",
  "listing_status, created_at DESC"
];

function fail(message) {
  throw new Error(`Migration integrity check failed: ${message}`);
}

function hasRedundantOuterParentheses(expression) {
  if (
    expression.length < 2 ||
    expression[0] !== "(" ||
    expression[expression.length - 1] !== ")"
  ) {
    return false;
  }

  let depth = 0;
  let inString = false;

  for (let i = 0; i < expression.length; i += 1) {
    const character = expression[i];

    if (character === "'") {
      if (inString && expression[i + 1] === "'") {
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;

    if (depth < 0) return false;
    if (depth === 0 && i < expression.length - 1) return false;
  }

  return depth === 0 && !inString;
}

function normalizeCheckDefinition(value) {
  let expression = String(value || "")
    .toLowerCase()
    .replace(/^check\s*/i, "")
    .replace(/::(?:text|character varying)\b/g, "")
    .replace(/=\s*any\s*\(\s*array\s*\[/g, " in (")
    .replace(/\]\s*\)/g, ")")
    .replace(/["`\s]/g, "");

  while (hasRedundantOuterParentheses(expression)) {
    expression = expression.slice(1, -1);
  }

  return expression;
}

function normalizeColumns(columns) {
  return Array.isArray(columns) ? columns : [];
}

function sameArray(actual, expected) {
  return JSON.stringify(normalizeColumns(actual)) === JSON.stringify(expected);
}

function normalizeIndexColumns(definition) {
  const match = String(definition || "").match(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$/);
  if (!match) return null;

  return match[1]
    .split(",")
    .map((column) => column.trim().replace(/"/g, "").replace(/\s+/g, " ").toLowerCase());
}

function validateIndex(indexRows, [name, table, expectedColumns]) {
  const index = indexRows.find((row) => row.index_name === name);

  if (!index || index.table_name !== table) {
    fail(`${table} index ${name} is missing or belongs to the wrong table.`);
  }

  const actualColumns = normalizeIndexColumns(index.index_definition);
  const expected = expectedColumns.split(",").map((column) => column.trim().toLowerCase());

  if (!actualColumns || !sameArray(actualColumns, expected)) {
    fail(`${table} index ${name} has incorrect columns or ordering.`);
  }
}

function validateColumnRows(table, rows, expectedDefinitions) {
  const byName = new Map(rows.map((row) => [row.column_name, row]));

  for (const [column, expected] of Object.entries(expectedDefinitions)) {
    const actual = byName.get(column);

    if (!actual) {
      fail(`${table}.${column} column is missing.`);
    }

    if (
      actual.data_type !== expected[0] ||
      actual.is_nullable !== expected[1] ||
      actual.column_default !== expected[2]
    ) {
      fail(`${table}.${column} has an incorrect type, nullability, or default.`);
    }
  }
}

function validatePrimaryKeys(constraints, tables) {
  for (const table of tables) {
    const primaryKey = constraints.find(
      (row) =>
        row.table_name === table &&
        row.constraint_type === "p" &&
        row.constraint_name === `${table}_pkey`
    );

    if (!primaryKey || !sameArray(primaryKey.columns, ["id"])) {
      fail(`${table} primary key is missing or incorrect.`);
    }
  }
}

function validateUniqueConstraints(constraints) {
  const expected = [
    ["users", "users_email_key", ["email"]],
    [
      "business_memberships",
      "business_memberships_business_id_user_id_key",
      ["business_id", "user_id"]
    ]
  ];

  for (const [table, name, columns] of expected) {
    const constraint = constraints.find(
      (row) =>
        row.table_name === table &&
        row.constraint_name === name &&
        row.constraint_type === "u"
    );

    if (!constraint || !sameArray(constraint.columns, columns)) {
      fail(`${table} unique constraint ${name} is missing or incorrect.`);
    }
  }
}

function validateForeignKeys(constraints, definitions) {
  for (const [table, name, column, referencedTable, deleteAction] of definitions) {
    const constraint = constraints.find(
      (row) =>
        row.table_name === table &&
        row.constraint_name === name &&
        row.constraint_type === "f"
    );

    if (
      !constraint ||
      !sameArray(constraint.columns, [column]) ||
      constraint.referenced_table !== referencedTable ||
      !sameArray(constraint.referenced_columns, ["id"]) ||
      constraint.delete_action !== deleteAction
    ) {
      fail(`${table} foreign key ${column} has an incorrect reference or delete action.`);
    }
  }
}

function validateCheckConstraints(constraints, definitions) {
  for (const [table, name, column, expectedDefinition] of definitions) {
    const constraint = constraints.find(
      (row) =>
        row.table_name === table &&
        row.constraint_name === name &&
        row.constraint_type === "c"
    );

    if (
      !constraint ||
      !normalizeColumns(constraint.columns).includes(column) ||
      normalizeCheckDefinition(constraint.definition) !==
        normalizeCheckDefinition(expectedDefinition)
    ) {
      fail(`${table}.${column} CHECK constraint ${name} is missing or incorrect.`);
    }
  }
}

async function getColumns(connection, table) {
  const result = await connection.query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );

  return result.rows;
}

async function validateMigration001(connection, tableNames) {
  const requiredTables = Object.keys(TABLES_001);

  for (const table of requiredTables) {
    if (!tableNames.has(table)) {
      fail(`public.${table} table is missing.`);
    }

    const columns = await getColumns(connection, table);
    validateColumnRows(table, columns, TABLES_001[table]);
  }

  const constraintResult = await connection.query(
    `SELECT tbl.relname AS table_name,
            con.conname AS constraint_name,
            con.contype AS constraint_type,
            COALESCE(
              array_agg(att.attname ORDER BY key_column.ordinality)
                FILTER (WHERE key_column.attnum IS NOT NULL),
              ARRAY[]::text[]
            ) AS columns,
            ref_tbl.relname AS referenced_table,
            COALESCE(
              array_agg(ref_att.attname ORDER BY key_column.ordinality)
                FILTER (WHERE ref_att.attname IS NOT NULL),
              ARRAY[]::text[]
            ) AS referenced_columns,
            con.confdeltype AS delete_action,
            pg_get_constraintdef(con.oid, true) AS definition
     FROM pg_constraint con
     JOIN pg_class tbl ON tbl.oid = con.conrelid
     JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
     LEFT JOIN LATERAL unnest(con.conkey) WITH ORDINALITY
       AS key_column(attnum, ordinality) ON TRUE
     LEFT JOIN pg_attribute att
       ON att.attrelid = tbl.oid AND att.attnum = key_column.attnum
     LEFT JOIN pg_class ref_tbl ON ref_tbl.oid = con.confrelid
     LEFT JOIN LATERAL unnest(con.confkey) WITH ORDINALITY
       AS ref_key(attnum, ordinality)
       ON ref_key.ordinality = key_column.ordinality
     LEFT JOIN pg_attribute ref_att
       ON ref_att.attrelid = ref_tbl.oid AND ref_att.attnum = ref_key.attnum
     WHERE ns.nspname = 'public'
     GROUP BY tbl.relname, con.oid, ref_tbl.relname`
  );

  const constraints = constraintResult.rows;

  validatePrimaryKeys(constraints, requiredTables);
  validateUniqueConstraints(constraints);
  validateForeignKeys(constraints, FOREIGN_KEYS_001);
  validateCheckConstraints(constraints, CHECKS_001);

  const indexResult = await connection.query(
    `SELECT indexname AS index_name,
            tablename AS table_name,
            indexdef AS index_definition
     FROM pg_indexes
     WHERE schemaname = 'public'`
  );

  for (const definition of INDEXES_001) {
    validateIndex(indexResult.rows, definition);
  }
}

async function validateMigration002(connection, tableNames) {
  if (!tableNames.has("businesses")) {
    fail("public.businesses table is missing for migration 002.");
  }

  const columns = await getColumns(connection, "businesses");
  validateColumnRows("businesses", columns, MIGRATION_002_COLUMNS);

  const constraintResult = await connection.query(
    `SELECT tbl.relname AS table_name,
            con.conname AS constraint_name,
            con.contype AS constraint_type,
            COALESCE(
              array_agg(att.attname ORDER BY key_column.ordinality)
                FILTER (WHERE key_column.attnum IS NOT NULL),
              ARRAY[]::text[]
            ) AS columns,
            ref_tbl.relname AS referenced_table,
            COALESCE(
              array_agg(ref_att.attname ORDER BY key_column.ordinality)
                FILTER (WHERE ref_att.attname IS NOT NULL),
              ARRAY[]::text[]
            ) AS referenced_columns,
            con.confdeltype AS delete_action,
            pg_get_constraintdef(con.oid, true) AS definition
     FROM pg_constraint con
     JOIN pg_class tbl ON tbl.oid = con.conrelid
     JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
     LEFT JOIN LATERAL unnest(con.conkey) WITH ORDINALITY
       AS key_column(attnum, ordinality) ON TRUE
     LEFT JOIN pg_attribute att
       ON att.attrelid = tbl.oid AND att.attnum = key_column.attnum
     LEFT JOIN pg_class ref_tbl ON ref_tbl.oid = con.confrelid
     LEFT JOIN LATERAL unnest(con.confkey) WITH ORDINALITY
       AS ref_key(attnum, ordinality)
       ON ref_key.ordinality = key_column.ordinality
     LEFT JOIN pg_attribute ref_att
       ON ref_att.attrelid = ref_tbl.oid AND ref_att.attnum = ref_key.attnum
     WHERE ns.nspname = 'public' AND tbl.relname = 'businesses'
     GROUP BY tbl.relname, con.oid, ref_tbl.relname`
  );

  const constraints = constraintResult.rows;

  validateCheckConstraints(
    constraints,
    CHECKS_002.map(([name, columns, definition]) => [
      "businesses",
      name,
      columns[0],
      definition
    ])
  );

  const reviewForeignKey = constraints.find(
    (row) =>
      row.table_name === "businesses" &&
      row.constraint_name === "businesses_reviewed_by_fkey" &&
      row.constraint_type === "f"
  );

  if (
    !reviewForeignKey ||
    !sameArray(reviewForeignKey.columns, ["reviewed_by"]) ||
    reviewForeignKey.referenced_table !== "users" ||
    !sameArray(reviewForeignKey.referenced_columns, ["id"]) ||
    reviewForeignKey.delete_action !== "a"
  ) {
    fail("businesses.reviewed_by foreign key is missing or incorrect.");
  }

  const indexResult = await connection.query(
    `SELECT indexname AS index_name,
            tablename AS table_name,
            indexdef AS index_definition
     FROM pg_indexes
     WHERE schemaname = 'public'`
  );

  validateIndex(indexResult.rows, INDEX_002);
}

async function validateMigrationIntegrity(connection, appliedVersions) {
  if (!connection || typeof connection.query !== "function") {
    throw new TypeError("A database connection with a query method is required.");
  }

  validateAppliedHistory(appliedVersions);

  if (appliedVersions.length === 0) {
    return true;
  }

  const tableResult = await connection.query(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = 'public'
     ORDER BY tablename`
  );

  const tableNames = new Set(tableResult.rows.map((row) => row.tablename));

  if (appliedVersions.includes(MIGRATION_001)) {
    await validateMigration001(connection, tableNames);
  }

  if (appliedVersions.includes(MIGRATION_002)) {
    await validateMigration002(connection, tableNames);
  }

  return true;
}

module.exports = { validateMigrationIntegrity };
