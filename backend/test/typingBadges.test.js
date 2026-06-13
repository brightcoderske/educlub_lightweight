const test = require("node:test");
const assert = require("node:assert/strict");

test("typing performances earn progressive badges", () => {
  const { getTypingBadge } = require("../src/services/typingBadges");

  assert.equal(getTypingBadge(9, 99).tier, "starter");
  assert.equal(getTypingBadge(20, 90).tier, "speed_builder");
  assert.equal(getTypingBadge(35, 96).tier, "keyboard_pro");
  assert.equal(getTypingBadge(50, 98).tier, "typing_champion");
});
