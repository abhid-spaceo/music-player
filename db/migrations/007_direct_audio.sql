-- Direct-audio tracks. Background and lock-screen playback are impossible
-- through the YouTube IFrame embed — the browser refuses it a background audio
-- session — so a track may instead carry a directly-linkable audio URL that
-- plays through a real <audio> element. Both kinds coexist; existing rows are
-- all YouTube by definition.

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS source    text;

UPDATE tracks SET source = 'youtube' WHERE source IS NULL;

ALTER TABLE tracks ALTER COLUMN source SET DEFAULT 'youtube';
ALTER TABLE tracks ALTER COLUMN source SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE tracks ADD CONSTRAINT tracks_source_chk
    CHECK (source IN ('youtube', 'direct'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A direct track has no video id. The existing regex CHECK on youtube_id is
-- already NULL-safe (NULL input makes the expression NULL, which passes), and
-- Postgres treats NULLs as distinct for UNIQUE, so many direct rows coexist.
ALTER TABLE tracks ALTER COLUMN youtube_id DROP NOT NULL;

-- Exactly one audio source per row, and it must match `source`.
DO $$ BEGIN
  ALTER TABLE tracks ADD CONSTRAINT tracks_audio_source_chk
    CHECK (
      (source = 'youtube' AND youtube_id IS NOT NULL AND audio_url  IS NULL)
      OR
      (source = 'direct'  AND audio_url  IS NOT NULL AND youtube_id IS NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- https only. A http URL is blocked as mixed content on the deployed app anyway.
DO $$ BEGIN
  ALTER TABLE tracks ADD CONSTRAINT tracks_audio_url_https_chk
    CHECK (audio_url IS NULL OR audio_url ~ '^https://');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Adding the same file twice is the same mistake as adding the same video twice.
CREATE UNIQUE INDEX IF NOT EXISTS tracks_audio_url_uniq ON tracks (audio_url);
