"use strict";

const APPROVED_MIGRATIONS = Object.freeze([
  "001_accounts_and_spotlight",
  "002_business_listing_moderation"
]);

function getPendingMigrations(appliedVersions) {
  if (!Array.isArray(appliedVersions)) {
    throw new TypeError("Applied migration versions must be an array.");
  }

  const applied = new Set();

  for (const version of appliedVersions) {
    if (typeof version !== "string" || version.trim() === "") {
      throw new TypeError("Each applied migration version must be a non-empty string.");
    }
    applied.add(version);
  }

  return APPROVED_MIGRATIONS.filter((version) => !applied.has(version));
}

module.exports = {
  APPROVED_MIGRATIONS,
  getPendingMigrations
};
