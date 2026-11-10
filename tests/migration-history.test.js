"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateAppliedHistory
} = require("../scripts/migration-history");

test("accepts an empty migration history", () => {
  assert.equal(validateAppliedHistory([]), true);
});

test("accepts approved migrations in order", () => {
  assert.equal(
    validateAppliedHistory([
      "001_accounts_and_spotlight",
      "002_business_listing_moderation"
    ]),
    true
  );
});

test("rejects an unapproved migration version", () => {
  assert.throws(
    () => validateAppliedHistory(["003_core_admin_and_listing_approval"]),
    /Unexpected migration history entry/
  );
});

test("rejects migration 002 recorded without migration 001", () => {
  assert.throws(
    () => validateAppliedHistory(["002_business_listing_moderation"]),
    /Inconsistent migration history/
  );
});

test("rejects duplicate migration history entries", () => {
  assert.throws(
    () => validateAppliedHistory([
      "001_accounts_and_spotlight",
      "001_accounts_and_spotlight"
    ]),
    /Duplicate migration history entry/
  );
});

test("rejects invalid history input", () => {
  assert.throws(() => validateAppliedHistory(null), TypeError);
  assert.throws(() => validateAppliedHistory([""]), /Unexpected migration history entry/);
});
