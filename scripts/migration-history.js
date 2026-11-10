"use strict";

const { APPROVED_MIGRATIONS } = require("./migration-plan");

function validateAppliedHistory(versions) {
  if (!Array.isArray(versions)) {
    throw new TypeError("Applied migration versions must be an array.");
  }

  const approved = new Set(APPROVED_MIGRATIONS);

  for (const version of versions) {
    if (typeof version !== "string" || !approved.has(version)) {
      throw new Error(
        `Unexpected migration history entry: ${String(version)}. No migration was applied.`
      );
    }
  }

  if (new Set(versions).size !== versions.length) {
    throw new Error(
      "Duplicate migration history entry detected. No migration was applied."
    );
  }

  const applied = new Set(versions);

  for (let i = 0; i < APPROVED_MIGRATIONS.length; i++) {
    const version = APPROVED_MIGRATIONS[i];

    if (!applied.has(version)) {
      const laterApplied = APPROVED_MIGRATIONS
        .slice(i + 1)
        .find((later) => applied.has(later));

      if (laterApplied) {
        throw new Error(
          `Inconsistent migration history: ${laterApplied} is recorded but ${version} is not. No migration was applied.`
        );
      }
    }
  }

  return true;
}

module.exports = { validateAppliedHistory };
