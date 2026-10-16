BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'business_owner'
    CHECK (role IN ('business_owner', 'admin')),
  email_verified_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_claims (
  id BIGSERIAL PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  verification_method TEXT,
  verification_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by BIGINT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_memberships (
  id BIGSERIAL PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  membership_role TEXT NOT NULL DEFAULT 'owner'
    CHECK (membership_role IN ('owner', 'manager')),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (business_id, user_id)
);

CREATE TABLE IF NOT EXISTS spotlight_ads (
  id BIGSERIAL PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id),
  submitted_by BIGINT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  offer_price NUMERIC(12,2),
  original_price NUMERIC(12,2),
  currency CHAR(3),
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  terms TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  website TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (
      status IN (
        'pending_review',
        'changes_requested',
        'rejected',
        'approved',
        'scheduled',
        'active',
        'expired',
        'removed'
      )
    ),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  reviewed_by BIGINT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (offer_price IS NULL OR offer_price >= 0),
  CHECK (original_price IS NULL OR original_price >= 0),
  CHECK (
    offer_price IS NULL
    OR original_price IS NULL
    OR offer_price <= original_price
  ),
  CHECK (
    ends_at IS NULL
    OR starts_at IS NULL
    OR ends_at > starts_at
  )
);

CREATE TABLE IF NOT EXISTS spotlight_ad_images (
  id BIGSERIAL PRIMARY KEY,
  ad_id BIGINT NOT NULL REFERENCES spotlight_ads(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (display_order >= 0)
);

CREATE TABLE IF NOT EXISTS spotlight_ad_events (
  id BIGSERIAL PRIMARY KEY,
  ad_id BIGINT NOT NULL REFERENCES spotlight_ads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'offer_click', 'contact_click')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_business_claims_user_status
  ON business_claims(user_id, status);

CREATE INDEX IF NOT EXISTS idx_business_claims_business_status
  ON business_claims(business_id, status);

CREATE INDEX IF NOT EXISTS idx_business_memberships_user
  ON business_memberships(user_id);

CREATE INDEX IF NOT EXISTS idx_spotlight_ads_business_created
  ON spotlight_ads(business_id, created_at);

CREATE INDEX IF NOT EXISTS idx_spotlight_ads_publication
  ON spotlight_ads(status, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_spotlight_ad_images_order
  ON spotlight_ad_images(ad_id, display_order);

CREATE INDEX IF NOT EXISTS idx_spotlight_ad_events_ad_type
  ON spotlight_ad_events(ad_id, event_type, created_at);

INSERT INTO schema_migrations (version)
VALUES ('001_accounts_and_spotlight')
ON CONFLICT (version) DO NOTHING;

COMMIT;
