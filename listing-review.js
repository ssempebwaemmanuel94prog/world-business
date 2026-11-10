"use strict";

const { isValidReviewDecision } = require("./listing-policy");

function validateReviewInput(id, body) {
  if (typeof id !== "string" || !/^[1-9]\d*$/.test(id)) {
    return {
      ok: false,
      statusCode: 400,
      error: "A valid listing ID is required."
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      statusCode: 400,
      error: "A review decision is required."
    };
  }

  if (!isValidReviewDecision(body.status)) {
    return {
      ok: false,
      statusCode: 400,
      error: "Decision must be approved or rejected."
    };
  }

  let reviewNotes = null;

  if (body.reviewNotes !== undefined && body.reviewNotes !== null) {
    if (
      typeof body.reviewNotes !== "string" ||
      body.reviewNotes.trim().length > 2000
    ) {
      return {
        ok: false,
        statusCode: 400,
        error: "Review notes must be text no longer than 2000 characters."
      };
    }

    reviewNotes = body.reviewNotes.trim() || null;
  }

  return {
    ok: true,
    id,
    status: body.status,
    reviewNotes
  };
}

async function applyReviewDecision(pool, input, adminId) {
  const result = await pool.query(
    `UPDATE public.businesses
     SET listing_status = $1,
         reviewed_by = $2,
         reviewed_at = CURRENT_TIMESTAMP,
         review_notes = $3
     WHERE id = $4
       AND listing_status = 'pending_review'
     RETURNING id, listing_status, reviewed_by, reviewed_at`,
    [input.status, adminId, input.reviewNotes, input.id]
  );

  if (result.rowCount !== 1) {
    return { kind: "conflict" };
  }

  return {
    kind: "success",
    listing: result.rows[0]
  };
}

module.exports = {
  validateReviewInput,
  applyReviewDecision
};
