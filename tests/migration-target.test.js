"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateMigrationTarget } = require("../scripts/migration-target");

const targetName = "worldlink-migration-test";
const approvedUrl =
  "postgresql://fake_user:fake_password@ep-raspy-poetry-b5we6viw-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=verify-full";

test("requires explicit confirmation", () => {
  assert.deepEqual(validateMigrationTarget(), {
    ok: false,
    reason: "confirmation_required"
  });
});

test("requires confirmation even when other details exist", () => {
  assert.deepEqual(
    validateMigrationTarget({
      databaseUrl: approvedUrl,
      targetName,
      confirmTarget: false
    }),
    { ok: false, reason: "confirmation_required" }
  );
});

test("rejects a missing database URL", () => {
  assert.deepEqual(
    validateMigrationTarget({ targetName, confirmTarget: true }),
    { ok: false, reason: "database_url_missing" }
  );
});

test("rejects a blank database URL", () => {
  assert.deepEqual(
    validateMigrationTarget({
      databaseUrl: " ",
      targetName,
      confirmTarget: true
    }),
    { ok: false, reason: "database_url_missing" }
  );
});

test("requires a target name", () => {
  assert.deepEqual(
    validateMigrationTarget({
      databaseUrl: approvedUrl,
      confirmTarget: true
    }),
    { ok: false, reason: "target_name_missing" }
  );
});

test("rejects an unapproved target name", () => {
  assert.deepEqual(
    validateMigrationTarget({
      databaseUrl: approvedUrl,
      targetName: "production",
      confirmTarget: true
    }),
    { ok: false, reason: "target_not_approved" }
  );
});

test("rejects a malformed database URL", () => {
  assert.deepEqual(
    validateMigrationTarget({
      databaseUrl: "not-a-url",
      targetName,
      confirmTarget: true
    }),
    { ok: false, reason: "database_url_invalid" }
  );
});

test("rejects a non-PostgreSQL protocol", () => {
  assert.deepEqual(
    validateMigrationTarget({
      databaseUrl: "https://example.com/neondb",
      targetName,
      confirmTarget: true
    }),
    { ok: false, reason: "database_protocol_not_approved" }
  );
});

test("rejects a different database hostname", () => {
  assert.deepEqual(
    validateMigrationTarget({
      databaseUrl:
        "postgresql://fake:fake@production.example.com/neondb?sslmode=verify-full",
      targetName,
      confirmTarget: true
    }),
    { ok: false, reason: "database_host_not_approved" }
  );
});

test("rejects a different database name", () => {
  assert.deepEqual(
    validateMigrationTarget({
      databaseUrl:
        "postgresql://fake:fake@ep-raspy-poetry-b5we6viw-pooler.c-7.us-east-2.aws.neon.tech/otherdb?sslmode=verify-full",
      targetName,
      confirmTarget: true
    }),
    { ok: false, reason: "database_name_not_approved" }
  );
});

test("rejects a URL without required SSL mode", () => {
  assert.deepEqual(
    validateMigrationTarget({
      databaseUrl:
        "postgresql://fake:fake@ep-raspy-poetry-b5we6viw-pooler.c-7.us-east-2.aws.neon.tech/neondb",
      targetName,
      confirmTarget: true
    }),
    { ok: false, reason: "database_ssl_not_verified" }
  );
});

test("rejects sslmode=require because verification must be explicit", () => {
  assert.deepEqual(
    validateMigrationTarget({
      databaseUrl: approvedUrl.replace("sslmode=verify-full", "sslmode=require"),
      targetName,
      confirmTarget: true
    }),
    { ok: false, reason: "database_ssl_not_verified" }
  );
});

test("accepts the explicitly approved test endpoint", () => {
  assert.deepEqual(
    validateMigrationTarget({
      databaseUrl: approvedUrl,
      targetName,
      confirmTarget: true
    }),
    { ok: true, targetName }
  );
});
