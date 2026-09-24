const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  claimRow,
  differingFields,
  freePosition,
  normalizeTitle,
  sameValue,
  MODULE_FIELDS,
  ACTIVITY_FIELDS,
} = require("../src/services/courseSync");

// A school course built by hand, or loaded from the SQL imports and pointed at
// a template afterwards, has no template_module_id on anything. Sync recognised
// nothing, inserted the whole template beside what was there, and did it again
// on the next press - while grades and progress stayed on the originals.
test("an unlinked module is recognised by its title, so sync updates it instead of cloning it", () => {
  const school = [
    { id: 11, title: "Module 1 - My First Web Page", position: 1, template_module_id: null },
  ];

  const match = claimRow(
    { id: 501, title: "module 1 -  my first web page", position: 7 },
    school,
    "template_module_id",
  );

  assert.equal(match.row.id, 11);
  assert.equal(match.matchedBy, "title");
});

test("a module already linked is matched by the link, whatever its title now says", () => {
  const school = [
    { id: 11, title: "Renamed by the school", position: 4, template_module_id: 501 },
  ];

  const match = claimRow({ id: 501, title: "Module 1", position: 1 }, school, "template_module_id");

  assert.equal(match.matchedBy, "link");
  assert.equal(match.row.id, 11);
});

test("position is the last resort, and only for a row with no link of its own", () => {
  const school = [
    { id: 11, title: "Something else entirely", position: 2, template_module_id: null },
    { id: 12, title: "Also different", position: 3, template_module_id: 999 },
  ];

  assert.equal(
    claimRow({ id: 501, title: "Module 2", position: 2 }, school, "template_module_id").matchedBy,
    "position",
  );
  // 12 is spoken for by template module 999, so nothing may take it by position.
  assert.equal(claimRow({ id: 502, title: "Module 3", position: 3 }, school, "template_module_id"), null);
});

test("one school row cannot be claimed by two template rows", () => {
  const school = [{ id: 11, title: "Module 1", position: 1, template_module_id: null }];

  assert.equal(claimRow({ id: 501, title: "Module 1", position: 1 }, school, "template_module_id").row.id, 11);
  assert.equal(claimRow({ id: 502, title: "Module 1", position: 1 }, school, "template_module_id"), null);
});

test("nothing is rewritten when nothing differs", () => {
  const templateActivity = {
    title: "Build it",
    activity_type: "coding",
    content: { rich_html: "<p>hello</p>" },
    points: 10,
    is_required: true,
    availability_mode: "required",
    completion_rule: "submitted",
    pass_score: null,
    is_published: true,
  };
  // MySQL hands back JSON parsed and booleans as 1/0; the template row holds a
  // string and a real boolean. Comparing them naively rewrote every activity on
  // every sync.
  const schoolActivity = {
    ...templateActivity,
    content: JSON.stringify(templateActivity.content),
    is_required: 1,
    is_published: 1,
  };

  assert.deepEqual(differingFields(schoolActivity, templateActivity, ACTIVITY_FIELDS), []);
  assert.deepEqual(
    differingFields({ ...schoolActivity, points: 20 }, templateActivity, ACTIVITY_FIELDS),
    ["points"],
  );
});

test("a module the school renamed is reported as changed", () => {
  const templateModule = {
    title: "Module 1",
    description: "The first one",
    learning_outcomes: ["a"],
    is_published: true,
    unlock_at: null,
  };
  const schoolModule = { ...templateModule, title: "Module One", learning_outcomes: '["a"]', is_published: 1 };

  assert.deepEqual(differingFields(schoolModule, templateModule, MODULE_FIELDS), ["title"]);
});

test("a new row takes the template position when it is free, and the end when it is not", () => {
  assert.equal(freePosition([{ position: 1 }, { position: 2 }], 3), 3);
  assert.equal(freePosition([{ position: 1 }, { position: 2 }], 2), 3);
});

test("titles differing only in spacing and case are the same title", () => {
  assert.equal(normalizeTitle("  Module 1 -  Intro "), normalizeTitle("module 1 - intro"));
  assert.notEqual(normalizeTitle("Module 1"), normalizeTitle("Module 2"));
});

test("empty and missing values compare equal, so an absent description is not a change", () => {
  assert.equal(sameValue(null, undefined), true);
  assert.equal(sameValue(null, ""), false);
  assert.equal(sameValue(0, false), true);
});

// The guard is the difference between a bad sync and a doubled course, and it
// sits inside the transaction so the whole sync is undone.
test("sync refuses to commit a course holding more template modules than the template has", () => {
  const service = fs.readFileSync(
    path.join(__dirname, "..", "src/services/courseTemplates.service.js"),
    "utf8",
  );

  assert.match(service, /Sync aborted: the course would hold/);
  assert.match(service, /withTransaction\(\(client\) => applySync\(/);
  assert.match(service, /summary\.notInTemplate/);
});
