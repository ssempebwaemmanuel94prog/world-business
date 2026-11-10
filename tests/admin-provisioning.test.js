"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const {
  validateAdminInput,
  provisionFirstAdmin
} = require("../scripts/admin-provisioning");

const validInput = {
  email: "  FIRST.ADMIN@example.com ",
  password: "A-strong-test-password-2026"
};

function makeFakePool(handler) {
  const calls = [];
  let released = false;

  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      return handler(sql, values, calls);
    },
    release() {
      released = true;
    }
  };

  return {
    calls,
    get released() {
      return released;
    },
    async connect() {
      return client;
    }
  };
}

test("normalizes email and validates password", () => {
  const result = validateAdminInput(validInput);

  assert.equal(result.ok, true);
  assert.equal(result.email, "first.admin@example.com");
  assert.equal(result.password, validInput.password);
});

test("rejects invalid email and password inputs", () => {
  for (const input of [
    null,
    {},
    { email: "not-an-email", password: validInput.password },
    { email: "admin@example.com", password: "short" },
    { email: "admin@example.com", password: "x".repeat(73) },
    { email: "admin@example.com", password: "😀".repeat(19) }
  ]) {
    assert.equal(validateAdminInput(input).ok, false);
  }
});

test("requires explicit write confirmation before connecting", async () => {
  let connectCalled = false;
  const pool = {
    async connect() {
      connectCalled = true;
      throw new Error("Should not connect");
    }
  };

  const result = await provisionFirstAdmin(pool, validInput);

  assert.deepEqual(result, { kind: "confirmation_required" });
  assert.equal(connectCalled, false);
});

test("does not connect for invalid input", async () => {
  let connectCalled = false;
  const pool = {
    async connect() {
      connectCalled = true;
      throw new Error("Should not connect");
    }
  };

  const result = await provisionFirstAdmin(
    pool,
    { email: "bad", password: "short" },
    { confirmWrite: true }
  );

  assert.equal(result.kind, "invalid_input");
  assert.equal(connectCalled, false);
});

test("creates first admin with a bcrypt password hash", async () => {
  const pool = makeFakePool((sql, values) => {
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return { rowCount: null, rows: [] };
    }
    if (sql.includes("pg_advisory_xact_lock")) {
      return { rowCount: null, rows: [] };
    }
    if (sql.includes("SELECT id FROM public.users WHERE role = 'admin'")) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes("SELECT id FROM public.users WHERE LOWER(email)")) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes("INSERT INTO public.users")) {
      assert.equal(sql.includes("'admin'"), true);
      assert.equal(sql.includes("password_hash"), true);

      const hash = values[1];
      assert.equal(typeof hash, "string");
      assert.notEqual(hash, validInput.password);

      return {
        rowCount: 1,
        rows: [{
          id: "1",
          email: "first.admin@example.com",
          role: "admin"
        }]
      };
    }
    throw new Error("Unexpected SQL in fake database");
  });

  const result = await provisionFirstAdmin(
    pool,
    validInput,
    { confirmWrite: true }
  );

  assert.equal(result.kind, "created");
  assert.deepEqual(result.user, {
    id: "1",
    email: "first.admin@example.com",
    role: "admin"
  });

  const insertCall = pool.calls.find((call) =>
    call.sql.includes("INSERT INTO public.users")
  );
  assert.ok(insertCall);

  const storedHash = insertCall.values[1];
  assert.equal(await bcrypt.compare(validInput.password, storedHash), true);

  assert.ok(pool.calls.some((call) => call.sql === "COMMIT"));
  assert.equal(pool.released, true);
});

test("refuses to create a second administrator", async () => {
  const pool = makeFakePool((sql, values) => {
    if (sql === "BEGIN" || sql === "ROLLBACK") {
      return { rowCount: null, rows: [] };
    }
    if (sql.includes("pg_advisory_xact_lock")) {
      return { rowCount: null, rows: [] };
    }
    if (sql.includes("SELECT id FROM public.users WHERE role = 'admin'")) {
      return { rowCount: 1, rows: [{ id: "9" }] };
    }
    throw new Error("Unexpected SQL in fake database");
  });

  const result = await provisionFirstAdmin(
    pool,
    validInput,
    { confirmWrite: true }
  );

  assert.deepEqual(result, { kind: "admin_already_exists" });
  assert.equal(pool.calls.some((call) => call.sql.includes("INSERT INTO")), false);
  assert.equal(pool.calls.some((call) => call.sql === "ROLLBACK"), true);
  assert.equal(pool.released, true);
});

test("refuses to promote an existing non-admin account", async () => {
  const pool = makeFakePool((sql, values) => {
    if (sql === "BEGIN" || sql === "ROLLBACK") {
      return { rowCount: null, rows: [] };
    }
    if (sql.includes("pg_advisory_xact_lock")) {
      return { rowCount: null, rows: [] };
    }
    if (sql.includes("SELECT id FROM public.users WHERE role = 'admin'")) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes("SELECT id FROM public.users WHERE LOWER(email)")) {
      return { rowCount: 1, rows: [{ id: "4" }] };
    }
    throw new Error("Unexpected SQL in fake database");
  });

  const result = await provisionFirstAdmin(
    pool,
    validInput,
    { confirmWrite: true }
  );

  assert.deepEqual(result, { kind: "email_already_exists" });
  assert.equal(pool.calls.some((call) => call.sql.includes("INSERT INTO")), false);
  assert.equal(pool.released, true);
});

test("rolls back on database failure and does not expose error details", async () => {
  const pool = makeFakePool((sql, values) => {
    if (sql === "BEGIN") {
      return { rowCount: null, rows: [] };
    }
    if (sql.includes("pg_advisory_xact_lock")) {
      throw new Error("private database details");
    }
    if (sql === "ROLLBACK") {
      return { rowCount: null, rows: [] };
    }
    throw new Error("Unexpected SQL in fake database");
  });

  const result = await provisionFirstAdmin(
    pool,
    validInput,
    { confirmWrite: true }
  );

  assert.deepEqual(result, { kind: "database_error" });
  assert.equal(pool.calls.some((call) => call.sql === "ROLLBACK"), true);
  assert.equal(pool.released, true);
  assert.equal(JSON.stringify(result).includes("private database details"), false);
});
