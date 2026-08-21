CREATE TABLE IF NOT EXISTS comments (
  comment_id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  parent_id TEXT,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  content_fingerprint TEXT NOT NULL,
  rating INTEGER,
  likes INTEGER NOT NULL DEFAULT 0,
  dislikes INTEGER NOT NULL DEFAULT 0,
  country_code TEXT NOT NULL DEFAULT 'XX',
  status TEXT NOT NULL DEFAULT 'published',
  created_at INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES comments(comment_id) ON DELETE CASCADE,
  CHECK (length(game_id) BETWEEN 1 AND 64),
  CHECK (length(visitor_id) = 36),
  CHECK (length(author) BETWEEN 1 AND 40),
  CHECK (length(content) BETWEEN 1 AND 1000),
  CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  CHECK (likes >= 0),
  CHECK (dislikes >= 0),
  CHECK (status IN ('published', 'hidden'))
);

CREATE INDEX IF NOT EXISTS idx_comments_game_roots
  ON comments (game_id, status, parent_id, created_at DESC, comment_id DESC);

CREATE INDEX IF NOT EXISTS idx_comments_parent
  ON comments (parent_id, status, created_at ASC, comment_id ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_comments_daily_duplicate
  ON comments (visitor_id, day_key, content_fingerprint);

CREATE TABLE IF NOT EXISTS comment_daily_usage (
  visitor_id TEXT NOT NULL,
  day_key TEXT NOT NULL,
  comment_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (visitor_id, day_key),
  CHECK (comment_count BETWEEN 0 AND 3)
);

CREATE TABLE IF NOT EXISTS comment_reactions (
  comment_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  reaction TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (comment_id, visitor_id),
  FOREIGN KEY (comment_id) REFERENCES comments(comment_id) ON DELETE CASCADE,
  CHECK (reaction IN ('like', 'dislike'))
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_visitor
  ON comment_reactions (visitor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS comment_game_stats (
  game_id TEXT PRIMARY KEY,
  comment_count INTEGER NOT NULL DEFAULT 0,
  root_count INTEGER NOT NULL DEFAULT 0,
  rating_sum INTEGER NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  CHECK (comment_count >= 0),
  CHECK (root_count >= 0),
  CHECK (rating_sum >= 0),
  CHECK (rating_count >= 0)
);
