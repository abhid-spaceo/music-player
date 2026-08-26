-- Fields required by YouTube's Developer Policies and Required Minimum
-- Functionality that Phase 0 missed. All are returned by the same
-- part=snippet,contentDetails,status call, so they cost no extra quota.

-- "API Clients must look up the Made For Kids status of each YouTube video that
--  it embeds ... For each video that is designated Made For Kids, API Clients
--  must turn off tracking and make sure that all data collection with respect
--  to that player is compliant."
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS made_for_kids boolean;

-- contentDetails.contentRating.ytRating = 'ytAgeRestricted'. Age-restricted
-- videos cannot be played on most third-party sites, and at playback time they
-- are indistinguishable from an owner-disabled embed (both onError 101/150) —
-- so this must be caught at ingest or it cannot be labelled correctly at all.
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS age_restricted boolean;

-- snippet.liveBroadcastContent: 'live' | 'upcoming' | 'none'. A live or
-- upcoming broadcast reports contentDetails.duration as P0D, so duration_sec
-- of 0 is meaningful rather than a parse failure.
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS live_broadcast_content text;

-- regionRestriction returns EITHER allowed[] OR blocked[]. The original schema
-- could only store blocked[], so the allow-list case was underivable from a row.
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS region_allowed text[];

-- Age restriction is its own visible state, per the brief's risk #2.
ALTER TYPE track_availability ADD VALUE IF NOT EXISTS 'age_restricted';

-- The 30-day rule: "API Clients may temporarily store limited amounts of
-- Non-Authorized Data ... but not longer than 30 calendar days ... after 30
-- calendar days, the API Client must either delete or refresh the stored data."
-- This index makes "which rows are approaching 30 days" a cheap query.
CREATE INDEX IF NOT EXISTS tracks_metadata_fetched_idx
  ON tracks (metadata_fetched_at NULLS FIRST);
