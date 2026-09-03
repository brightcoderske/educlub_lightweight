const { query } = require("../config");

const SETTING_KEY = "billing_identity";

// Kenya's standard VAT rate. Kept as the default rather than hard-coded into
// the calculation so a rate change is one setting, not a code release.
const DEFAULT_VAT_RATE = 16;

const DEFAULTS = {
  kra_pin: "",
  vat_registered: false,
  vat_rate: DEFAULT_VAT_RATE,
  legal_name: "eduClub",
  email: "support@educlub.co.ke",
  address: "Nairobi, Kenya",
};

/**
 * Who eduClub is on a tax document. One row, because eduClub is the same
 * supplier on every invoice it issues.
 */
async function getBillingIdentity() {
  const result = await query(
    "SELECT value FROM system_settings WHERE `key` = $1",
    [SETTING_KEY],
  );
  const stored = result.rows[0]?.value;
  const value = typeof stored === "string" ? JSON.parse(stored) : stored;
  return { ...DEFAULTS, ...(value || {}) };
}

async function setBillingIdentity(patch, userId) {
  const current = await getBillingIdentity();
  const rate = Number(patch.vat_rate);

  const next = {
    ...current,
    ...patch,
    vat_registered: patch.vat_registered === true,
    vat_rate: Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : current.vat_rate,
    kra_pin: String(patch.kra_pin ?? current.kra_pin ?? "")
      .trim()
      .toUpperCase(),
  };

  await query(
    `INSERT INTO system_settings (\`key\`, value, updated_by_user_id, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (\`key\`) DO UPDATE
       SET value = EXCLUDED.value,
           updated_by_user_id = EXCLUDED.updated_by_user_id,
           updated_at = NOW()`,
    [SETTING_KEY, JSON.stringify(next), userId || null],
  );

  return next;
}

module.exports = { getBillingIdentity, setBillingIdentity, DEFAULT_VAT_RATE, SETTING_KEY };
