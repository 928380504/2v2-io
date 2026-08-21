CREATE INDEX IF NOT EXISTS match_events_revenge_idx
  ON match_events (
    profile_id,
    opponent_network_user_id,
    occurred_at DESC,
    event_id DESC
  )
  WHERE
    mode_key = '1v1'
    AND opponent_network_user_id IS NOT NULL;
