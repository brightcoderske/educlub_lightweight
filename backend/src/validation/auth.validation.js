const { z } = require("zod");

const password = z.string().min(8).max(128);
const identifier = z.string().trim().min(3).max(255).transform((value) =>
  value.includes("@") ? value.toLowerCase() : value,
);
const deviceName = z.string().trim().min(1).max(255).optional();

const login = z.strictObject({
  email: identifier,
  password,
  trustedDeviceToken: z.string().min(32).max(256).nullable().optional(),
  deviceName,
});

const verifyMfa = z.strictObject({
  tempToken: z.string().min(20).max(4096),
  code: z.string().regex(/^\d{6}$/, "Enter the six-digit verification code."),
  rememberDevice: z.boolean().optional().default(false),
  deviceName,
});

const passwordResetRequest = z.strictObject({ email: identifier });
const passwordResetConfirm = z.strictObject({
  token: z.string().min(32).max(256),
  newPassword: password,
});
const passwordChange = z.strictObject({ oldPassword: password, newPassword: password });
const adminPasswordReset = z.strictObject({
  userId: z.coerce.number().int().positive(),
  newPassword: password,
});
const refresh = z.strictObject({
  refreshToken: z.string().min(32).max(256).optional(),
  deviceName,
});
const mfaPolicy = z.strictObject({
  system_admin: z.boolean().optional(),
  school_admin: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide at least one policy setting.");

module.exports = {
  login,
  verifyMfa,
  passwordResetRequest,
  passwordResetConfirm,
  passwordChange,
  adminPasswordReset,
  refresh,
  mfaPolicy,
};
