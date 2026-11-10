"use strict";

const REVIEW_STATUSES = Object.freeze([
  "pending_review",
  "approved",
  "rejected"
]);

function isValidReviewDecision(status) {
  return status === "approved" || status === "rejected";
}

function hasPublicConsent(value, consentFlag, consentTimestamp) {
  let timestampMs = NaN;

  if (consentTimestamp instanceof Date) {
    timestampMs = consentTimestamp.getTime();
  } else if (typeof consentTimestamp === "string") {
    const timestamp = consentTimestamp.trim();
    timestampMs = timestamp ? Date.parse(timestamp) : NaN;
  }

  return (
    consentFlag === true &&
    Number.isFinite(timestampMs) &&
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function toPublicBusiness(row) {
  if (!row || row.listing_status !== "approved") {
    return null;
  }

  return {
    id: row.id,
    business_name: row.business_name,
    country: row.country,
    city: row.city,
    category: row.category,
    description: row.description,
    website: row.website || null,
    business_email: hasPublicConsent(
      row.business_email,
      row.business_email_public,
      row.business_email_consent_at
    ) ? row.business_email.trim() : null,
    business_phone: hasPublicConsent(
      row.business_phone,
      row.business_phone_public,
      row.business_phone_consent_at
    ) ? row.business_phone.trim() : null,
    created_at: row.created_at
  };
}

module.exports = {
  REVIEW_STATUSES,
  isValidReviewDecision,
  hasPublicConsent,
  toPublicBusiness
};
