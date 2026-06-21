const axios = require("axios");
const crypto = require("crypto");
const env = require("../config/env");

function isConfigured() {
  return Boolean(env.flutterwaveSecretKey);
}

function isWebhookConfigured() {
  return Boolean(env.flutterwaveWebhookSecretHash);
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function isValidWebhookSignature({ rawBody, signature, legacyHash }) {
  if (!isWebhookConfigured()) {
    return false;
  }

  if (signature && rawBody) {
    const expectedSignature = crypto
      .createHmac("sha256", env.flutterwaveWebhookSecretHash)
      .update(rawBody)
      .digest("hex");

    return safeCompare(signature, expectedSignature);
  }

  if (legacyHash) {
    return safeCompare(legacyHash, env.flutterwaveWebhookSecretHash);
  }

  return false;
}

function client() {
  if (!isConfigured()) {
    throw new Error("Flutterwave is not configured.");
  }

  return axios.create({
    baseURL: env.flutterwaveBaseUrl,
    headers: {
      Authorization: `Bearer ${env.flutterwaveSecretKey}`,
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });
}

async function createPaymentLink({
  txRef,
  amount,
  currency,
  customer,
  redirectUrl,
  metadata,
  title,
  description,
}) {
  const response = await client().post("/payments", {
    tx_ref: txRef,
    amount,
    currency,
    redirect_url: redirectUrl,
    customer,
    customizations: {
      title: title || "eduClub Payment",
      description:
        description ||
        metadata?.competitionName ||
        metadata?.courseName ||
        "eduClub access",
    },
    meta: metadata,
  });

  const link = response.data?.data?.link;
  if (!link) {
    throw new Error("Flutterwave did not return a payment link.");
  }
  try {
    const parsed = new URL(link);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Unsupported payment link protocol.");
    }
  } catch (error) {
    throw new Error("Flutterwave returned an invalid payment link.");
  }

  return { link, raw: response.data };
}

async function verifyTransaction(transactionId) {
  const response = await client().get(`/transactions/${transactionId}/verify`);
  return response.data;
}

module.exports = {
  isConfigured,
  isWebhookConfigured,
  createPaymentLink,
  verifyTransaction,
  isValidWebhookSignature,
};
