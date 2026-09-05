-- Per-day YouTube Data API quota accounting. One row per Pacific-time calendar
-- date; a new date is a fresh row, so the daily reset is implicit. Incremented
-- on every real API call (videos.list / playlistItems.list) via recordQuota().
CREATE TABLE IF NOT EXISTS quota_usage (
  pt_date     date PRIMARY KEY,
  units_spent integer NOT NULL DEFAULT 0
);
