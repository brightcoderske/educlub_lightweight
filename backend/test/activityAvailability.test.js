const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveModuleAvailability,
  annotateActivityAvailability,
} = require("../src/services/activityAvailability.service");

test("unscheduled modules preserve existing availability", () => {
  assert.equal(resolveModuleAvailability({}).is_open, true);
});

test("scheduled modules open at the configured week and stay open", () => {
  const before = resolveModuleAvailability({
    opens_at: "2026-06-15T00:00:00.000Z",
    now: "2026-06-14T23:59:59.000Z",
  });
  const after = resolveModuleAvailability({
    opens_at: "2026-06-15T00:00:00.000Z",
    now: "2026-07-30T00:00:00.000Z",
  });
  assert.equal(before.is_open, false);
  assert.equal(after.is_open, true);
});

test("an early override opens scheduled content without completing it", () => {
  const result = resolveModuleAvailability({
    opens_at: "2026-07-01T00:00:00.000Z",
    now: "2026-06-12T00:00:00.000Z",
    has_override: true,
  });
  assert.equal(result.is_open, true);
  assert.equal(result.reason, "override");
});

test("required activities unlock progressively while try more stays optional", () => {
  const activities = annotateActivityAvailability([
    { id: 1, availability_mode: "required", status: "completed" },
    { id: 2, availability_mode: "try_more", status: "not_started" },
    { id: 3, availability_mode: "required", status: "not_started" },
    { id: 4, availability_mode: "required", status: "not_started" },
  ]);

  assert.equal(activities[1].is_unlocked, true);
  assert.equal(activities[2].is_unlocked, true);
  assert.equal(activities[3].is_unlocked, false);
  assert.equal(activities[3].prerequisite_activity_id, 3);
});
