-- Preserve yesterday's winning total alongside its podium rank.
ALTER TABLE leaderboard_rank_snapshots
ADD COLUMN previous_day_wins INTEGER NOT NULL DEFAULT 0
CHECK (previous_day_wins >= 0);

-- Rank snapshots are derived data. Rebuild them so the new field is populated
-- immediately instead of waiting for the normal snapshot TTL.
DELETE FROM leaderboard_rank_snapshots;
DELETE FROM leaderboard_snapshot_state;
