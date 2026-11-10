BEGIN;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS listing_status TEXT NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS reviewed_by BIGINT REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS business_email_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS business_phone_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS business_email_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS business_phone_consent_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'businesses_listing_status_check'
      AND conrelid = 'public.businesses'::regclass
  ) THEN
    ALTER TABLE public.businesses
      ADD CONSTRAINT businesses_listing_status_check
      CHECK (listing_status IN ('pending_review', 'approved', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'businesses_review_metadata_check'
      AND conrelid = 'public.businesses'::regclass
  ) THEN
    ALTER TABLE public.businesses
      ADD CONSTRAINT businesses_review_metadata_check
      CHECK (
        (listing_status = 'pending_review'
          AND reviewed_by IS NULL AND reviewed_at IS NULL)
        OR
        (listing_status IN ('approved', 'rejected')
          AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'businesses_email_consent_check'
      AND conrelid = 'public.businesses'::regclass
  ) THEN
    ALTER TABLE public.businesses
      ADD CONSTRAINT businesses_email_consent_check
      CHECK (
        NOT business_email_public
        OR (
          business_email IS NOT NULL
          AND business_email_consent_at IS NOT NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'businesses_phone_consent_check'
      AND conrelid = 'public.businesses'::regclass
  ) THEN
    ALTER TABLE public.businesses
      ADD CONSTRAINT businesses_phone_consent_check
      CHECK (
        NOT business_phone_public
        OR (
          business_phone IS NOT NULL
          AND business_phone_consent_at IS NOT NULL
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_businesses_listing_status
  ON public.businesses(listing_status, created_at DESC);

INSERT INTO public.schema_migrations(version)
VALUES ('002_business_listing_moderation')
ON CONFLICT (version) DO NOTHING;

COMMIT;
