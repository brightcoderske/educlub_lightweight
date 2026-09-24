const test = require("node:test");
const assert = require("node:assert/strict");

// Nothing here reaches a mail server. The transport is replaced before the mail
// module is loaded, so what is asserted is exactly what would have been handed
// to it: the recipient, the sender, the subject and the rendered HTML.
const nodemailer = require("nodemailer");

const outbox = [];
let refuse = null;
nodemailer.createTransport = () => ({
  async sendMail(message) {
    if (refuse && message.to === refuse.to) throw refuse.error;
    outbox.push(message);
    return { messageId: `<test-${outbox.length}@example.test>` };
  },
});

const env = require("../src/config/env");
const email = require("../src/utils/email");

const quiet = (t) => {
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});
};
const hrefs = (html) => [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
const last = () => outbox[outbox.length - 1];

// Every message the platform sends, with the details each one is built from.
const MESSAGES = [
  {
    name: "sign-in verification code",
    send: () => email.sendMFACode("anna@example.test", "482913", "Anna Mani"),
    to: "anna@example.test",
    subject: /Verification Code/i,
    contains: ["Dear Anna Mani,", "482913", "expires in 5 minutes"],
    links: [],
  },
  {
    name: "staff welcome with first-login details",
    send: () =>
      email.sendWelcomeEmail("tom@example.test", "Tom Otieno", "tom@example.test", "Temp-Pass-1"),
    to: "tom@example.test",
    subject: /Welcome to eduClub/i,
    contains: ["Dear Tom Otieno,", "Temp-Pass-1", "tom@example.test"],
    links: [env.frontendUrl],
  },
  {
    name: "password reset link",
    send: () =>
      email.sendPasswordResetLinkEmail(
        "admin@example.test",
        "Admin User",
        `${env.frontendUrl}/authentication/set-password?token=abc123`,
        30,
      ),
    to: "admin@example.test",
    subject: /Reset your password/i,
    contains: ["Dear Admin User,", "expires in 30 minutes", "can only be used once"],
    links: [`${env.frontendUrl}/authentication/set-password?token=abc123`],
  },
  {
    name: "learner registration welcome",
    send: () =>
      email.sendLearnerRegistrationWelcomeEmail({
        email: "kevin@example.test",
        learnerName: "Kevin Mwangi",
        parentName: "Grace Mwangi",
      }),
    to: "kevin@example.test",
    subject: /Your learner account is ready/i,
    contains: ["Dear Kevin Mwangi,", "parental consent from Grace Mwangi"],
    links: [`${env.frontendUrl}/authentication/sign-in`],
  },
  {
    name: "new learner notice to system admins",
    send: () =>
      email.sendLearnerRegistrationAdminEmail({
        to: "sysadmin@example.test",
        learnerName: "Kevin Mwangi",
        learnerEmail: "kevin@example.test",
        schoolName: "Rift Valley Academy",
        grade: "7",
        parentName: "Grace Mwangi",
        parentPhone: "+254700000000",
      }),
    to: "sysadmin@example.test",
    subject: /New learner self-registration/i,
    contains: ["Kevin Mwangi", "kevin@example.test", "Rift Valley Academy", "Grace Mwangi", "+254700000000"],
    links: [],
  },
];

for (const message of MESSAGES) {
  test(`${message.name} is addressed, worded and linked correctly`, async (t) => {
    quiet(t);
    const before = outbox.length;

    assert.equal(await message.send(), true, "the mailer reports it as sent");
    assert.equal(outbox.length, before + 1, "exactly one message is handed to the transport");

    const sent = last();
    assert.equal(sent.to, message.to);
    assert.match(sent.subject, message.subject);
    assert.equal(sent.from, email.getMailDefaults().from);

    for (const text of message.contains) {
      assert.ok(sent.html.includes(text), `the message should contain ${JSON.stringify(text)}`);
    }
    // A template fed the wrong field names renders "undefined" rather than failing.
    assert.doesNotMatch(sent.html, /undefined|\bnull\b|\[object /);
    assert.deepEqual(hrefs(sent.html), message.links);
    for (const link of hrefs(sent.html)) {
      assert.match(link, /^https?:\/\//, "links must be absolute");
    }
  });
}

test("the messages are sent as the configured sender, with the configured Reply-To", async (t) => {
  quiet(t);
  await email.sendMFACode("anna@example.test", "111111", "Anna");

  const defaults = email.getMailDefaults();
  assert.equal(last().from, defaults.from);
  assert.equal(last().replyTo, defaults.replyTo);
});

test("text typed by a stranger is escaped, never sent as markup", async (t) => {
  quiet(t);
  // The learner and parent fields come from a public form and land in a message
  // that arrives from eduClub's own address, addressed to every system admin.
  await email.sendLearnerRegistrationAdminEmail({
    to: "sysadmin@example.test",
    learnerName: "<img src=x onerror=alert(1)>",
    learnerEmail: '"><a href="https://evil.example">x</a>@e.test',
    schoolName: "Rift <b>Valley</b> School",
    grade: "7",
    parentName: 'Please <a href="https://evil.example/login">verify your admin account</a>',
    parentPhone: "+254700000000",
  });
  const { html } = last();

  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<a href="https:\/\/evil\.example/);
  assert.doesNotMatch(html, /<b>Valley/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(
    html,
    /Please &lt;a href=&quot;https:\/\/evil\.example\/login&quot;&gt;verify your admin account&lt;\/a&gt;/,
  );
  // The template has no links of its own here, so any link would be the attacker's.
  assert.deepEqual(hrefs(html), []);
});

test("names are escaped in every message that quotes them", async (t) => {
  quiet(t);
  const name = "<script>alert(1)</script> & Co";

  await email.sendMFACode("a@example.test", "123456", name);
  await email.sendWelcomeEmail("a@example.test", name, name, name);
  await email.sendPasswordResetLinkEmail("a@example.test", name, `${env.frontendUrl}/x`, 30);
  await email.sendLearnerRegistrationWelcomeEmail({
    email: "a@example.test",
    learnerName: name,
    parentName: name,
  });

  for (const sent of outbox.slice(-4)) {
    assert.doesNotMatch(sent.html, /<script>/, `${sent.subject} must not carry the script tag`);
    assert.match(sent.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; Co/);
  }
});

test("a message the server refuses is reported as not sent, with the reason kept", async (t) => {
  quiet(t);
  const before = outbox.length;
  refuse = {
    to: "refused@example.test",
    error: Object.assign(new Error("Invalid login: 535 Incorrect authentication data"), {
      code: "EAUTH",
    }),
  };

  try {
    assert.equal(await email.sendMFACode("refused@example.test", "123456", "Anna"), false);
  } finally {
    refuse = null;
  }

  assert.equal(outbox.length, before, "nothing was handed on");
  assert.equal(email.getLastEmailFailure().code, "EAUTH");
  assert.equal(email.getLastEmailFailure().to, "refused@example.test");
});

test("a message with no recipient is reported as not sent instead of throwing", async (t) => {
  quiet(t);
  refuse = { to: null, error: Object.assign(new Error("No recipients defined"), { code: "EENVELOPE" }) };
  try {
    assert.equal(await email.sendMFACode(null, "123456", "Anna"), false);
  } finally {
    refuse = null;
  }
  assert.equal(email.getLastEmailFailure().code, "EENVELOPE");
});
