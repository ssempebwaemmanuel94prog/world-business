"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateMigrationIntegrity
} = require("../scripts/migration-integrity");

const requiredTables = [
  "users",
  "business_claims",
  "business_memberships",
  "spotlight_ads",
  "spotlight_ad_images",
  "spotlight_ad_events"
];

const expectedColumns = {
  users: [
    "id",
    "email",
    "password_hash",
    "role",
    "email_verified_at",
    "is_active",
    "created_at",
    "updated_at"
  ],
  business_claims: [
    "id",
    "business_id",
    "user_id",
    "verification_method",
    "verification_notes",
    "status",
    "reviewed_by",
    "reviewed_at",
    "created_at"
  ],
  business_memberships: [
    "id",
    "business_id",
    "user_id",
    "membership_role",
    "verified_at",
    "created_at"
  ],
  spotlight_ads: [
    "id",
    "business_id",
    "submitted_by",
    "title",
    "description",
    "offer_price",
    "original_price",
    "currency",
    "country",
    "city",
    "terms",
    "contact_phone",
    "contact_email",
    "website",
    "status",
    "starts_at",
    "ends_at",
    "reviewed_by",
    "reviewed_at",
    "review_notes",
    "created_at",
    "updated_at"
  ],
  spotlight_ad_images: [
    "id",
    "ad_id",
    "image_url",
    "alt_text",
    "display_order",
    "created_at"
  ],
  spotlight_ad_events: [
    "id",
    "ad_id",
    "event_type",
    "created_at"
  ]
};


const migration002Columns = [
  "listing_status",
  "reviewed_by",
  "reviewed_at",
  "review_notes",
  "business_email_public",
  "business_phone_public",
  "business_email_consent_at",
  "business_phone_consent_at"
];

const migration002ColumnDefinitions = {
  listing_status: ["text", "NO", "'pending_review'::text"],
  reviewed_by: ["bigint", "YES", null],
  reviewed_at: ["timestamp with time zone", "YES", null],
  review_notes: ["text", "YES", null],
  business_email_public: ["boolean", "NO", "false"],
  business_phone_public: ["boolean", "NO", "false"],
  business_email_consent_at: ["timestamp with time zone", "YES", null],
  business_phone_consent_at: ["timestamp with time zone", "YES", null]
};

const expectedColumnDefinitions = {
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
};


