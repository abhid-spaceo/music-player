-- Fixes from the Phase 1 review.

-- The constraint was DEFERRABLE INITIALLY IMMEDIATE, which still trips on a
-- row-by-row position swap unless the caller remembers SET CONSTRAINTS ALL
-- DEFERRED. INITIALLY DEFERRED makes it behave as its comment always claimed,
-- with no caller discipline required.
ALTER TABLE playlist_tracks
  DROP CONSTRAINT IF EXISTS playlist_tracks_position_uniq;
ALTER TABLE playlist_tracks
  ADD CONSTRAINT playlist_tracks_position_uniq
  UNIQUE (playlist_id, position) DEFERRABLE INITIALLY DEFERRED;

-- Postgres does not index the referencing side of a foreign key, so deleting a
-- track sequentially scanned all three of these. Three avoidable scans on a
-- compute-metered database.
CREATE INDEX IF NOT EXISTS playlist_tracks_track_idx ON playlist_tracks (track_id);
CREATE INDEX IF NOT EXISTS favourites_track_idx      ON favourites (track_id);
CREATE INDEX IF NOT EXISTS play_history_track_idx    ON play_history (track_id);

-- Matches the library read's ORDER BY added_at DESC, id DESC.
CREATE INDEX IF NOT EXISTS tracks_added_at_id_idx ON tracks (added_at DESC, id DESC);
DROP INDEX IF EXISTS tracks_added_at_idx;
