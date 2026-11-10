"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  REVIEW_STATUSES,
  isValidReviewDecision,
  hasPublicConsent,
  toPublicBusiness
} = require("../listing-policy");

function sampleBusiness(overrides = {}) {
  return {
    id: 12,
    business_name: "Example Shop",
    country: "Uganda",
    city: "Kampala",
    category: "Retail",
    description: "A sample business",
    website: "https://example.com",
    business_email: "owner@example.com",
    business_phone: "+256700000000",
    contact_person: "Private Contact Name",
    listing_status: "approved",
    business_email_public: true,
    business_phone_public: true,
    business_email_consent_at: "2026-10-25T08:00:00Z",
    business_phone_consent_at: "2026-10-25T08:00:00Z",
    created_at: "2026-10-25T07:00:00Z",
    ...overrides
  };
}

test("only approved and rejected are valid review decisions", () => {
  assert.equal(isValidReviewDecision("approved"), true);
  assert.equal(isValidReviewDecision("rejected"), true);
  assert.equal(isValidReviewDecision("pending_review"), false);
  assert.equal(isValidReviewDecision("admin"), false);
  assert.equal(isValidReviewDecision(undefined), false);
});

test("review status list contains only the three intended statuses", () => {
  assert.deepEqual(REVIEW_STATUSES, [
    "pending_review",
    "approved",
    "rejected"
  ]);
});

test("pending listing is not publicly projected", () => {
  assert.equal(
    toPublicBusiness(sampleBusiness({ listing_status: "pending_review" })),
    null
  );
});

test("rejected listing is not publicly projected", () => {
  assert.equal(
    toPublicBusiness(sampleBusiness({ listing_status: "rejected" })),
    null
  );
});

test("approved listing exposes consented contact details", () => {
  const result = toPublicBusiness(sampleBusiness());
  assert.equal(result.business_email, "owner@example.com");
  assert.equal(result.business_phone, "+256700000000");
});

test("email stays private without explicit consent", () => {
  const result = toPublicBusiness(sampleBusiness({
    business_email_public: false
  }));
  assert.equal(result.business_email, null);
});

test("phone stays private without explicit consent", () => {
  const result = toPublicBusiness(sampleBusiness({
    business_phone_public: false
  }));
  assert.equal(result.business_phone, null);
});

test("contact details stay private when consent timestamps are missing", () => {
  const result = toPublicBusiness(sampleBusiness({
    business_email_consent_at: null,
    business_phone_consent_at: ""
  }));
  assert.equal(result.business_email, null);
  assert.equal(result.business_phone, null);
});

test("contact details stay private when values are missing", () => {
  const result = toPublicBusiness(sampleBusiness({
    business_email: "",
    business_phone: null
  }));
  assert.equal(result.business_email, null);
  assert.equal(result.business_phone, null);
});

test("private contact-person name is never included in public output", () => {
  const result = toPublicBusiness(sampleBusiness());
  assert.equal(
    Object.hasOwn(result, "contact_person"),
    false
  );
});

test("public output contains only the approved field allowlist", () => {
  const result = toPublicBusiness(sampleBusiness());
  assert.deepEqual(Object.keys(result), [
    "id",
    "business_name",
    "country",
    "city",
    "category",
    "description",
    "website",
    "business_email",
    "business_phone",
    "created_at"
  ]);
});

test("unapproved or missing input cannot produce a public listing", () => {
  assert.equal(toPublicBusiness(null), null);
  assert.equal(toPublicBusiness(undefined), null);
  assert.equal(toPublicBusiness({}), null);
});

test("contact details stay private when consent timestamps are invalid dates", () => {
  const result = toPublicBusiness(sampleBusiness({
    business_email_consent_at: "not-a-date",
    business_phone_consent_at: "2026-99-99T25:61:00Z"
  }));
  assert.equal(result.business_email, null);
  assert.equal(result.business_phone, null);
});

test("contact details stay private when consent timestamps contain only whitespace", () => {
  const result = toPublicBusiness(sampleBusiness({
    business_email_consent_at: "   ",
    business_phone_consent_at: "\t"
  }));
  assert.equal(result.business_email, null);
  assert.equal(result.business_phone, null);
});

test("valid consent timestamps continue to allow explicitly consented contacts", () => {
  const result = toPublicBusiness(sampleBusiness({
    business_email_consent_at: "2026-10-25T08:00:00Z",
    business_phone_consent_at: "2026-10-25T08:00:00Z"
  }));
  assert.equal(result.business_email, "owner@example.com");
  assert.equal(result.business_phone, "+256700000000");
});

test("valid Date objects allow explicitly consented contact details", () => {
  const consentDate = new Date("2026-10-25T08:00:00Z");
  const result = toPublicBusiness(sampleBusiness({
    business_email_consent_at: consentDate,
    business_phone_consent_at: consentDate
  }));

  assert.equal(result.business_email, "owner@example.com");
  assert.equal(result.business_phone, "+256700000000");
});

test("invalid Date objects keep contact details private", () => {
  const invalidDate = new Date("not-a-date");
  const result = toPublicBusiness(sampleBusiness({
    business_email_consent_at: invalidDate,
    business_phone_consent_at: invalidDate
  }));

  assert.equal(result.business_email, null);
  assert.equal(result.business_phone, null);
});