const expectedConstraints = [
  ...[
    "users",
    "business_claims",
    "business_memberships",
    "spotlight_ads",
    "spotlight_ad_images",
    "spotlight_ad_events"
  ].map((table_name) => ({
    table_name,
    constraint_name: `${table_name}_pkey`,
    constraint_type: "p",
    columns: ["id"],
    referenced_table: null,
    referenced_columns: [],
    delete_action: null,
    definition: "PRIMARY KEY (id)"
  })),

  {
    table_name: "users",
    constraint_name: "users_email_key",
    constraint_type: "u",
    columns: ["email"],
    definition: "UNIQUE (email)"
  },
  {
    table_name: "business_memberships",
    constraint_name: "business_memberships_business_id_user_id_key",
    constraint_type: "u",
    columns: ["business_id", "user_id"],
    definition: "UNIQUE (business_id, user_id)"
  },

  ...[
    ["business_claims", "business_id", "businesses", "a"],
    ["business_claims", "user_id", "users", "a"],
    ["business_claims", "reviewed_by", "users", "a"],
    ["business_memberships", "business_id", "businesses", "a"],
    ["business_memberships", "user_id", "users", "a"],
    ["spotlight_ads", "business_id", "businesses", "a"],
    ["spotlight_ads", "submitted_by", "users", "a"],
    ["spotlight_ads", "reviewed_by", "users", "a"],
    ["spotlight_ad_images", "ad_id", "spotlight_ads", "c"],
    ["spotlight_ad_events", "ad_id", "spotlight_ads", "c"]
  ].map(([table_name, column, referenced_table, delete_action]) => ({
    table_name,
    constraint_name: `${table_name}_${column}_fkey`,
    constraint_type: "f",
    columns: [column],
    referenced_table,
    referenced_columns: ["id"],
    delete_action,
    definition: `FOREIGN KEY (${column}) REFERENCES ${referenced_table}(id)`
  })),

  ...[
    {
      table_name: "users",
      constraint_name: "users_role_check",
      column: "role",
      definition: "CHECK (role IN ('business_owner', 'admin'))"
    },
    {
      table_name: "business_claims",
      constraint_name: "business_claims_status_check",
      column: "status",
      definition: "CHECK (status IN ('pending', 'approved', 'rejected'))"
    },
    {
      table_name: "business_memberships",
      constraint_name: "business_memberships_membership_role_check",
      column: "membership_role",
      definition: "CHECK (membership_role IN ('owner', 'manager'))"
    },
    {
      table_name: "spotlight_ads",
      constraint_name: "spotlight_ads_status_check",
      column: "status",
      definition: "CHECK (status IN ('pending_review', 'changes_requested', 'rejected', 'approved', 'scheduled', 'active', 'expired', 'removed'))"
    },
    {
      table_name: "spotlight_ads",
      constraint_name: "spotlight_ads_check",
      column: "offer_price",
      definition: "CHECK (offer_price IS NULL OR offer_price >= 0)"
    },
    {
      table_name: "spotlight_ads",
      constraint_name: "spotlight_ads_check1",
      column: "original_price",
      definition: "CHECK (original_price IS NULL OR original_price >= 0)"
    },
    {
      table_name: "spotlight_ads",
      constraint_name: "spotlight_ads_check2",
      column: "offer_price",
      definition: "CHECK (offer_price IS NULL OR original_price IS NULL OR offer_price <= original_price)"
    },
    {
      table_name: "spotlight_ads",
      constraint_name: "spotlight_ads_check3",
      column: "ends_at",
      definition: "CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)"
    },
    {
      table_name: "spotlight_ad_images",
      constraint_name: "spotlight_ad_images_display_order_check",
      column: "display_order",
      definition: "CHECK (display_order >= 0)"
    },
    {
      table_name: "spotlight_ad_events",
      constraint_name: "spotlight_ad_events_event_type_check",
      column: "event_type",
      definition: "CHECK (event_type IN ('view', 'offer_click', 'contact_click'))"
    }
  ].map(({ table_name, constraint_name, column, definition }) => ({
    table_name,
    constraint_name,
    constraint_type: "c",
    columns: [column],
    definition
  }))
];

const expectedIndexes = [
  ["idx_business_claims_user_status", "business_claims", "user_id, status"],
  ["idx_business_claims_business_status", "business_claims", "business_id, status"],
  ["idx_business_memberships_user", "business_memberships", "user_id"],
  ["idx_spotlight_ads_business_created", "spotlight_ads", "business_id, created_at"],
  ["idx_spotlight_ads_publication", "spotlight_ads", "status, starts_at, ends_at"],
  ["idx_spotlight_ad_images_order", "spotlight_ad_images", "ad_id, display_order"],
  ["idx_spotlight_ad_events_ad_type", "spotlight_ad_events", "ad_id, event_type, created_at"]
].map(([index_name, table_name, columns]) => ({
  index_name,
  table_name,
  index_definition: `CREATE INDEX ${index_name} ON public.${table_name} (${columns})`
}));


const migration002Constraints = [
  {
    table_name: "businesses",
    constraint_name: "businesses_listing_status_check",
    constraint_type: "c",
    columns: ["listing_status"],
    definition: "CHECK (listing_status IN ('pending_review', 'approved', 'rejected'))"
  },
  {
    table_name: "businesses",
    constraint_name: "businesses_review_metadata_check",
    constraint_type: "c",
    columns: ["listing_status", "reviewed_by", "reviewed_at"],
    definition: "CHECK ((listing_status = 'pending_review' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR (listing_status IN ('approved', 'rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))"
  },
  {
    table_name: "businesses",
    constraint_name: "businesses_email_consent_check",
    constraint_type: "c",
    columns: ["business_email_public", "business_email", "business_email_consent_at"],
    definition: "CHECK (NOT business_email_public OR (business_email IS NOT NULL AND business_email_consent_at IS NOT NULL))"
  },
  {
    table_name: "businesses",
    constraint_name: "businesses_phone_consent_check",
    constraint_type: "c",
    columns: ["business_phone_public", "business_phone", "business_phone_consent_at"],
    definition: "CHECK (NOT business_phone_public OR (business_phone IS NOT NULL AND business_phone_consent_at IS NOT NULL))"
  },
  {
    table_name: "businesses",
    constraint_name: "businesses_reviewed_by_fkey",
    constraint_type: "f",
    columns: ["reviewed_by"],
    referenced_table: "users",
    referenced_columns: ["id"],
    delete_action: "a",
    definition: "FOREIGN KEY (reviewed_by) REFERENCES users(id)"
  }
];

