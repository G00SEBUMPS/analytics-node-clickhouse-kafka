CREATE TABLE rate_limit_counters (
  api_key_id UUID NOT NULL REFERENCES api_keys(id),
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (api_key_id, window_start)
);

-- Add index for faster lookups
CREATE INDEX rate_limit_counters_window_idx ON rate_limit_counters (api_key_id, window_start DESC);

-- Add automatic updated_at updates
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON rate_limit_counters
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();