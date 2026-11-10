"use strict";

const APPROVED_TARGET = Object.freeze({
  name: "worldlink-migration-test",
  hostname: "ep-raspy-poetry-b5we6viw-pooler.c-7.us-east-2.aws.neon.tech",
  database: "neondb"
});

function validateMigrationTarget(options = {}) {
  const { databaseUrl, targetName, confirmTarget } = options;

  if (confirmTarget !== true) {
    return { ok: false, reason: "confirmation_required" };
  }

  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") {
    return { ok: false, reason: "database_url_missing" };
  }

  if (typeof targetName !== "string" || targetName.trim() === "") {
    return { ok: false, reason: "target_name_missing" };
  }

  if (targetName !== APPROVED_TARGET.name) {
    return { ok: false, reason: "target_not_approved" };
  }

  let url;

  try {
    url = new URL(databaseUrl);
  } catch {
    return { ok: false, reason: "database_url_invalid" };
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    return { ok: false, reason: "database_protocol_not_approved" };
  }

  if (url.hostname.toLowerCase() !== APPROVED_TARGET.hostname) {
    return { ok: false, reason: "database_host_not_approved" };
  }

  if (url.pathname.replace(/^\/+|\/+$/g, "") !== APPROVED_TARGET.database) {
    return { ok: false, reason: "database_name_not_approved" };
  }

  if (url.searchParams.get("sslmode") !== "verify-full") {
    return { ok: false, reason: "database_ssl_not_verified" };
  }

  return { ok: true, targetName: APPROVED_TARGET.name };
}

module.exports = { validateMigrationTarget };