const migration002Indexes = [
  {
    index_name: "idx_businesses_listing_status",
    table_name: "businesses",
    index_definition: "CREATE INDEX idx_businesses_listing_status ON public.businesses (listing_status, created_at DESC)"
  }
];

function makeConnection(options = {}) {
  const tables = options.tables || [
    ...requiredTables,
    "businesses",
    "schema_migrations"
  ];

  const columns = Object.fromEntries(
    Object.entries(expectedColumns).map(([table, names]) => [
      table,
      names.map((column_name) => {
        const definition =
          expectedColumnDefinitions[table]?.[column_name] || [];

        return {
          column_name,
          data_type: definition[0],
          is_nullable: definition[1],
          column_default: definition[2]
        };
      })
    ])
  );

  if (options.includeMigration002) {
    const businessBaseDefinitions = {
      business_email: ["text", "YES", null],
      business_phone: ["text", "YES", null],
      created_at: [
        "timestamp with time zone",
        "NO",
        "CURRENT_TIMESTAMP"
      ]
    };

    columns.businesses = [
      ...Object.entries(businessBaseDefinitions),
      ...migration002Columns.map((column) => [
        column,
        migration002ColumnDefinitions[column]
      ])
    ].map(([column_name, definition]) => ({
      column_name,
      data_type: definition[0],
      is_nullable: definition[1],
      column_default: definition[2]
    }));
  }

  for (const [table, rows] of Object.entries(options.columns || {})) {
    columns[table] = rows.map((column_name) => ({
      ...(columns[table] || []).find(
        (row) => row.column_name === column_name
      ),
      column_name
    }));
  }

  for (const [table, definitions] of Object.entries(
    options.columnDefinitions || {}
  )) {
    columns[table] = (columns[table] || []).map((row) => ({
      ...row,
      ...(definitions[row.column_name] || {})
    }));
  }

  const constraints = options.constraints || [
    ...expectedConstraints,
    ...(options.includeMigration002 ? migration002Constraints : [])
  ];

  const indexes = options.indexes || [
    ...expectedIndexes,
    ...(options.includeMigration002 ? migration002Indexes : [])
  ];

  return {
    queries: [],

    async query(sql, params = []) {
      const normalized = sql.trim().replace(/\s+/g, " ");
      this.queries.push({ sql: normalized, params });

      if (normalized.includes("FROM pg_tables")) {
        return {
          rows: tables.map((tablename) => ({ tablename }))
        };
      }

      if (normalized.includes("FROM information_schema.columns")) {
        const tableName = params[0];

        return {
          rows: columns[tableName] || []
        };
      }

      if (normalized.includes("FROM pg_constraint")) {
        return { rows: constraints };
      }

      if (normalized.includes("FROM pg_indexes")) {
        return { rows: indexes };
      }

      throw new Error(`Unexpected test query: ${normalized}`);
    }
  };
}

const applied001 = ["001_accounts_and_spotlight"];
const applied002 = [
  ...applied001,
  "002_business_listing_moderation"
];

