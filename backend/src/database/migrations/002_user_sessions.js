module.exports = {
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,
        token_family_id UUID NOT NULL,
        device_name VARCHAR(255),
        ip_address INET,
        user_agent TEXT,
        last_used_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        revoke_reason VARCHAR(255),
        replaced_by_session_id BIGINT REFERENCES user_sessions(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
        ON user_sessions(user_id, expires_at DESC) WHERE revoked_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_user_sessions_family
        ON user_sessions(token_family_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry
        ON user_sessions(expires_at) WHERE revoked_at IS NULL;
    `);
  },
};
