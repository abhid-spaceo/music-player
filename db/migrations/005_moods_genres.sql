-- Moods & Genres: a fixed, admin-curated taxonomy and a track<->tag link table.

CREATE TABLE IF NOT EXISTS tags (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('mood', 'genre')),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  slug text NOT NULL,
  UNIQUE (kind, slug)
);

CREATE TABLE IF NOT EXISTS track_tags (
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  tag_id   uuid NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
  PRIMARY KEY (track_id, tag_id)
);
CREATE INDEX IF NOT EXISTS track_tags_tag_idx ON track_tags (tag_id);

-- Seed the starter taxonomy. ON CONFLICT keeps re-runs a no-op.
INSERT INTO tags (kind, name, slug) VALUES
  ('mood','Romantic','romantic'),
  ('mood','Sad','sad'),
  ('mood','Happy','happy'),
  ('mood','Party','party'),
  ('mood','Devotional','devotional'),
  ('mood','Retro','retro'),
  ('genre','Bollywood','bollywood'),
  ('genre','Ghazal','ghazal'),
  ('genre','Qawwali','qawwali'),
  ('genre','Classical','classical'),
  ('genre','Pop','pop'),
  ('genre','Rock','rock')
ON CONFLICT (kind, slug) DO NOTHING;
