-- Phase 1 — foundation. Idempotent: safe to re-run.
-- Targets Neon Postgres; verified locally against PostgreSQL 16.

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ---------------------------------------------------------------- users
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'listener');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              citext NOT NULL UNIQUE,
  password_hash      text   NOT NULL,
  role               user_role NOT NULL DEFAULT 'listener',
  display_name       text   NOT NULL,
  -- Bumping this invalidates every outstanding cookie for the user. Read only
  -- on session refresh, never per request, so it costs no Neon compute on the
  -- hot path (see docs/phase-0-youtube-grounding.md §5).
  session_version    integer NOT NULL DEFAULT 1,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until       timestamptz,
  last_login_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- tracks
DO $$ BEGIN
  CREATE TYPE track_availability AS ENUM (
    'ok', 'unavailable', 'not_embeddable', 'region_blocked'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tracks (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- YouTube video IDs are exactly 11 chars from [A-Za-z0-9_-].
  youtube_id               varchar(11) NOT NULL UNIQUE
                             CHECK (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  -- YouTube's own metadata. Displayed unaltered, as the API policies require.
  title                    text NOT NULL,
  channel_title            text NOT NULL,
  channel_id               text,
  duration_sec             integer NOT NULL CHECK (duration_sec >= 0),
  thumbnail_url            text,
  -- My own additive fields. NOT substitutes for the above.
  sort_artist              text,
  note                     text,
  -- Availability, refreshed by the Phase 6 sweep.
  availability             track_availability NOT NULL DEFAULT 'ok',
  embeddable               boolean,
  privacy_status           text,
  upload_status            text,
  region_blocked           text[],
  metadata_fetched_at      timestamptz,
  availability_checked_at  timestamptz,
  added_at                 timestamptz NOT NULL DEFAULT now(),
  added_by                 uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS tracks_channel_id_idx  ON tracks (channel_id);
CREATE INDEX IF NOT EXISTS tracks_added_at_idx    ON tracks (added_at DESC);
CREATE INDEX IF NOT EXISTS tracks_title_lower_idx ON tracks (lower(title));
CREATE INDEX IF NOT EXISTS tracks_sort_artist_idx ON tracks (lower(sort_artist));
-- Oldest-first ordering for the daily availability sweep.
CREATE INDEX IF NOT EXISTS tracks_avail_checked_idx
  ON tracks (availability_checked_at NULLS FIRST);

-- ------------------------------------------------------------ playlists
CREATE TABLE IF NOT EXISTS playlists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS playlists_owner_idx ON playlists (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id uuid NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    uuid NOT NULL REFERENCES tracks(id)    ON DELETE CASCADE,
  position    integer NOT NULL CHECK (position >= 0),
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, track_id)
);
-- DEFERRABLE so a reorder can shuffle positions inside one transaction
-- without tripping the constraint mid-update.
DO $$ BEGIN
  ALTER TABLE playlist_tracks
    ADD CONSTRAINT playlist_tracks_position_uniq
    UNIQUE (playlist_id, position) DEFERRABLE INITIALLY IMMEDIATE;
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------- favourites
CREATE TABLE IF NOT EXISTS favourites (
  user_id    uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  track_id   uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);

-- --------------------------------------------------------- play_history
CREATE TABLE IF NOT EXISTS play_history (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  track_id  uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  played_at timestamptz NOT NULL DEFAULT now(),
  ms_played integer NOT NULL DEFAULT 0 CHECK (ms_played >= 0),
  completed boolean NOT NULL DEFAULT false,
  source    text
);
CREATE INDEX IF NOT EXISTS play_history_user_idx
  ON play_history (user_id, played_at DESC);

-- ------------------------------------------------- login_attempts (rate limit)
-- Keyed by email+IP so neither a single account nor a single address can be
-- used to brute-force the other.
CREATE TABLE IF NOT EXISTS login_attempts (
  id          bigserial PRIMARY KEY,
  email       citext NOT NULL,
  ip          text   NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  succeeded   boolean NOT NULL
);
CREATE INDEX IF NOT EXISTS login_attempts_lookup_idx
  ON login_attempts (email, ip, attempted_at DESC);
