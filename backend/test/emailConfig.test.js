const test = require("node:test");
const assert = require("node:assert/strict");

const { buildMailDefaults } = require("../src/utils/emailConfig");

test("transactional email uses the configured sender and support reply address", () => {
  assert.deepEqual(
    buildMailDefaults({
      emailFrom: "eduClub <noreply@educlub.co.ke>",
      emailReplyTo: "support@educlub.co.ke",
    }),
    {
      from: "eduClub <noreply@educlub.co.ke>",
      replyTo: "support@educlub.co.ke",
    },
  );
});

const { resolveMailIdentity, buildTransportOptions } = require("../src/utils/emailConfig");

test("a From address the mail account cannot authenticate for is moved to Reply-To", () => {
  // Gmail signs mail for the account that logged in. Sending as another domain
  // is accepted by the transport and then filed as spam or refused by the
  // receiving server, which is what "our emails never arrive" looks like.
  const identity = resolveMailIdentity({
    emailFrom: "eduClub <noreply@educlub.com>",
    emailUser: "school@gmail.com",
    emailReplyTo: "",
  });

  assert.equal(identity.aligned, false);
  assert.equal(identity.from, "eduClub <school@gmail.com>");
  assert.equal(identity.replyTo, "noreply@educlub.com");
});

test("a From address that is the authenticated mailbox is left exactly as configured", () => {
  const identity = resolveMailIdentity({
    emailFrom: "eduClub <school@gmail.com>",
    emailUser: "School@Gmail.com",
    emailReplyTo: "support@educlub.co.ke",
  });

  assert.equal(identity.aligned, true);
  assert.equal(identity.from, "eduClub <school@gmail.com>");
  assert.equal(identity.replyTo, "support@educlub.co.ke");
});

test("app passwords keep working when they are pasted with the spaces the provider shows", () => {
  const options = buildTransportOptions({
    emailHost: "smtp.gmail.com",
    emailPort: 465,
    emailSecure: true,
    emailUser: "school@gmail.com",
    emailPassword: "abcd efgh ijkl mnop",
  });

  assert.equal(options.auth.pass, "abcdefghijklmnop");
});

test("a cPanel mailbox sends as itself, with nothing rewritten", () => {
  // The normal setup: EMAIL_USER and EMAIL_FROM are the same mailbox on the
  // domain the host signs mail for.
  const identity = resolveMailIdentity({
    emailFrom: "eduClub <noreply@educlub.co.ke>",
    emailUser: "noreply@educlub.co.ke",
    emailReplyTo: "support@educlub.co.ke",
  });

  assert.equal(identity.aligned, true);
  assert.equal(identity.from, "eduClub <noreply@educlub.co.ke>");
});

test("authenticating as one mailbox and sending as another on the same domain is left alone", () => {
  // SPF, DKIM and DMARC all align on the domain, not the mailbox, so this is
  // legitimate and must not be rewritten.
  const identity = resolveMailIdentity({
    emailFrom: "eduClub <noreply@educlub.co.ke>",
    emailUser: "support@educlub.co.ke",
    emailReplyTo: "",
  });

  assert.equal(identity.aligned, true);
  assert.equal(identity.from, "eduClub <noreply@educlub.co.ke>");
});

test("EMAIL_ALLOW_UNALIGNED_FROM sends exactly what was configured", () => {
  const identity = resolveMailIdentity({
    emailFrom: "eduClub <noreply@educlub.com>",
    emailUser: "someone@gmail.com",
    emailAllowUnalignedFrom: true,
  });

  assert.equal(identity.from, "eduClub <noreply@educlub.com>");
});

test("TLS settings for shared hosting come from the environment", () => {
  const options = buildTransportOptions({
    emailHost: "mail.educlub.co.ke",
    emailPort: 587,
    emailSecure: false,
    emailRequireTls: true,
    emailTlsServername: "server17.hostafrica.co.za",
    emailUser: "noreply@educlub.co.ke",
    emailPassword: "secret",
    emailTlsRejectUnauthorized: true,
  });

  assert.equal(options.requireTLS, true);
  assert.deepEqual(options.tls, { servername: "server17.hostafrica.co.za" });

  // Nothing is added when the environment says nothing, so a plain
  // host/port/user/password configuration stays plain.
  const plain = buildTransportOptions({
    emailHost: "mail.educlub.co.ke",
    emailPort: 465,
    emailSecure: true,
    emailUser: "noreply@educlub.co.ke",
    emailPassword: "secret",
    emailTlsRejectUnauthorized: true,
  });
  assert.equal(plain.tls, undefined);
  assert.equal(plain.requireTLS, undefined);
});
