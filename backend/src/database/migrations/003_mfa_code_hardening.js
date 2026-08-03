module.exports = {
  async up(client) {
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_code_hash VARCHAR(64);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_code_attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_code_created_at TIMESTAMPTZ;
      UPDATE users SET mfa_code = NULL WHERE mfa_code IS NOT NULL;
    `);
  },
};
