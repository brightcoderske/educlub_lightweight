const { query } = require("../config");
const policy = require("../config/privacyPolicy");

async function getConsentStatus(userId) {
  const result = await query(
    `SELECT id, policy_version, consented_at
     FROM user_consents
     WHERE user_id = $1 AND policy_version = $2`,
    [userId, policy.version],
  );

  const consent = result.rows[0] || null;

  return {
    policy,
    required: !consent,
    consent,
  };
}

async function hasCurrentConsent(userId) {
  const status = await getConsentStatus(userId);
  return !status.required;
}

async function acceptConsent(userId, ipAddress, userAgent, metadata = {}) {
  const consentText = {
    ...policy,
    metadata,
  };

  const result = await query(
    `INSERT INTO user_consents (
       user_id, policy_version, policy_title, ip_address, user_agent, consent_text
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, policy_version)
     DO UPDATE SET
       consented_at = CURRENT_TIMESTAMP,
       ip_address = EXCLUDED.ip_address,
       user_agent = EXCLUDED.user_agent,
       consent_text = EXCLUDED.consent_text
     RETURNING id, user_id, policy_version, policy_title, consented_at`,
    [
      userId,
      policy.version,
      policy.title,
      ipAddress || null,
      userAgent || null,
      JSON.stringify(consentText),
    ],
  );

  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
     VALUES ($1, 'privacy_consent_accepted', 'user_consent', $2, $3, $4)`,
    [
      userId,
      result.rows[0].id,
      JSON.stringify({
        policyVersion: policy.version,
        policyTitle: policy.title,
        metadata,
      }),
      ipAddress || null,
    ],
  );

  return result.rows[0];
}

module.exports = {
  getConsentStatus,
  hasCurrentConsent,
  acceptConsent,
};
