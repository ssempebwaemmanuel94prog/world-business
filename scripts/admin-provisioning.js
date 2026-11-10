"use strict";

const bcrypt = require("bcryptjs");

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 72;
const BCRYPT_ROUNDS = 12;
const LOCK_KEY = "worldlink-business-first-admin-v1";

function validateAdminInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Invalid input." };
  }

  if (typeof input.email !== "string") {
    return { ok: false, error: "A valid email is required." };
  }

  const email = input.email.trim().toLowerCase();

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return { ok: false, error: "A valid email is required." };
  }

  if (
    typeof input.password !== "string" ||
    input.password.length < MIN_PASSWORD_LENGTH ||
    Buffer.byteLength(input.password, "utf8") > MAX_PASSWORD_BYTES
  ) {
    return {
      ok: false,
      error: "Password must be at least 12 characters and no more than 72 UTF-8 bytes."
    };
  }

  return { ok: true, email, password: input.password };
}

async function provisionFirstAdmin(pool, input, options = {}) {
  // Fail closed: writing requires an explicit opt-in.
  if (options.confirmWrite !== true) {
    return { kind: "confirmation_required" };
  }

  if (!pool || typeof pool.connect !== "function") {
    return { kind: "invalid_database_pool" };
  }

  const validated = validateAdminInput(input);
  if (!validated.ok) {
    return { kind: "invalid_input", error: validated.error };
  }

  // Hash before opening a transaction so the transaction stays short.
  const passwordHash = await bcrypt.hash(
    validated.password,
    BCRYPT_ROUNDS
  );

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Serialize this provisioning operation across concurrent attempts.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [LOCK_KEY]
    );

    const admins = await client.query(
      "SELECT id FROM public.users WHERE role = 'admin' LIMIT 1"
    );

    if (admins.rowCount > 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return { kind: "admin_already_exists" };
    }

    const existingUser = await client.query(
      "SELECT id FROM public.users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [validated.email]
    );

    if (existingUser.rowCount > 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return { kind: "email_already_exists" };
    }

    const inserted = await client.query(
      `INSERT INTO public.users (email, password_hash, role, is_active)
       VALUES ($1, $2, 'admin', TRUE)
       RETURNING id, email, role`,
      [validated.email, passwordHash]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return {
      kind: "created",
      user: inserted.rows[0]
    };
  } catch {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Do not mask the original failure with rollback details.
      }
    }

    return { kind: "database_error" };
  } finally {
    client.release();
  }
}

module.exports = {
  validateAdminInput,
  provisionFirstAdmin
};
