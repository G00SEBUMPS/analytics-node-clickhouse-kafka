-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    allowed_ips TEXT[],
    rate_limit_requests INTEGER NOT NULL,
    rate_limit_window INTEGER NOT NULL, -- in seconds
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create rate limiting table to track request counts
CREATE TABLE IF NOT EXISTS rate_limits (
    api_key_id UUID REFERENCES api_keys(id),
    client_ip TEXT NOT NULL,
    request_time TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (api_key_id, client_ip, request_time)
);

-- Create index for rate limit cleanup
CREATE INDEX idx_rate_limits_time ON rate_limits(request_time);

-- Create function to clean old rate limit entries
CREATE OR REPLACE FUNCTION cleanup_rate_limits() RETURNS void AS $$
BEGIN
    DELETE FROM rate_limits 
    WHERE request_time < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;