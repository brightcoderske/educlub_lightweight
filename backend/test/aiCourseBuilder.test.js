const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf8");
}

test("AI course builder routes keep templates system-admin while activity authoring supports staff", () => {
  const routes = read("../src/routes/ai.routes.js");
  const controller = read("../src/controllers/ai.controller.js");

  assert.match(
    routes,
    /router\.post\([\s\S]*"\/course-builder\/generate"[\s\S]*requireRole\("system_admin"\)/,
  );
  assert.match(
    routes,
    /router\.post\([\s\S]*"\/course-builder\/apply"[\s\S]*requireRole\("system_admin"\)/,
  );
  assert.match(controller, /generateCourseBuilderDraft/);
  assert.match(controller, /applyCourseBuilderDraft/);
  assert.match(
    routes,
    /router\.post\([\s\S]*"\/course-builder\/activity"[\s\S]*requireRole\("system_admin", "school_admin", "teacher"\)/,
  );
  assert.match(controller, /generateActivityContentDraft/);
});

test("AI course prompt is child-safe, objective-aware, and JSON-only", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    previousDatabaseUrl || "postgres://user:pass@localhost:5432/test";
  delete require.cache[
    require.resolve("../src/services/aiCourseBuilder.service")
  ];
  const {
    buildCourseBuilderMessages,
  } = require("../src/services/aiCourseBuilder.service");

  const messages = buildCourseBuilderMessages({
    template: { name: "Computer Basics", target_level: "Grade 4" },
    mode: "full_course",
    objective: "Teach safe internet use",
    learner_age: "9-11",
    module_count: 2,
    activities_per_module: 4,
  });
  const prompt = messages.map((message) => message.content).join("\n");

  assert.match(prompt, /JSON only/i);
  assert.match(prompt, /child-safe/i);
  assert.match(prompt, /age/i);
  assert.match(prompt, /objective/i);
  assert.match(prompt, /progressive/i);
  assert.match(prompt, /try-more/i);
  assert.match(prompt, /step by step/i);
  assert.match(prompt, /project-based/i);
  assert.match(prompt, /interactive/i);
  assert.match(prompt, /lightweight/i);
  assert.match(prompt, /visuals/i);
  assert.match(prompt, /click-to-reveal/i);
  assert.match(prompt, /flashcards/i);
  assert.match(prompt, /checkboxes/i);
  assert.match(prompt, /slide-style/i);
  assert.match(prompt, /eduClub-safe/i);
  assert.match(
    prompt,
    /completion_rule must be one of manual, viewed, scrolled, submitted, graded, score_at_least/i,
  );
  assert.match(prompt, /learning_objectives must be specific/i);

  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test("AI course drafts are normalized into safe template module and activity shapes", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    previousDatabaseUrl || "postgres://user:pass@localhost:5432/test";
  delete require.cache[
    require.resolve("../src/services/aiCourseBuilder.service")
  ];
  const {
    normalizeCourseDraft,
  } = require("../src/services/aiCourseBuilder.service");

  const draft = normalizeCourseDraft({
    title: "Fun Computing",
    modules: [
      {
        title: "Start",
        learning_outcomes: ["Use a mouse"],
        activities: [
          {
            title: "Click practice",
            activity_type: "lesson",
            points: 0,
            content: {
              body: "<script>alert(1)</script><p>Practice clicking.</p>",
            },
          },
          {
            title: "Check",
            activity_type: "quiz",
            points: 5,
            content: {
              questions: [
                {
                  prompt: "A mouse helps you point.",
                  question_type: "true_false",
                  correct_answer: "true",
                  points: 1,
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(draft.modules.length, 1);
  assert.equal(draft.modules[0].position, 1);
  assert.equal(draft.modules[0].activities[0].position, 1);
  assert.equal(draft.modules[0].activities[0].completion_rule, "manual");
  assert.equal(
    draft.modules[0].activities[1].completion_rule,
    "score_at_least",
  );
  assert.equal(draft.modules[0].activities[1].pass_score, 50);
  assert.doesNotMatch(draft.modules[0].activities[0].content.body, /script/i);

  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test("AI generated outlines append after existing template modules", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    previousDatabaseUrl || "postgres://user:pass@localhost:5432/test";
  delete require.cache[
    require.resolve("../src/services/aiCourseBuilder.service")
  ];
  const {
    prepareDraftForAppend,
  } = require("../src/services/aiCourseBuilder.service");

  const draft = prepareDraftForAppend(
    {
      title: "Outline",
      modules: [
        { title: "AI Module 1", position: 1, activities: [] },
        {
          title: "AI Module 2",
          position: 2,
          activities: [
            {
              title: "Generated quiz",
              activity_type: "quiz",
              completion_rule: "score",
              content: {
                questions: [{ prompt: "Ready?", correct_answer: "Yes" }],
              },
            },
          ],
        },
      ],
    },
    3,
  );

  assert.equal(draft.modules[0].position, 4);
  assert.equal(draft.modules[1].position, 5);
  assert.equal(draft.modules[1].activities[0].position, 1);
  assert.equal(
    draft.modules[1].activities[0].completion_rule,
    "score_at_least",
  );

  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test("AI activity prompt is activity-aware and requests rich vanilla interactive content", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    previousDatabaseUrl || "postgres://user:pass@localhost:5432/test";
  delete require.cache[
    require.resolve("../src/services/aiCourseBuilder.service")
  ];
  const {
    buildActivityBuilderMessages,
  } = require("../src/services/aiCourseBuilder.service");

  const messages = buildActivityBuilderMessages({
    course_name: "Computer Basics",
    module_title: "Mouse Skills",
    module_position: 2,
    activity_position: 4,
    generation_mode: "explain_activity",
    activity: {
      title: "Click Practice",
      activity_type: "lesson",
      points: 5,
      content: { description: "Learners practise selecting items carefully." },
    },
    learner_age: "8 years old beginner",
    prompt: "Make it visual and project based.",
  });
  const prompt = messages.map((message) => message.content).join("\n");

  assert.match(prompt, /Click Practice/);
  assert.match(prompt, /Module number: 2/);
  assert.match(prompt, /Activity number in module: 4/);
  assert.match(prompt, /explain_activity/);
  assert.match(
    prompt,
    /Explain.*Show.*Practice Together.*Practice Independently.*Create.*Improve.*Reflect/s,
  );
  assert.match(prompt, /lesson/);
  assert.match(prompt, /rich_html/);
  assert.match(prompt, /vanilla/i);
  assert.match(prompt, /flashcards/i);
  assert.match(prompt, /click-to-reveal/i);
  assert.match(prompt, /checkbox/i);
  assert.match(prompt, /prediction questions/i);
  assert.match(prompt, /debugging moments/i);
  assert.match(prompt, /Did you notice/i);
  assert.match(prompt, /eduClub-safe/i);
  assert.match(prompt, /score_at_least/i);
  assert.match(prompt, /Save/i);

  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
});
