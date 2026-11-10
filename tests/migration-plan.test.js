"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  APPROVED_MIGRATIONS,
  getPendingMigrations
} = require("../scripts/migration-plan");

test("approved migrations are in the intended order", () => {
  assert.deepEqual(APPROVED_MIGRATIONS, [
    "001_accounts_and_spotlight",
    "002_business_listing_moderation"
  ]);
});

test("returns all approved migrations when none are applied", () => {
  assert.deepEqual(getPendingMigrations([]), [
    "001_accounts_and_spotlight",
    "002_business_listing_moderation"
  ]);
});

test("skips migrations already applied", () => {
  assert.deepEqual(
    getPendingMigrations(["001_accounts_and_spotlight"]),
    ["002_business_listing_moderation"]
  );
});

test("returns no pending migrations when both are applied", () => {
  assert.deepEqual(
    getPendingMigrations([
      "001_accounts_and_spotlight",
      "002_business_listing_moderation"
    ]),
    []
  );
});

test("does not approve migration 003", () => {
  assert.equal(
    APPROVED_MIGRATIONS.includes("003_core_admin_and_listing_approval"),
    false
  );
  assert.deepEqual(
    getPendingMigrations(["003_core_admin_and_listing_approval"]),
    ["001_accounts_and_spotlight", "002_business_listing_moderation"]
  );
});

test("rejects non-array input", () => {
  assert.throws(() => getPendingMigrations(null), TypeError);
});

test("rejects invalid migration versions", () => {
  assert.throws(() => getPendingMigrations([""]), TypeError);
  assert.throws(() => getPendingMigrations([null]), TypeError);
});
