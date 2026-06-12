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
