CREATE TABLE IF NOT EXISTS game_engagement_stats (
  game_id TEXT PRIMARY KEY,
  play_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  dislike_count INTEGER NOT NULL DEFAULT 0,
  favorite_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  CHECK (length(game_id) BETWEEN 1 AND 64),
  CHECK (play_count >= 0),
  CHECK (like_count >= 0),
  CHECK (dislike_count >= 0),
  CHECK (favorite_count >= 0)
);

CREATE TABLE IF NOT EXISTS game_visitor_engagement (
  game_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  reaction TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  last_play_at INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (game_id, visitor_id),
  CHECK (length(game_id) BETWEEN 1 AND 64),
  CHECK (length(visitor_id) = 36),
  CHECK (reaction IS NULL OR reaction IN ('like', 'dislike')),
  CHECK (is_favorite IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_game_visitor_engagement_visitor
  ON game_visitor_engagement (visitor_id, updated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_game_visitor_engagement_insert
AFTER INSERT ON game_visitor_engagement
BEGIN
  INSERT INTO game_engagement_stats (
    game_id,
    play_count,
    like_count,
    dislike_count,
    favorite_count,
    updated_at
  ) VALUES (
    NEW.game_id,
    CASE WHEN NEW.last_play_at IS NULL THEN 0 ELSE 1 END,
    CASE WHEN NEW.reaction = 'like' THEN 1 ELSE 0 END,
    CASE WHEN NEW.reaction = 'dislike' THEN 1 ELSE 0 END,
    NEW.is_favorite,
    NEW.updated_at
  )
  ON CONFLICT (game_id) DO UPDATE SET
    play_count = game_engagement_stats.play_count + excluded.play_count,
    like_count = game_engagement_stats.like_count + excluded.like_count,
    dislike_count = game_engagement_stats.dislike_count + excluded.dislike_count,
    favorite_count = game_engagement_stats.favorite_count + excluded.favorite_count,
    updated_at = excluded.updated_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_game_visitor_engagement_update
AFTER UPDATE OF reaction, is_favorite, last_play_at ON game_visitor_engagement
BEGIN
  INSERT OR IGNORE INTO game_engagement_stats (
    game_id,
    play_count,
    like_count,
    dislike_count,
    favorite_count,
    updated_at
  ) VALUES (NEW.game_id, 0, 0, 0, 0, NEW.updated_at);

  UPDATE game_engagement_stats
  SET
    play_count = MAX(
      0,
      play_count + CASE
        WHEN NEW.last_play_at IS NOT OLD.last_play_at
          AND NEW.last_play_at IS NOT NULL
        THEN 1 ELSE 0
      END
    ),
    like_count = MAX(
      0,
      like_count
        + CASE WHEN NEW.reaction = 'like' THEN 1 ELSE 0 END
        - CASE WHEN OLD.reaction = 'like' THEN 1 ELSE 0 END
    ),
    dislike_count = MAX(
      0,
      dislike_count
        + CASE WHEN NEW.reaction = 'dislike' THEN 1 ELSE 0 END
        - CASE WHEN OLD.reaction = 'dislike' THEN 1 ELSE 0 END
    ),
    favorite_count = MAX(0, favorite_count + NEW.is_favorite - OLD.is_favorite),
    updated_at = NEW.updated_at
  WHERE game_id = NEW.game_id;
END;
