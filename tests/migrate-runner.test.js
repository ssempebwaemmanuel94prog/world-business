"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const runner = path.join(__dirname, "..", "scripts", "migrate.js");

function runMigration(args) {
  return spawnSync(process.execPath, [runner, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL:
        "postgresql://fake:fake@localhost/neondb?sslmode=require"
    },
    timeout: 5000
  });
}

test("refuses to run without --apply", () => {
  const result = runMigration([]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Migration not run/);
  assert.doesNotMatch(result.stderr, /No database connection was opened/);
});

test("rejects an unapproved target before connecting", () => {
  const result = runMigration([
    "--apply",
    "--target",
    "not-approved",
    "--confirm-target",
    "not-approved"
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /target_not_approved/);
  assert.match(result.stderr, /No database connection was opened/);
});

const { readMigrationHistory } = require("../scripts/migrate");

test("stops when the migration history table is missing", async () => {
  let queryCount = 0;

  const connection = {
    async query() {
      queryCount += 1;
      return { rows: [{ table_name: null }] };
    }
  };

  await assert.rejects(
    readMigrationHistory(connection),
    /Migration history table is missing/
  );

  assert.equal(queryCount, 1);
});

test("accepts an existing empty migration history table", async () => {
  let queryCount = 0;

  const connection = {
    async query() {
      queryCount += 1;

      if (queryCount === 1) {
        return { rows: [{ table_name: "schema_migrations" }] };
      }

      return { rows: [] };
    }
  };

  assert.deepEqual(await readMigrationHistory(connection), []);
  assert.equal(queryCount, 2);
});

test("returns valid recorded migration history", async () => {
  let queryCount = 0;

  const connection = {
    async query() {
      queryCount += 1;

      if (queryCount === 1) {
        return { rows: [{ table_name: "schema_migrations" }] };
      }

      return { rows: [{ version: "001_accounts_and_spotlight" }] };
    }
  };

  assert.deepEqual(
    await readMigrationHistory(connection),
    ["001_accounts_and_spotlight"]
  );
  assert.equal(queryCount, 2);
});

test("stops when migration history contains duplicate versions", async () => {
  let queryCount = 0;

  const connection = {
    async query() {
      queryCount += 1;

      if (queryCount === 1) {
        return { rows: [{ table_name: "schema_migrations" }] };
      }

      return {
        rows: [
          { version: "001_accounts_and_spotlight" },
          { version: "001_accounts_and_spotlight" }
        ]
      };
    }
  };

  await assert.rejects(
    readMigrationHistory(connection),
    /Duplicate migration history entry/
  );

  assert.equal(queryCount, 2);
});

test("rejects migration 002 when migration 001 is absent", async () => {
  let queryCount = 0;

  const connection = {
    async query() {
      queryCount += 1;

      if (queryCount === 1) {
        return { rows: [{ table_name: "schema_migrations" }] };
      }

      return { rows: [{ version: "002_business_listing_moderation" }] };
    }
  };

  await assert.rejects(
    readMigrationHistory(connection),
    /001|migration|history/i
  );

  assert.equal(queryCount, 2);
});
