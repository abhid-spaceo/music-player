-- Substring search needs trigrams: a btree on lower(col) only serves equality
-- and prefix matches, so `%foo%` could never use the Phase 1 indexes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS tracks_title_trgm_idx
  ON tracks USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS tracks_channel_trgm_idx
  ON tracks USING gin (channel_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS tracks_sort_artist_trgm_idx
  ON tracks USING gin (sort_artist gin_trgm_ops);

-- Superseded by the trigram indexes above.
DROP INDEX IF EXISTS tracks_title_lower_idx;
DROP INDEX IF EXISTS tracks_sort_artist_idx;

-- playlists.updated_at had no trigger and no writer, so it would have equalled
-- created_at forever.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS playlists_touch_updated_at ON playlists;
CREATE TRIGGER playlists_touch_updated_at
  BEFORE UPDATE ON playlists
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
