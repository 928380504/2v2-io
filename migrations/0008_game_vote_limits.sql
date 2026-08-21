CREATE TABLE IF NOT EXISTS game_engagement_vote_usage (
  game_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  like_votes INTEGER NOT NULL DEFAULT 0 CHECK (like_votes BETWEEN 0 AND 5),
  dislike_votes INTEGER NOT NULL DEFAULT 0 CHECK (dislike_votes BETWEEN 0 AND 5),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (game_id, visitor_id)
);