test("rejects recorded migration 001 when public.users is missing", async () => {
  const connection = makeConnection({
    tables: [
      "businesses",
      "schema_migrations",
      ...requiredTables.filter((table) => table !== "users")
    ]
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /users.*missing|missing.*users/i
  );
});

test("rejects recorded migration 001 when public.spotlight_ad_events is missing", async () => {
  const connection = makeConnection({
    tables: [
      "businesses",
      "schema_migrations",
      ...requiredTables.filter((table) => table !== "spotlight_ad_events")
    ]
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /spotlight_ad_events.*missing|missing.*spotlight_ad_events/i
  );
});

for (const missingTable of [
  "business_claims",
  "business_memberships",
  "spotlight_ads",
  "spotlight_ad_images"
]) {
  test(`rejects recorded migration 001 when public.${missingTable} is missing`, async () => {
    const connection = makeConnection({
      tables: [
        "businesses",
        "schema_migrations",
        ...requiredTables.filter((table) => table !== missingTable)
      ]
    });

    await assert.rejects(
      validateMigrationIntegrity(connection, applied001),
      new RegExp(`${missingTable}.*missing|missing.*${missingTable}`, "i")
    );
  });
}

test("rejects recorded migration 001 when users.email is missing", async () => {
  const connection = makeConnection({
    columns: {
      users: expectedColumns.users.filter((column) => column !== "email")
    }
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /users.*email|email.*users/i
  );
});

test("rejects recorded migration 001 when spotlight_ad_events.event_type is missing", async () => {
  const connection = makeConnection({
    columns: {
      spotlight_ad_events: expectedColumns.spotlight_ad_events.filter(
        (column) => column !== "event_type"
      )
    }
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /spotlight_ad_events.*event_type|event_type.*spotlight_ad_events/i
  );
});

test("allows additional columns not defined by recorded migration 001", async () => {
  const connection = makeConnection({
    columns: {
      users: [
        ...expectedColumns.users,
        "future_optional_column"
      ]
    }
  });

  await assert.doesNotReject(
    validateMigrationIntegrity(connection, applied001)
  );
});

test("does not require migration 002 columns when only migration 001 is applied", async () => {
  const connection = makeConnection();

  await assert.doesNotReject(
    validateMigrationIntegrity(connection, applied001)
  );
});

test("rejects recorded migration 001 when users.email has the wrong data type", async () => {
  const connection = makeConnection({
    columnDefinitions: {
      users: {
        email: { data_type: "integer" }
      }
    }
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /users.*email|email.*users/i
  );
});

test("rejects recorded migration 001 when users.email has incorrect nullability", async () => {
  const connection = makeConnection({
    columnDefinitions: {
      users: {
        email: { is_nullable: "YES" }
      }
    }
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /users.*email|email.*users/i
  );
});

test("rejects recorded migration 001 when users.is_active has the wrong default", async () => {
  const connection = makeConnection({
    columnDefinitions: {
      users: {
        is_active: { column_default: "false" }
      }
    }
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /users.*is_active|is_active.*users/i
  );
});

test("rejects recorded migration 001 when business_claims.business_id has the wrong data type", async () => {
  const connection = makeConnection({
    columnDefinitions: {
      business_claims: {
        business_id: { data_type: "text" }
      }
    }
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /business_claims.*business_id|business_id.*business_claims/i
  );
});

test("rejects recorded migration 001 when business_memberships.user_id is nullable", async () => {
  const connection = makeConnection({
    columnDefinitions: {
      business_memberships: {
        user_id: { is_nullable: "YES" }
      }
    }
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /business_memberships.*user_id|user_id.*business_memberships/i
  );
});

test("rejects recorded migration 001 when spotlight_ads.status has the wrong default", async () => {
  const connection = makeConnection({
    columnDefinitions: {
      spotlight_ads: {
        status: { column_default: "'active'::text" }
      }
    }
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /spotlight_ads.*status|status.*spotlight_ads/i
  );
});

test("rejects recorded migration 001 when spotlight_ad_images.display_order has the wrong default", async () => {
  const connection = makeConnection({
    columnDefinitions: {
      spotlight_ad_images: {
        display_order: { column_default: "1" }
      }
    }
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /spotlight_ad_images.*display_order|display_order.*spotlight_ad_images/i
  );
});

test("rejects recorded migration 001 when spotlight_ad_events.created_at is nullable", async () => {
  const connection = makeConnection({
    columnDefinitions: {
      spotlight_ad_events: {
        created_at: { is_nullable: "YES" }
      }
    }
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /spotlight_ad_events.*created_at|created_at.*spotlight_ad_events/i
  );
});

test("rejects recorded migration 001 when users primary key is missing", async () => {
  const connection = makeConnection({
    constraints: expectedConstraints.filter(
      (constraint) => constraint.constraint_name !== "users_pkey"
    )
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /users.*primary|primary.*users|users.*pkey/i
  );
});

test("rejects recorded migration 001 when business_claims.user_id foreign key is missing", async () => {
  const connection = makeConnection({
    constraints: expectedConstraints.filter(
      (constraint) =>
        !(
          constraint.table_name === "business_claims" &&
          constraint.constraint_type === "f" &&
          constraint.columns.includes("user_id")
        )
    )
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /business_claims.*user_id|user_id.*business_claims|foreign key/i
  );
});

test("rejects recorded migration 001 when spotlight_ad_images foreign key targets the wrong table", async () => {
  const connection = makeConnection({
    constraints: expectedConstraints.map((constraint) =>
      constraint.table_name === "spotlight_ad_images" &&
      constraint.constraint_type === "f"
        ? { ...constraint, referenced_table: "users" }
        : constraint
    )
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /spotlight_ad_images.*foreign|foreign.*spotlight_ad_images|referenced/i
  );
});

test("rejects recorded migration 001 when spotlight_ad_events cascade delete action is missing", async () => {
  const connection = makeConnection({
    constraints: expectedConstraints.map((constraint) =>
      constraint.table_name === "spotlight_ad_events" &&
      constraint.constraint_type === "f"
        ? { ...constraint, delete_action: "a" }
        : constraint
    )
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /spotlight_ad_events.*foreign|foreign.*spotlight_ad_events|delete|cascade/i
  );
});

test("rejects recorded migration 001 when users email unique constraint is missing", async () => {
  const connection = makeConnection({
    constraints: expectedConstraints.filter(
      (constraint) => constraint.constraint_name !== "users_email_key"
    )
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /users.*email|email.*users|unique/i
  );
});

test("rejects recorded migration 001 when business membership composite unique constraint is missing", async () => {
  const connection = makeConnection({
    constraints: expectedConstraints.filter(
      (constraint) =>
        constraint.constraint_name !==
        "business_memberships_business_id_user_id_key"
    )
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /business_memberships.*unique|unique.*business_memberships/i
  );
});

test("rejects recorded migration 001 when business membership unique constraint has incorrect columns", async () => {
  const connection = makeConnection({
    constraints: expectedConstraints.map((constraint) =>
      constraint.constraint_name ===
      "business_memberships_business_id_user_id_key"
        ? { ...constraint, columns: ["business_id"] }
        : constraint
    )
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /business_memberships.*unique|unique.*business_memberships/i
  );
});

test("rejects recorded migration 001 when spotlight offer price check is missing", async () => {
  const connection = makeConnection({
    constraints: expectedConstraints.filter(
      (constraint) =>
        constraint.constraint_name !== "spotlight_ads_check"
    )
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /spotlight_ads.*offer_price|offer_price.*spotlight_ads|check/i
  );
});

test("rejects recorded migration 001 when spotlight date check has an incorrect definition", async () => {
  const connection = makeConnection({
    constraints: expectedConstraints.map((constraint) =>
      constraint.constraint_name === "spotlight_ads_check3"
        ? {
            ...constraint,
            definition: "CHECK (ends_at >= starts_at)"
          }
        : constraint
    )
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /spotlight_ads.*ends_at|ends_at.*spotlight_ads|check/i
  );
});

test("rejects recorded migration 001 when spotlight publication index is missing", async () => {
  const connection = makeConnection({
    indexes: expectedIndexes.filter(
      (index) => index.index_name !== "idx_spotlight_ads_publication"
    )
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /spotlight_ads.*index|index.*spotlight_ads|publication/i
  );
});

test("rejects recorded migration 001 when spotlight publication index has incorrect column order", async () => {
  const connection = makeConnection({
    indexes: expectedIndexes.map((index) =>
      index.index_name === "idx_spotlight_ads_publication"
        ? {
            ...index,
            index_definition:
              "CREATE INDEX idx_spotlight_ads_publication ON public.spotlight_ads (starts_at, status, ends_at)"
          }
        : index
    )
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /spotlight_ads.*index|index.*spotlight_ads|publication/i
  );
});

const remainingCheckConstraints = [
  "users_role_check",
  "business_claims_status_check",
  "business_memberships_membership_role_check",
  "spotlight_ads_status_check",
  "spotlight_ads_check1",
  "spotlight_ads_check2",
  "spotlight_ad_images_display_order_check",
  "spotlight_ad_events_event_type_check"
];

for (const constraintName of remainingCheckConstraints) {
  test(`rejects recorded migration 001 when CHECK constraint ${constraintName} is missing`, async () => {
    const connection = makeConnection({
      constraints: expectedConstraints.filter(
        (constraint) => constraint.constraint_name !== constraintName
      )
    });

    await assert.rejects(
      validateMigrationIntegrity(connection, applied001),
      /check|constraint/i
    );
  });
}


const remainingForeignKeys = [
  "business_claims_business_id_fkey",
  "business_claims_reviewed_by_fkey",
  "business_memberships_business_id_fkey",
  "business_memberships_user_id_fkey",
  "spotlight_ads_business_id_fkey",
  "spotlight_ads_submitted_by_fkey",
  "spotlight_ads_reviewed_by_fkey"
];

for (const constraintName of remainingForeignKeys) {
  test(`rejects recorded migration 001 when foreign key ${constraintName} is missing`, async () => {
    const connection = makeConnection({
      constraints: expectedConstraints.filter(
        (constraint) => constraint.constraint_name !== constraintName
      )
    });

    await assert.rejects(
      validateMigrationIntegrity(connection, applied001),
      /foreign|constraint|reference/i
    );
  });
}

test("rejects recorded migration 001 when a foreign key references the wrong column", async () => {
  const connection = makeConnection({
    constraints: expectedConstraints.map((constraint) =>
      constraint.constraint_name === "business_claims_business_id_fkey"
        ? { ...constraint, referenced_columns: ["user_id"] }
        : constraint
    )
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /foreign|reference|business_claims/i
  );
});

test("rejects recorded migration 001 when a NO ACTION foreign key has the wrong delete action", async () => {
  const connection = makeConnection({
    constraints: expectedConstraints.map((constraint) =>
      constraint.constraint_name === "business_claims_business_id_fkey"
        ? { ...constraint, delete_action: "c" }
        : constraint
    )
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /foreign|delete|business_claims/i
  );
});


const remainingPrimaryKeys = [
  "business_claims_pkey",
  "business_memberships_pkey",
  "spotlight_ads_pkey",
  "spotlight_ad_images_pkey",
  "spotlight_ad_events_pkey"
];

for (const constraintName of remainingPrimaryKeys) {
  test(`rejects recorded migration 001 when primary key ${constraintName} is missing`, async () => {
    const connection = makeConnection({
      constraints: expectedConstraints.filter(
        (constraint) => constraint.constraint_name !== constraintName
      )
    });

    await assert.rejects(
      validateMigrationIntegrity(connection, applied001),
      /primary|pkey|constraint/i
    );
  });
}


const remainingRequiredIndexes = [
  "idx_business_claims_user_status",
  "idx_business_claims_business_status",
  "idx_business_memberships_user",
  "idx_spotlight_ads_business_created",
  "idx_spotlight_ad_images_order",
  "idx_spotlight_ad_events_ad_type"
];

for (const indexName of remainingRequiredIndexes) {
  test(`rejects recorded migration 001 when ${indexName} is missing`, async () => {
    const connection = makeConnection({
      indexes: expectedIndexes.filter(
        (index) => index.index_name !== indexName
      )
    });

    await assert.rejects(
      validateMigrationIntegrity(connection, applied001),
      /index/i
    );
  });
}

test("rejects recorded migration 001 when business claims user-status index has incorrect column order", async () => {
  const connection = makeConnection({
    indexes: expectedIndexes.map((index) =>
      index.index_name === "idx_business_claims_user_status"
        ? {
            ...index,
            index_definition:
              "CREATE INDEX idx_business_claims_user_status ON public.business_claims (status, user_id)"
          }
        : index
    )
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /index/i
  );
});

test("rejects recorded migration 001 when spotlight image-order index uses incorrect columns", async () => {
  const connection = makeConnection({
    indexes: expectedIndexes.map((index) =>
      index.index_name === "idx_spotlight_ad_images_order"
        ? {
            ...index,
            index_definition:
              "CREATE INDEX idx_spotlight_ad_images_order ON public.spotlight_ad_images (ad_id, created_at)"
          }
        : index
    )
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied001),
    /index/i
  );
});



test("rejects recorded migration 002 when review-metadata CHECK permits incomplete review data", async () => {
  const connection = makeConnection({
    includeMigration002: true,
    constraints: [
      ...expectedConstraints,
      ...migration002Constraints.map((constraint) =>
        constraint.constraint_name === "businesses_review_metadata_check"
          ? {
              ...constraint,
              definition:
                "CHECK (listing_status IN ('pending_review', 'approved', 'rejected'))"
            }
          : constraint
      )
    ]
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied002),
    /constraint|check|businesses/i
  );
});

test("rejects recorded migration 002 when review-metadata CHECK has altered logical grouping", async () => {
  const connection = makeConnection({
    includeMigration002: true,
    constraints: [
      ...expectedConstraints,
      ...migration002Constraints.map((constraint) =>
        constraint.constraint_name === "businesses_review_metadata_check"
          ? {
              ...constraint,
              definition:
                "CHECK (listing_status = 'pending_review' AND reviewed_by IS NULL AND (reviewed_at IS NULL OR listing_status IN ('approved', 'rejected')) AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)"
            }
          : constraint
      )
    ]
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied002),
    /constraint|check|businesses/i
  );
});

test("rejects recorded migration 002 when email-consent CHECK omits the consent timestamp requirement", async () => {
  const connection = makeConnection({
    includeMigration002: true,
    constraints: [
      ...expectedConstraints,
      ...migration002Constraints.map((constraint) =>
        constraint.constraint_name === "businesses_email_consent_check"
          ? {
              ...constraint,
              definition:
                "CHECK (NOT business_email_public OR business_email IS NOT NULL)"
            }
          : constraint
      )
    ]
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied002),
    /constraint|check|businesses/i
  );
});

test("rejects recorded migration 002 when phone-consent CHECK omits the consent timestamp requirement", async () => {
  const connection = makeConnection({
    includeMigration002: true,
    constraints: [
      ...expectedConstraints,
      ...migration002Constraints.map((constraint) =>
        constraint.constraint_name === "businesses_phone_consent_check"
          ? {
              ...constraint,
              definition:
                "CHECK (NOT business_phone_public OR business_phone IS NOT NULL)"
            }
          : constraint
      )
    ]
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied002),
    /constraint|check|businesses/i
  );
});


test("accepts PostgreSQL ANY ARRAY rendering for the users role CHECK", async () => {
  const connection = makeConnection({
    constraints: expectedConstraints.map((constraint) =>
      constraint.constraint_name === "users_role_check"
        ? {
            ...constraint,
            definition:
              "CHECK (role = ANY (ARRAY['business_owner'::text, 'admin'::text]))"
          }
        : constraint
    )
  });

  await validateMigrationIntegrity(connection, applied001);
});

test("accepts PostgreSQL ANY ARRAY rendering for the nested review-metadata CHECK", async () => {
  const connection = makeConnection({
    includeMigration002: true,
    constraints: [
      ...expectedConstraints,
      ...migration002Constraints.map((constraint) =>
        constraint.constraint_name === "businesses_review_metadata_check"
          ? {
              ...constraint,
              definition:
                "CHECK ((listing_status = 'pending_review' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR (listing_status = ANY (ARRAY['approved'::text, 'rejected'::text]) AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))"
            }
          : constraint
      )
    ]
  });

  await validateMigrationIntegrity(connection, applied002);
});

// Migration 002 integrity coverage.

test("accepts a complete schema when only migration 001 is recorded", async () => {
  const connection = makeConnection();

  await validateMigrationIntegrity(connection, applied001);
});

test("accepts a complete schema when migrations 001 and 002 are recorded", async () => {
  const connection = makeConnection({ includeMigration002: true });

  await validateMigrationIntegrity(connection, applied002);
});

for (const columnName of migration002Columns) {
  test(`rejects recorded migration 002 when businesses.${columnName} is missing`, async () => {
    const businessColumns = [
      "business_email",
      "business_phone",
      "created_at",
      ...migration002Columns.filter((column) => column !== columnName)
    ];

    const connection = makeConnection({
      includeMigration002: true,
      columns: {
        businesses: businessColumns
      }
    });

    await assert.rejects(
      validateMigrationIntegrity(connection, applied002),
      /businesses|column/i
    );
  });
}

const migration002DefinitionFailures = [
  ["listing_status", { data_type: "integer" }],
  ["reviewed_by", { data_type: "text" }],
  ["reviewed_at", { is_nullable: "NO" }],
  ["review_notes", { is_nullable: "NO" }],
  ["business_email_public", { data_type: "text" }],
  ["business_phone_public", { column_default: "true" }],
  ["business_email_consent_at", { data_type: "text" }],
  ["business_phone_consent_at", { is_nullable: "NO" }]
];

for (const [columnName, incorrectDefinition] of migration002DefinitionFailures) {
  test(`rejects recorded migration 002 when businesses.${columnName} has an incorrect definition`, async () => {
    const connection = makeConnection({
      includeMigration002: true,
      columnDefinitions: {
        businesses: {
          [columnName]: incorrectDefinition
        }
      }
    });

    await assert.rejects(
      validateMigrationIntegrity(connection, applied002),
      /businesses|column/i
    );
  });
}

for (const constraintName of [
  "businesses_listing_status_check",
  "businesses_review_metadata_check",
  "businesses_email_consent_check",
  "businesses_phone_consent_check"
]) {
  test(`rejects recorded migration 002 when ${constraintName} is missing`, async () => {
    const connection = makeConnection({
      includeMigration002: true,
      constraints: [
        ...expectedConstraints,
        ...migration002Constraints.filter(
          (constraint) => constraint.constraint_name !== constraintName
        )
      ]
    });

    await assert.rejects(
      validateMigrationIntegrity(connection, applied002),
      /constraint|check|businesses/i
    );
  });
}

test("rejects recorded migration 002 when the listing-status CHECK definition is incorrect", async () => {
  const connection = makeConnection({
    includeMigration002: true,
    constraints: [
      ...expectedConstraints,
      ...migration002Constraints.map((constraint) =>
        constraint.constraint_name === "businesses_listing_status_check"
          ? {
              ...constraint,
              definition: "CHECK (listing_status IN ('approved', 'rejected'))"
            }
          : constraint
      )
    ]
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied002),
    /constraint|check|businesses/i
  );
});

test("rejects recorded migration 002 when the businesses reviewed_by foreign key is missing", async () => {
  const connection = makeConnection({
    includeMigration002: true,
    constraints: [
      ...expectedConstraints,
      ...migration002Constraints.filter(
        (constraint) => constraint.constraint_name !== "businesses_reviewed_by_fkey"
      )
    ]
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied002),
    /foreign|constraint|businesses/i
  );
});

test("rejects recorded migration 002 when the reviewed_by foreign key references the wrong table", async () => {
  const connection = makeConnection({
    includeMigration002: true,
    constraints: [
      ...expectedConstraints,
      ...migration002Constraints.map((constraint) =>
        constraint.constraint_name === "businesses_reviewed_by_fkey"
          ? { ...constraint, referenced_table: "businesses" }
          : constraint
      )
    ]
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied002),
    /foreign|reference|businesses/i
  );
});

test("rejects recorded migration 002 when the reviewed_by foreign key has the wrong delete action", async () => {
  const connection = makeConnection({
    includeMigration002: true,
    constraints: [
      ...expectedConstraints,
      ...migration002Constraints.map((constraint) =>
        constraint.constraint_name === "businesses_reviewed_by_fkey"
          ? { ...constraint, delete_action: "c" }
          : constraint
      )
    ]
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied002),
    /foreign|delete|businesses/i
  );
});

test("rejects recorded migration 002 when the publication index is missing", async () => {
  const connection = makeConnection({
    includeMigration002: true,
    indexes: expectedIndexes
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied002),
    /index/i
  );
});

test("rejects recorded migration 002 when the publication index has incorrect columns", async () => {
  const connection = makeConnection({
    includeMigration002: true,
    indexes: [
      ...expectedIndexes,
      {
        ...migration002Indexes[0],
        index_definition:
          "CREATE INDEX idx_businesses_listing_status ON public.businesses (created_at, listing_status)"
      }
    ]
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied002),
    /index/i
  );
});

test("rejects recorded migration 002 when the publication index omits descending order", async () => {
  const connection = makeConnection({
    includeMigration002: true,
    indexes: [
      ...expectedIndexes,
      {
        ...migration002Indexes[0],
        index_definition:
          "CREATE INDEX idx_businesses_listing_status ON public.businesses (listing_status, created_at)"
      }
    ]
  });

  await assert.rejects(
    validateMigrationIntegrity(connection, applied002),
    /index/i
  );
});
