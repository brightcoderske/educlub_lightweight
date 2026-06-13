const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildTemplateLearningOverview,
  buildTemplateModuleLearning,
} = require("../src/services/courseTemplatePreview");

const builder = {
  template: {
    id: 7,
    name: "Scratch Explorer",
    description: "A progressive Scratch course.",
  },
  modules: [
    {
      id: 21,
      title: "First Steps",
      description: "Start here.",
      position: 1,
      is_published: true,
      activities: [
        {
          id: 101,
          title: "Watch and notice",
          activity_type: "lesson",
          content: { body: "Observe the stage." },
          points: 5,
          position: 1,
          availability_mode: "required",
          is_published: true,
        },
        {
          id: 102,
          title: "Build it",
          activity_type: "project",
          content: { instructions: ["Create a sprite."] },
          points: 10,
          position: 2,
          availability_mode: "required",
          is_published: true,
        },
        {
          id: 103,
          title: "Try More",
          activity_type: "project",
          content: { instructions: ["Add a sound."] },
          points: 0,
          position: 3,
          availability_mode: "try_more",
          is_published: true,
        },
        {
          id: 104,
          title: "Draft activity",
          activity_type: "lesson",
          content: {},
          points: 0,
          position: 4,
          availability_mode: "required",
          is_published: false,
        },
      ],
    },
    {
      id: 22,
      title: "Draft module",
      position: 2,
      is_published: false,
      activities: [],
    },
  ],
};

test("template preview produces learner-shaped, read-only sequencing", () => {
  const overview = buildTemplateLearningOverview(builder);

  assert.equal(overview.course.id, 7);
  assert.equal(overview.learner, null);
  assert.equal(overview.modules.length, 1);
  assert.equal(overview.modules[0].activities.length, 3);
  assert.equal(overview.modules[0].activities[0].status, "not_started");
  assert.equal(overview.modules[0].activities[0].is_unlocked, true);
  assert.equal(overview.modules[0].activities[1].is_unlocked, false);
  assert.equal(overview.modules[0].activities[2].is_unlocked, true);
  assert.equal(overview.summary.total_activities, 2);
  assert.equal(overview.summary.completed_activities, 0);
});

test("template module preview includes adjacent module navigation", () => {
  const secondPublishedModule = {
    id: 23,
    title: "Next Steps",
    position: 3,
    is_published: true,
    activities: [],
  };
  const moduleLearning = buildTemplateModuleLearning(
    { ...builder, modules: [...builder.modules, secondPublishedModule] },
    21,
  );

  assert.equal(moduleLearning.module.id, 21);
  assert.equal(moduleLearning.previous_module, null);
  assert.equal(moduleLearning.next_module.id, 23);
  assert.equal(moduleLearning.next_module.is_open, true);
  assert.equal(moduleLearning.feedback, null);
  assert.equal(moduleLearning.badge, null);
});
