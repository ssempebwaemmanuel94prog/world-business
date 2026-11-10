"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateReviewInput,
  applyReviewDecision
} = require("../listing-review");

test("rejects invalid listing IDs", () => {
  for (const id of ["0", "-1", "1.5", "abc", "", "01"]) {
    assert.equal(validateReviewInput(id, { status: "approved" }).ok, false);
  }
});

test("rejects missing bodies and invalid decisions", () => {
  assert.equal(validateReviewInput("12", null).statusCode, 400);
  assert.equal(validateReviewInput("12", []).statusCode, 400);
  assert.equal(
    validateReviewInput("12", { status: "pending_review" }).ok,
    false
  );
  assert.equal(
    validateReviewInput("12", { status: "admin" }).ok,
    false
  );
});

test("accepts approval and trims review notes", () => {
  assert.deepEqual(
    validateReviewInput("12", {
      status: "approved",
      reviewNotes: "  Verified details  "
    }),
    {
      ok: true,
      id: "12",
      status: "approved",
      reviewNotes: "Verified details"
    }
  );
});

test("accepts rejection without notes", () => {
  assert.deepEqual(
    validateReviewInput("13", { status: "rejected" }),
    {
      ok: true,
      id: "13",
      status: "rejected",
      reviewNotes: null
    }
  );
});

test("rejects review notes longer than 2000 characters", () => {
  const result = validateReviewInput("12", {
    status: "approved",
    reviewNotes: "x".repeat(2001)
  });
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 400);
});

test("rejects non-text review notes", () => {
  assert.equal(
    validateReviewInput("12", {
      status: "approved",
      reviewNotes: 123
    }).ok,
    false
  );
});

test("updates only a pending listing and records the admin", async () => {
  let capturedSql;
  let capturedValues;

  const fakePool = {
    async query(sql, values) {
      capturedSql = sql;
      capturedValues = values;
      return {
        rowCount: 1,
        rows: [{
          id: "12",
          listing_status: "approved",
          reviewed_by: "7",
          reviewed_at: "2026-10-25T10:00:00Z"
        }]
      };
    }
  };

  const input = validateReviewInput("12", {
    status: "approved",
    reviewNotes: "Checked"
  });

  const result = await applyReviewDecision(fakePool, input, "7");

  assert.equal(result.kind, "success");
  assert.equal(result.listing.listing_status, "approved");
  assert.match(capturedSql, /WHERE id = \$4/);
  assert.match(capturedSql, /listing_status = 'pending_review'/);
  assert.deepEqual(capturedValues, ["approved", "7", "Checked", "12"]);
});

test("returns conflict when no pending listing is updated", async () => {
  const fakePool = {
    async query() {
      return { rowCount: 0, rows: [] };
    }
  };

  const input = validateReviewInput("12", { status: "rejected" });
  const result = await applyReviewDecision(fakePool, input, "7");

  assert.deepEqual(result, { kind: "conflict" });
});

test("does not hide database errors", async () => {
  const fakePool = {
    async query() {
      throw new Error("simulated database failure");
    }
  };

  const input = validateReviewInput("12", { status: "approved" });

  await assert.rejects(
    applyReviewDecision(fakePool, input, "7"),
    /simulated database failure/
  );
});
