const test = require("node:test");
const assert = require("node:assert/strict");

const { getBadgeTier } = require("../src/services/moduleBadges.service");

test("module badge boundaries follow the approved motivational tiers", () => {
  assert.equal(getBadgeTier(70.99).tier, "completion");
  assert.equal(getBadgeTier(71).tier, "bronze");
  assert.equal(getBadgeTier(80).tier, "bronze");
  assert.equal(getBadgeTier(80.01).tier, "silver");
  assert.equal(getBadgeTier(90).tier, "silver");
  assert.equal(getBadgeTier(90.01).tier, "gold");
  assert.equal(getBadgeTier(100).color, "#d4af37");
});
