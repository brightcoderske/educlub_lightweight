# Web Development 1 Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the complete eight-week Web Development 1 master template to eduClub and make every lesson-level field editable by system administrators before schools adopt their own copies.

**Architecture:** Store the authored course as a versioned JavaScript template definition, validate it with pure functions, and import it idempotently into the existing `course_templates`, `course_template_modules`, and `course_template_activities` tables. Extend the existing course builder's structured activity form so editors can manage media, hints, feedback, badges, teacher notes, starter HTML/CSS, and quiz explanations without hand-editing JSON.

**Tech Stack:** Node.js 20, `node:test`, PostgreSQL/`pg`, Express, React 18, Material UI, existing eduClub course-template APIs.

---

## Scope Boundary

This plan delivers the complete editable course template using capabilities that already exist in eduClub.

Create separate implementation plans after this phase for:

1. Persistent multi-file learner website projects with separate HTML and CSS editors.
2. Teacher approval, safe public website links, unpublishing, and ZIP download.
3. Showcase workflow, peer-feedback completion, badges, and certificate automation.

## File Structure

- Create `backend/src/courseTemplates/webDevelopment1.template.js`: the complete authored template definition.
- Create `backend/src/courseTemplates/templateDefinition.js`: pure validation and normalization helpers.
- Create `backend/src/services/courseTemplateImport.service.js`: idempotent PostgreSQL import transaction.
- Create `backend/scripts/import-web-development-1.js`: command-line entry point.
- Create `backend/test/templateDefinition.test.js`: schema and content-contract tests.
- Create `backend/test/courseTemplateImport.service.test.js`: importer behavior using an injected query function.
- Modify `backend/package.json`: add backend test and template-import scripts.
- Modify `frontend/src/layouts/course-builder/index.js`: expose all structured editable fields.
- Create `frontend/src/layouts/course-builder/activityForm.js`: pure form conversion helpers.
- Create `frontend/src/layouts/course-builder/activityForm.test.js`: form round-trip tests.
- Modify `frontend/src/layouts/learner/module-learn/index.js`: render hints, quiz explanations, media, badge text, and Level Up content.
- Create `frontend/src/layouts/learner/module-learn/activityContent.js`: pure activity-content selectors.
- Create `frontend/src/layouts/learner/module-learn/activityContent.test.js`: learner-content tests.
- Modify `README.md`: document import and editing workflow.

### Task 1: Establish Backend Test and Import Commands

**Files:**
- Modify: `backend/package.json`
- Test: `backend/test/validateProductionEnv.test.js`

- [ ] **Step 1: Add a failing script-contract test**

Create `backend/test/packageScripts.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const packageJson = require("../package.json");

test("exposes backend tests and the Web Development 1 importer", () => {
  assert.equal(packageJson.scripts.test, "node --test test/*.test.js");
  assert.equal(
    packageJson.scripts["import:web-development-1"],
    "node scripts/import-web-development-1.js",
  );
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
cd backend
node --test test/packageScripts.test.js
```

Expected: FAIL because `scripts.test` and `scripts["import:web-development-1"]` are undefined.

- [ ] **Step 3: Add the scripts**

Add to `backend/package.json`:

```json
"test": "node --test test/*.test.js",
"import:web-development-1": "node scripts/import-web-development-1.js"
```

- [ ] **Step 4: Run the backend tests and verify GREEN**

Run:

```powershell
cd backend
npm test
```

Expected: all package-script and production-environment tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/package.json backend/test/packageScripts.test.js
git commit -m "test: add backend template import commands"
```

### Task 2: Define and Validate the Template Contract

**Files:**
- Create: `backend/src/courseTemplates/templateDefinition.js`
- Create: `backend/test/templateDefinition.test.js`

- [ ] **Step 1: Write failing normalization tests**

Create `backend/test/templateDefinition.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeTemplateDefinition,
  validateTemplateDefinition,
} = require("../src/courseTemplates/templateDefinition");

function validDefinition() {
  return {
    name: "Welcome to Web Development 1",
    code: "WEB-DEV-1",
    description: "Build and publish a first website.",
    target_level: "Ages 9-14",
    estimated_weeks: 8,
    learning_objectives: ["Explain what HTML and CSS do."],
    certificate_enabled: true,
    course_category: "general",
    settings: {
      mastery_score: 80,
      unlimited_quiz_retries: true,
      public_showcase_enabled: true,
      teacher_publish_approval_required: true,
    },
    modules: [
      {
        title: "Mission 1 - Meet the Web",
        description: "Discover how websites work.",
        learning_outcomes: ["Explain browser and server roles."],
        badge: { name: "Web Explorer", image_url: "" },
        teacher_notes: "Model a browser request.",
        activities: [
          {
            title: "Mission Welcome",
            activity_type: "lesson",
            content: { body: "Welcome." },
            points: 0,
            is_required: true,
            completion_rule: "viewed",
          },
        ],
      },
    ],
  };
}

test("assigns deterministic positions and publish defaults", () => {
  const result = normalizeTemplateDefinition(validDefinition());
  assert.equal(result.modules[0].position, 1);
  assert.equal(result.modules[0].activities[0].position, 1);
  assert.equal(result.modules[0].is_published, true);
  assert.equal(result.modules[0].activities[0].is_published, true);
});

test("rejects duplicate module positions", () => {
  const definition = validDefinition();
  definition.modules.push({ ...definition.modules[0], position: 1 });
  assert.throws(
    () => validateTemplateDefinition(definition),
    /duplicate module position 1/i,
  );
});

test("rejects unsupported activity types", () => {
  const definition = validDefinition();
  definition.modules[0].activities[0].activity_type = "game";
  assert.throws(
    () => validateTemplateDefinition(definition),
    /unsupported activity type game/i,
  );
});

test("requires quiz questions and an 80 percent default mastery score", () => {
  const definition = validDefinition();
  definition.modules[0].activities[0] = {
    title: "Knowledge Check",
    activity_type: "quiz",
    content: { questions: [] },
    completion_rule: "score_at_least",
    pass_score: 80,
  };
  assert.throws(
    () => validateTemplateDefinition(definition),
    /quiz must contain at least one question/i,
  );
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
cd backend
node --test test/templateDefinition.test.js
```

Expected: FAIL with `Cannot find module '../src/courseTemplates/templateDefinition'`.

- [ ] **Step 3: Implement the contract**

Create `backend/src/courseTemplates/templateDefinition.js`:

```js
const ACTIVITY_TYPES = new Set([
  "lesson",
  "quiz",
  "assignment",
  "discussion",
  "coding",
  "typing",
  "project",
  "reflection",
]);

function normalizeTemplateDefinition(definition) {
  const modules = (definition.modules || []).map((module, moduleIndex) => ({
    ...module,
    position: Number(module.position || moduleIndex + 1),
    is_published: module.is_published !== false,
    activities: (module.activities || []).map((activity, activityIndex) => ({
      points: 0,
      is_required: true,
      completion_rule: "manual",
      ...activity,
      position: Number(activity.position || activityIndex + 1),
      is_published: activity.is_published !== false,
    })),
  }));

  return {
    course_category: "general",
    certificate_enabled: true,
    is_active: true,
    ...definition,
    modules,
  };
}

function assertUniquePositions(items, label) {
  const positions = new Set();
  for (const item of items) {
    if (positions.has(item.position)) {
      throw new Error(`Duplicate ${label} position ${item.position}.`);
    }
    positions.add(item.position);
  }
}

function validateTemplateDefinition(input) {
  const definition = normalizeTemplateDefinition(input);
  if (!definition.name?.trim()) throw new Error("Template name is required.");
  if (!definition.code?.trim()) throw new Error("Template code is required.");
  if (definition.estimated_weeks !== 8) {
    throw new Error("Web Development 1 must contain eight estimated weeks.");
  }
  if (definition.settings?.mastery_score !== 80) {
    throw new Error("The default mastery score must be 80.");
  }
  if (definition.modules.length !== 8) {
    throw new Error("Web Development 1 must contain eight modules.");
  }

  assertUniquePositions(definition.modules, "module");
  for (const module of definition.modules) {
    if (!module.title?.trim()) throw new Error("Every module needs a title.");
    if (!module.badge?.name?.trim()) {
      throw new Error(`${module.title} needs a badge name.`);
    }
    assertUniquePositions(module.activities, `${module.title} activity`);

    for (const activity of module.activities) {
      if (!ACTIVITY_TYPES.has(activity.activity_type)) {
        throw new Error(`Unsupported activity type ${activity.activity_type}.`);
      }
      if (
        activity.activity_type === "quiz" &&
        !activity.content?.questions?.length
      ) {
        throw new Error(`${activity.title} quiz must contain at least one question.`);
      }
    }
  }
  return definition;
}

module.exports = {
  ACTIVITY_TYPES,
  normalizeTemplateDefinition,
  validateTemplateDefinition,
};
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```powershell
cd backend
node --test test/templateDefinition.test.js
```

Expected: all four tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/courseTemplates/templateDefinition.js backend/test/templateDefinition.test.js
git commit -m "feat: define editable course template contract"
```

### Task 3: Author the Complete Eight-Mission Template

**Files:**
- Create: `backend/src/courseTemplates/webDevelopment1.template.js`
- Modify: `backend/test/templateDefinition.test.js`
- Reference: `docs/superpowers/specs/2026-06-11-web-development-1-course-template-design.md`

- [ ] **Step 1: Add failing course-content tests**

Append to `backend/test/templateDefinition.test.js`:

```js
const webDevelopment1 = require("../src/courseTemplates/webDevelopment1.template");

test("Web Development 1 contains all eight missions and badges", () => {
  const definition = validateTemplateDefinition(webDevelopment1);
  assert.deepEqual(
    definition.modules.map((module) => module.badge.name),
    [
      "Web Explorer",
      "HTML Builder",
      "Content Connector",
      "Style Scientist",
      "Layout Architect",
      "Site Navigator",
      "Bug Detective",
      "Web Creator",
    ],
  );
});

test("every mission contains the complete learning rhythm", () => {
  const requiredPurposes = [
    "welcome",
    "reading",
    "video",
    "discussion",
    "guided_practice",
    "build",
    "quiz",
    "level_up",
    "reflection",
    "celebration",
  ];
  const definition = validateTemplateDefinition(webDevelopment1);

  for (const module of definition.modules) {
    assert.deepEqual(
      module.activities.map((activity) => activity.content.purpose),
      requiredPurposes,
      module.title,
    );
  }
});

test("course quizzes collectively use every required question format", () => {
  const definition = validateTemplateDefinition(webDevelopment1);
  const types = new Set(
    definition.modules.flatMap((module) =>
      module.activities.flatMap((activity) =>
        (activity.content?.questions || []).map((question) => question.question_type),
      ),
    ),
  );
  assert.deepEqual(
    [...types].sort(),
    ["matching", "multiple_choice", "ordering", "short_answer"],
  );
});

test("coding milestones progress from skeleton to launch", () => {
  const definition = validateTemplateDefinition(webDevelopment1);
  const milestones = definition.modules.map((module) =>
    module.activities.find((activity) => activity.content.purpose === "build")
      .content.milestone_key,
  );
  assert.deepEqual(milestones, [
    "page-skeleton",
    "structured-content",
    "links-and-images",
    "visual-style",
    "box-layout",
    "second-page-navigation",
    "tested-accessible-site",
    "approved-launched-site",
  ]);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
cd backend
node --test test/templateDefinition.test.js
```

Expected: FAIL because `webDevelopment1.template.js` does not exist.

- [ ] **Step 3: Create the authored template**

Create `backend/src/courseTemplates/webDevelopment1.template.js` with:

```js
const mission = ({
  title,
  description,
  outcomes,
  badge,
  teacherNotes,
  activities,
}) => ({
  title,
  description,
  learning_outcomes: outcomes,
  badge: { name: badge, image_url: "" },
  teacher_notes: teacherNotes,
  activities,
});

const activity = (
  title,
  activityType,
  purpose,
  content,
  options = {},
) => ({
  title,
  activity_type: activityType,
  content: { purpose, ...content },
  points: options.points || 0,
  is_required: options.is_required !== false,
  completion_rule: options.completion_rule || "viewed",
  pass_score: options.pass_score || null,
});

module.exports = {
  name: "Welcome to Web Development 1",
  code: "WEB-DEV-1",
  description:
    "Discover how websites work and build, test, publish, and download your first website.",
  target_level: "Ages 9-14",
  image_url: "",
  estimated_weeks: 8,
  learning_objectives: [
    "Explain what websites, browsers, servers, HTML, and CSS do.",
    "Create structured web pages with headings, paragraphs, lists, links, and images.",
    "Style readable pages using foundational CSS.",
    "Connect pages with clear navigation.",
    "Test and improve a website for correctness, safety, and accessibility.",
  ],
  certificate_enabled: true,
  course_category: "general",
  settings: {
    mastery_score: 80,
    unlimited_quiz_retries: true,
    public_showcase_enabled: true,
    teacher_publish_approval_required: true,
    guided_topics: [
      "About Me",
      "A hobby",
      "A favorite animal",
      "A school club",
      "A local hero",
    ],
  },
  modules: buildWebDevelopmentMissions({ mission, activity }),
};
```

Define `buildWebDevelopmentMissions` in the same file. It returns eight `mission(...)`
objects, each containing ten `activity(...)` objects in the required purpose
order. Use this fixed content matrix:

| Mission | Reading | Discussion | Build milestone | Level Up | Reflection |
| --- | --- | --- | --- | --- | --- |
| Meet the Web | What Is a Website? | Which website helps you learn, create, or solve a problem? | `page-skeleton` | Add a safe subtitle describing the chosen topic. | What should visitors learn from your website? |
| HTML Building Blocks | HTML Is the Structure | How is a web page like a book or school poster? | `structured-content` | Add a quotation or fun-fact section. | Which HTML element was most useful today? |
| Links and Images | Connecting the Web | What makes a link helpful instead of confusing? | `links-and-images` | Turn one image into a link. | How does alternative text help a visitor? |
| CSS Style Lab | CSS Gives a Website Its Look | How can color change the feeling of a website? | `visual-style` | Add a hover style to links. | Which design choice best matches your topic, and why? |
| Boxes and Spacing | Every Element Has a Box | Why is empty space useful in a design? | `box-layout` | Add rounded corners and a subtle shadow. | What became easier to read after changing the spacing? |
| Pages and Navigation | From One Page to a Website | What should a visitor be able to find quickly? | `second-page-navigation` | Add a Back to top link or optional third page. | Could a first-time visitor move around without help? |
| Polish and Test | Test, Fix, Improve | Describe a mistake that helped you learn something. | `tested-accessible-site` | Add one simple responsive CSS rule. | Which improvement made the biggest difference? |
| Launch Day | From Code to the World | What are you most proud of, and what would you build next? | `approved-launched-site` | Preview the supplied tiny JavaScript interaction. | What can you build now that you could not build before? |

For every mission:

- Use the approved title, description, outcomes, badge, teacher notes, reading, image description, discussion prompt, coding instructions, milestone, Level Up challenge, reflection, and celebration copy.
- Set `video_url` and `image_url` to an empty string until an administrator selects approved media; provide complete `video_title`, `image_alt`, and `transcript` text so the activity remains usable without external media.
- Include at least four quiz questions: one `multiple_choice`, one `matching`, one `short_answer`, and one `ordering`.
- Give each question `id`, `prompt`, `options`, `correct_answer`, `points`, `hint`, and `explanation`.
- Set quiz activities to `completion_rule: "score_at_least"` and `pass_score: 80`.
- Set discussions to `completion_rule: "submitted"`.
- Set coding/build activities to `completion_rule: "submitted"`.
- Store editable media in `content.media`:

```js
media: {
  image_url: "",
  image_alt: "A browser requesting website files from a server.",
  video_url: "",
  video_title: "How a website reaches your screen",
  transcript: "A browser asks a server for website files...",
}
```

- Store coding content in:

```js
starter_html: "<!doctype html>...",
starter_css: "",
instructions: ["Add a page title.", "Preview your page."],
friendly_hints: ["Start with the h1 element."],
milestone_key: "page-skeleton",
expected_checks: ["has-doctype", "has-title", "has-h1"],
```

The content wording must match the approved design specification and remain child-friendly.

- [ ] **Step 4: Run tests and inspect the authored count**

Run:

```powershell
cd backend
node --test test/templateDefinition.test.js
node -e "const t=require('./src/courseTemplates/webDevelopment1.template'); console.log(t.modules.length, t.modules.reduce((n,m)=>n+m.activities.length,0))"
```

Expected:

```text
8 80
```

All template-definition tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/courseTemplates/webDevelopment1.template.js backend/test/templateDefinition.test.js
git commit -m "feat: author Web Development 1 master template"
```

### Task 4: Build an Idempotent Template Importer

**Files:**
- Create: `backend/src/services/courseTemplateImport.service.js`
- Create: `backend/test/courseTemplateImport.service.test.js`

- [ ] **Step 1: Write failing importer tests**

Create `backend/test/courseTemplateImport.service.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  importTemplateDefinition,
} = require("../src/services/courseTemplateImport.service");

test("imports one template, its modules, and activities in a transaction", async () => {
  const calls = [];
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
    if (sql.includes("INSERT INTO course_templates")) return { rows: [{ id: 7 }] };
    if (sql.includes("INSERT INTO course_template_modules")) {
      return { rows: [{ id: 20 + params[5] }] };
    }
    return { rows: [] };
  };
  const definition = {
    name: "Course",
    code: "COURSE-1",
    description: "",
    target_level: "Ages 9-14",
    estimated_weeks: 8,
    learning_objectives: [],
    certificate_enabled: true,
    course_category: "general",
    settings: { mastery_score: 80 },
    modules: Array.from({ length: 8 }, (_, index) => ({
      title: `Mission ${index + 1}`,
      description: "",
      learning_outcomes: [],
      position: index + 1,
      badge: { name: `Badge ${index + 1}` },
      teacher_notes: "",
      is_published: true,
      activities: [
        {
          title: "Welcome",
          activity_type: "lesson",
          content: { purpose: "welcome" },
          points: 0,
          position: 1,
          is_required: true,
          completion_rule: "viewed",
          pass_score: null,
          is_published: true,
        },
      ],
    })),
  };

  const result = await importTemplateDefinition(definition, query);

  assert.deepEqual(result, { template_id: 7, modules: 8, activities: 8 });
  assert.equal(calls[0].sql, "BEGIN");
  assert.equal(calls.at(-1).sql, "COMMIT");
});

test("rolls back when an insert fails", async () => {
  const calls = [];
  const query = async (sql) => {
    calls.push(sql);
    if (sql.includes("course_template_modules")) throw new Error("database failed");
    if (sql.includes("course_templates")) return { rows: [{ id: 7 }] };
    return { rows: [] };
  };

  await assert.rejects(
    () =>
      importTemplateDefinition(
        {
          name: "Course",
          code: "COURSE-1",
          estimated_weeks: 8,
          settings: { mastery_score: 80 },
          modules: Array.from({ length: 8 }, (_, index) => ({
            title: `Mission ${index + 1}`,
            badge: { name: `Badge ${index + 1}` },
            activities: [],
          })),
        },
        query,
      ),
    /database failed/,
  );
  assert.equal(calls.at(-1), "ROLLBACK");
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
cd backend
node --test test/courseTemplateImport.service.test.js
```

Expected: FAIL because the importer module does not exist.

- [ ] **Step 3: Implement transactional upserts**

Create `backend/src/services/courseTemplateImport.service.js`:

```js
const {
  validateTemplateDefinition,
} = require("../courseTemplates/templateDefinition");

async function importTemplateDefinition(input, query) {
  const definition = validateTemplateDefinition(input);
  let moduleCount = 0;
  let activityCount = 0;

  await query("BEGIN");
  try {
    const templateResult = await query(
      `INSERT INTO course_templates (
         name, code, description, target_level, image_url, estimated_weeks,
         learning_objectives, certificate_enabled, course_category, is_active
       )
       VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7, $8, $9, true)
       ON CONFLICT (code) WHERE code IS NOT NULL
       DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         target_level = EXCLUDED.target_level,
         image_url = EXCLUDED.image_url,
         estimated_weeks = EXCLUDED.estimated_weeks,
         learning_objectives = EXCLUDED.learning_objectives,
         certificate_enabled = EXCLUDED.certificate_enabled,
         course_category = EXCLUDED.course_category,
         version = course_templates.version + 1,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        definition.name,
        definition.code,
        definition.description,
        definition.target_level,
        definition.image_url || "",
        definition.estimated_weeks,
        JSON.stringify(definition.learning_objectives),
        definition.certificate_enabled,
        definition.course_category,
      ],
    );
    const templateId = templateResult.rows[0].id;

    await query(
      "DELETE FROM course_template_modules WHERE template_id = $1",
      [templateId],
    );

    for (const module of definition.modules) {
      const moduleResult = await query(
        `INSERT INTO course_template_modules (
           template_id, title, description, learning_outcomes, position,
           is_published, unlock_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, NULL)
         RETURNING id`,
        [
          templateId,
          module.title,
          module.description || "",
          JSON.stringify(module.learning_outcomes || []),
          module.position,
          module.is_published,
        ],
      );
      const moduleId = moduleResult.rows[0].id;
      moduleCount += 1;

      for (const item of module.activities) {
        const content = {
          ...item.content,
          module_badge: module.badge,
          teacher_notes: module.teacher_notes || "",
          template_settings: definition.settings,
        };
        await query(
          `INSERT INTO course_template_activities (
             template_module_id, title, activity_type, content, points,
             position, is_required, completion_rule, pass_score, is_published
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            moduleId,
            item.title,
            item.activity_type,
            JSON.stringify(content),
            item.points,
            item.position,
            item.is_required,
            item.completion_rule,
            item.pass_score,
            item.is_published,
          ],
        );
        activityCount += 1;
      }
    }

    await query("COMMIT");
    return {
      template_id: templateId,
      modules: moduleCount,
      activities: activityCount,
    };
  } catch (error) {
    await query("ROLLBACK");
    throw error;
  }
}

module.exports = { importTemplateDefinition };
```

- [ ] **Step 4: Run importer tests and verify GREEN**

Run:

```powershell
cd backend
node --test test/courseTemplateImport.service.test.js
```

Expected: both importer tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/services/courseTemplateImport.service.js backend/test/courseTemplateImport.service.test.js
git commit -m "feat: add idempotent course template importer"
```

### Task 5: Add the Import Command

**Files:**
- Create: `backend/scripts/import-web-development-1.js`
- Modify: `backend/test/courseTemplateImport.service.test.js`

- [ ] **Step 1: Add a failing export test for command dependency injection**

Append to `backend/test/courseTemplateImport.service.test.js`:

```js
test("the Web Development 1 definition passes validation before database use", () => {
  const template = require("../src/courseTemplates/webDevelopment1.template");
  const { validateTemplateDefinition } = require(
    "../src/courseTemplates/templateDefinition"
  );
  assert.equal(validateTemplateDefinition(template).code, "WEB-DEV-1");
});
```

- [ ] **Step 2: Run the test**

Run:

```powershell
cd backend
node --test test/courseTemplateImport.service.test.js
```

Expected: PASS, proving the command can safely load the definition.

- [ ] **Step 3: Create the CLI**

Create `backend/scripts/import-web-development-1.js`:

```js
const { pool } = require("../src/config");
const template = require("../src/courseTemplates/webDevelopment1.template");
const {
  importTemplateDefinition,
} = require("../src/services/courseTemplateImport.service");

async function main() {
  const client = await pool.connect();
  try {
    const result = await importTemplateDefinition(
      template,
      client.query.bind(client),
    );
    console.log(
      `Imported Web Development 1: template ${result.template_id}, ` +
        `${result.modules} modules, ${result.activities} activities.`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Web Development 1 import failed:", error);
  process.exitCode = 1;
});
```

Use the existing `pool` export from `backend/src/config/index.js`; no config change is required.

- [ ] **Step 4: Run all backend tests**

Run:

```powershell
cd backend
npm test
```

Expected: all backend tests PASS without requiring a database connection.

- [ ] **Step 5: Run the importer against the configured development database**

Run:

```powershell
cd backend
npm run import:web-development-1
```

Expected:

```text
Imported Web Development 1: template 1, 8 modules, 80 activities.
```

Run it a second time. Expected: the same template code is updated, not duplicated.

- [ ] **Step 6: Commit**

```powershell
git add backend/scripts/import-web-development-1.js backend/src/config/index.js backend/test/courseTemplateImport.service.test.js
git commit -m "feat: add Web Development 1 import command"
```

### Task 6: Extract Structured Activity Form Conversion

**Files:**
- Create: `frontend/src/layouts/course-builder/activityForm.js`
- Create: `frontend/src/layouts/course-builder/activityForm.test.js`
- Modify: `frontend/src/layouts/course-builder/index.js`

- [ ] **Step 1: Write failing form round-trip tests**

Create `frontend/src/layouts/course-builder/activityForm.test.js`:

```js
import {
  activityToStructuredForm,
  structuredFormToPayload,
} from "./activityForm";

test("loads editable Web Development 1 fields", () => {
  const form = activityToStructuredForm({
    title: "Knowledge Check",
    activity_type: "quiz",
    content: {
      purpose: "quiz",
      description: "Check your learning.",
      media: {
        image_url: "/image.png",
        image_alt: "A browser and server diagram.",
        video_url: "https://example.test/video",
        video_title: "How websites work",
        transcript: "A browser requests files.",
      },
      friendly_hints: ["Think about the app used to open websites."],
      level_up: "Add a second heading.",
      teacher_notes: "Model the first question.",
      questions: [
        {
          id: "q1",
          question_type: "multiple_choice",
          prompt: "Which is a browser?",
          options: ["Chrome", "HTML"],
          correct_answer: "Chrome",
          hint: "It opens websites.",
          explanation: "Chrome is a web browser.",
          points: 1,
        },
      ],
    },
  });

  expect(form.image_alt).toBe("A browser and server diagram.");
  expect(form.friendly_hints).toEqual([
    "Think about the app used to open websites.",
  ]);
  expect(form.questions[0].explanation).toBe("Chrome is a web browser.");
});

test("preserves structured fields when saving", () => {
  const payload = structuredFormToPayload({
    title: "Mission Welcome",
    activity_type: "lesson",
    purpose: "welcome",
    description: "Welcome.",
    rich_html: "",
    image_url: "",
    image_alt: "Website mission map.",
    video_url: "",
    video_title: "",
    transcript: "",
    friendly_hints_text: "Read the heading first.\nCheck the preview.",
    level_up: "Add one extra fact.",
    teacher_notes: "Demonstrate the preview.",
    badge_name: "Web Explorer",
    starter_html: "<h1>Hello</h1>",
    starter_css: "h1 { color: blue; }",
    milestone_key: "page-skeleton",
    questions: [],
    points: 0,
    position: 1,
    is_required: true,
    completion_rule: "viewed",
    pass_score: "",
    is_published: true,
  });

  expect(payload.content.friendly_hints).toEqual([
    "Read the heading first.",
    "Check the preview.",
  ]);
  expect(payload.content.media.image_alt).toBe("Website mission map.");
  expect(payload.content.starter_html).toBe("<h1>Hello</h1>");
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
cd frontend
npm test -- --watchAll=false src/layouts/course-builder/activityForm.test.js
```

Expected: FAIL because `activityForm.js` does not exist.

- [ ] **Step 3: Implement pure conversion helpers**

Create `frontend/src/layouts/course-builder/activityForm.js` exporting:

```js
export function activityToStructuredForm(activity = {}) {
  const content = activity.content || {};
  const media = content.media || {};
  return {
    title: activity.title || "",
    activity_type: activity.activity_type || "lesson",
    purpose: content.purpose || "",
    description: content.description || content.body || "",
    rich_html: content.rich_html || "",
    image_url: media.image_url || "",
    image_alt: media.image_alt || "",
    video_url: media.video_url || "",
    video_title: media.video_title || "",
    transcript: media.transcript || "",
    friendly_hints: content.friendly_hints || [],
    friendly_hints_text: (content.friendly_hints || []).join("\n"),
    level_up: content.level_up || "",
    teacher_notes: content.teacher_notes || "",
    badge_name: content.module_badge?.name || "",
    starter_html: content.starter_html || "",
    starter_css: content.starter_css || "",
    milestone_key: content.milestone_key || "",
    discussion_prompt: content.discussion_prompt || "",
    reflection_prompt: content.reflection_prompt || "",
    project_brief: content.project_brief || "",
    submission_instructions: content.submission_instructions || "",
    questions: content.questions || [],
    points: activity.points || 0,
    position: activity.position || 1,
    is_required: activity.is_required !== false,
    completion_rule: activity.completion_rule || "manual",
    pass_score: activity.pass_score || "",
    is_published: activity.is_published !== false,
  };
}

export function structuredFormToPayload(form) {
  return {
    title: form.title,
    activity_type: form.activity_type,
    points: Number(form.points || 0),
    position: Number(form.position || 1),
    is_required: form.is_required !== false,
    completion_rule: form.completion_rule || "manual",
    pass_score: form.pass_score === "" ? null : Number(form.pass_score),
    is_published: form.is_published !== false,
    content: {
      purpose: form.purpose || "",
      description: form.description || "",
      rich_html: form.rich_html || "",
      media: {
        image_url: form.image_url || "",
        image_alt: form.image_alt || "",
        video_url: form.video_url || "",
        video_title: form.video_title || "",
        transcript: form.transcript || "",
      },
      friendly_hints: String(form.friendly_hints_text || "")
        .split(/\r?\n/)
        .map((hint) => hint.trim())
        .filter(Boolean),
      level_up: form.level_up || "",
      teacher_notes: form.teacher_notes || "",
      module_badge: { name: form.badge_name || "" },
      starter_html: form.starter_html || "",
      starter_css: form.starter_css || "",
      milestone_key: form.milestone_key || "",
      discussion_prompt: form.discussion_prompt || "",
      reflection_prompt: form.reflection_prompt || "",
      project_brief: form.project_brief || "",
      submission_instructions: form.submission_instructions || "",
      questions: form.questions || [],
    },
  };
}
```

- [ ] **Step 4: Integrate helpers into the builder**

In `frontend/src/layouts/course-builder/index.js`:

- Import the two helper functions.
- Replace `activityToManagerForm` with `activityToStructuredForm`.
- Replace manual activity payload assembly with `structuredFormToPayload`.
- Keep the existing generic JSON/text editor available for legacy activities.
- Add structured fields for purpose, media, transcript, hints, Level Up, teacher notes, badge, starter HTML, starter CSS, and milestone key.
- Add `hint` and `explanation` inputs to each quiz-question editor.
- Label video URLs as teacher-approved external sources.
- Do not remove existing rich-text, image upload, quiz CSV, or publish controls.

- [ ] **Step 5: Run tests and build**

Run:

```powershell
cd frontend
npm test -- --watchAll=false src/layouts/course-builder/activityForm.test.js
npm run build
```

Expected: form tests PASS and the production build completes.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/layouts/course-builder/activityForm.js frontend/src/layouts/course-builder/activityForm.test.js frontend/src/layouts/course-builder/index.js
git commit -m "feat: edit structured course activity content"
```

### Task 7: Render the Child-Friendly Activity Fields

**Files:**
- Create: `backend/src/services/quizFeedback.js`
- Create: `backend/test/quizFeedback.test.js`
- Modify: `backend/src/services/courses.service.js`
- Create: `frontend/src/layouts/learner/module-learn/activityContent.js`
- Create: `frontend/src/layouts/learner/module-learn/activityContent.test.js`
- Modify: `frontend/src/layouts/learner/module-learn/index.js`

- [ ] **Step 1: Write failing backend quiz-feedback tests**

Create `backend/test/quizFeedback.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  publicQuestion,
  resultFeedback,
} = require("../src/services/quizFeedback");

test("exposes a hint but not the answer or explanation before submission", () => {
  assert.deepEqual(
    publicQuestion({
      id: "q1",
      question_type: "multiple_choice",
      prompt: "Which is a browser?",
      options: ["Chrome", "HTML"],
      correct_answer: "Chrome",
      hint: "It opens websites.",
      explanation: "Chrome is a web browser.",
      points: 1,
    }),
    {
      id: "q1",
      question_type: "multiple_choice",
      prompt: "Which is a browser?",
      options: ["Chrome", "HTML"],
      image_url: "",
      points: 1,
      position: 1,
      hint: "It opens websites.",
    },
  );
});

test("returns explanation and retry hint after submission", () => {
  assert.deepEqual(
    resultFeedback(
      {
        id: "q1",
        hint: "It opens websites.",
        explanation: "Chrome is a web browser.",
        points: 1,
      },
      false,
    ),
    {
      correct: false,
      points: 0,
      max_points: 1,
      hint: "It opens websites.",
      explanation: "Chrome is a web browser.",
    },
  );
});
```

- [ ] **Step 2: Run backend tests and verify RED**

Run:

```powershell
cd backend
node --test test/quizFeedback.test.js
```

Expected: FAIL because `quizFeedback.js` does not exist.

- [ ] **Step 3: Implement safe quiz feedback**

Create `backend/src/services/quizFeedback.js`:

```js
function publicQuestion(question = {}, index = 0) {
  return {
    id: question.id || `${index + 1}`,
    question_type: question.question_type || question.type || "multiple_choice",
    prompt: question.prompt || question.question || "",
    options: Array.isArray(question.options) ? question.options : [],
    image_url: question.image_url || "",
    points: Number(question.points ?? 1),
    position: Number(question.position || index + 1),
    hint: question.hint || "",
  };
}

function resultFeedback(question, correct) {
  const maxPoints = Number(question.points || 0);
  return {
    correct,
    points: correct ? maxPoints : 0,
    max_points: maxPoints,
    hint: correct ? "" : question.hint || "",
    explanation: question.explanation || "",
  };
}

module.exports = { publicQuestion, resultFeedback };
```

In `backend/src/services/courses.service.js`:

- Import `publicQuestion` and `resultFeedback`.
- Make `normalizeQuestion(question, index, false)` return `publicQuestion(question, index)`.
- Preserve `correct_answer`, `hint`, and `explanation` only in the internal `includeAnswer` path.
- Replace the inline feedback object in `submitQuiz` with:

```js
feedback[question.id] = resultFeedback(question, correct);
```

- [ ] **Step 4: Run backend tests and verify GREEN**

Run:

```powershell
cd backend
npm test
```

Expected: all backend tests PASS.

- [ ] **Step 5: Write failing frontend content-selector tests**

Create `frontend/src/layouts/learner/module-learn/activityContent.test.js`:

```js
import { selectActivityContent } from "./activityContent";

test("returns learner-facing content without teacher notes", () => {
  const selected = selectActivityContent({
    purpose: "quiz",
    friendly_hints: ["Look at the opening tag."],
    level_up: "Add another section.",
    teacher_notes: "Do not show this to learners.",
    module_badge: { name: "HTML Builder" },
    media: {
      image_url: "/tag.png",
      image_alt: "Parts of an HTML element.",
      video_url: "https://example.test/html",
      video_title: "HTML building blocks",
      transcript: "HTML gives a page structure.",
    },
  });

  expect(selected.hints).toEqual(["Look at the opening tag."]);
  expect(selected.badgeName).toBe("HTML Builder");
  expect(selected).not.toHaveProperty("teacher_notes");
});

test("combines public hints with post-submission explanations", () => {
  const selected = selectActivityContent(
    {
      questions: [{ id: "q1", hint: "It opens websites." }],
    },
    {
      feedback: {
        q1: {
          correct: false,
          hint: "It opens websites.",
          explanation: "Chrome is a browser.",
        },
      },
    },
  );
  expect(selected.questionFeedback.q1).toEqual({
    hint: "It opens websites.",
    explanation: "Chrome is a browser.",
    correct: false,
  });
});
```

- [ ] **Step 6: Run frontend tests and verify RED**

Run:

```powershell
cd frontend
npm test -- --watchAll=false src/layouts/learner/module-learn/activityContent.test.js
```

Expected: FAIL because `activityContent.js` does not exist.

- [ ] **Step 7: Implement the selector**

Create `frontend/src/layouts/learner/module-learn/activityContent.js`:

```js
export function selectActivityContent(content = {}, quizResult = {}) {
  const resultFeedback = quizResult.feedback || {};
  return {
    purpose: content.purpose || "",
    hints: content.friendly_hints || [],
    levelUp: content.level_up || "",
    badgeName: content.module_badge?.name || "",
    media: content.media || {},
    starterHtml: content.starter_html || "",
    starterCss: content.starter_css || "",
    milestoneKey: content.milestone_key || "",
    questionFeedback: Object.fromEntries(
      (content.questions || []).map((question) => [
        question.id,
        {
          hint: resultFeedback[question.id]?.hint || question.hint || "",
          explanation: resultFeedback[question.id]?.explanation || "",
          correct: resultFeedback[question.id]?.correct,
        },
      ]),
    ),
  };
}
```

- [ ] **Step 8: Integrate child-friendly rendering**

In `frontend/src/layouts/learner/module-learn/index.js`:

- Render an image only when `media.image_url` is present and use `media.image_alt`.
- Render video links in a new tab with `rel="noopener noreferrer"` and always show the transcript below or in a collapsible panel.
- Render friendly hints in a clearly labeled "Need a hint?" panel.
- After quiz submission, show each question's explanation and the hint for incorrect answers.
- Render the optional Level Up challenge separately and label it optional.
- Render the weekly badge name in the completion section.
- For Web Development 1 coding activities, initialize the editor from:

```js
const initialCode = [
  content.starter_html || "",
  content.starter_css
    ? `<style>\n${content.starter_css}\n</style>`
    : "",
].filter(Boolean).join("\n");
```

- Keep JavaScript execution disabled for activities whose language is `html_css`; the optional Week 8 preview may use `html_css_js`.
- Never render `content.teacher_notes` in the learner view.

- [ ] **Step 9: Run tests and build**

Run:

```powershell
cd frontend
npm test -- --watchAll=false src/layouts/learner/module-learn/activityContent.test.js
npm run build
```

Expected: learner-content tests PASS and production build completes.

- [ ] **Step 10: Commit**

```powershell
git add backend/src/services/quizFeedback.js backend/src/services/courses.service.js backend/test/quizFeedback.test.js frontend/src/layouts/learner/module-learn/activityContent.js frontend/src/layouts/learner/module-learn/activityContent.test.js frontend/src/layouts/learner/module-learn/index.js
git commit -m "feat: render child friendly course activities"
```

### Task 8: Verify Template Editing and Adoption End to End

**Files:**
- Modify: `README.md`
- Verify: `backend/src/courseTemplates/webDevelopment1.template.js`
- Verify: `frontend/src/layouts/course-builder/index.js`
- Verify: `frontend/src/layouts/learner/module-learn/index.js`

- [ ] **Step 1: Run all automated checks**

Run:

```powershell
cd backend
npm test
cd ..\frontend
npm test -- --watchAll=false
npm run build
```

Expected: all backend and frontend tests PASS; frontend build succeeds.

- [ ] **Step 2: Import and inspect database counts**

Run:

```powershell
cd backend
npm run import:web-development-1
```

Then run the project database query tool or `psql` equivalent:

```sql
SELECT t.code,
       COUNT(DISTINCT tm.id) AS modules,
       COUNT(ta.id) AS activities
FROM course_templates t
JOIN course_template_modules tm ON tm.template_id = t.id
JOIN course_template_activities ta ON ta.template_module_id = tm.id
WHERE t.code = 'WEB-DEV-1'
GROUP BY t.code;
```

Expected:

```text
WEB-DEV-1 | 8 | 80
```

- [ ] **Step 3: Browser-verify the system-admin editor**

Use the in-app Browser:

1. Sign in as system administrator.
2. Open Web Development 1 in the course builder.
3. Confirm all eight missions and 80 activities appear in order.
4. Edit a quiz hint and explanation, save, reload, and confirm persistence.
5. Edit a discussion prompt, video source, transcript, starter HTML, starter CSS, badge name, and teacher note.
6. Confirm hidden/unpublished activities remain editable.
7. Confirm no browser console errors.

- [ ] **Step 4: Browser-verify school adoption**

1. Sign in as a school administrator.
2. Adopt Web Development 1.
3. Open the school-owned course copy.
4. Confirm all modules, activities, content, quiz questions, points, publish states, and mastery scores were copied.
5. Edit the school copy and confirm the master template is unchanged.

- [ ] **Step 5: Browser-verify learner delivery**

1. Allocate the adopted course to a learner.
2. Open Mission 1 as the learner.
3. Confirm reading, image alt text, video source, transcript, discussion, coding preview, hints, quiz formats, Level Up, reflection, and badge display correctly.
4. Submit the quiz below 80%, read the friendly feedback, retry, and pass.
5. Confirm teacher notes never appear.
6. Confirm activity and module progress update.

- [ ] **Step 6: Document operations**

Add to `README.md`:

```markdown
### Import Web Development 1

From `backend/`, run:

```powershell
npm run import:web-development-1
```

The command creates or updates the `WEB-DEV-1` master template. System
administrators can edit it in the course builder. School administrators adopt
their own editable copy through the course-template library.
```

- [ ] **Step 7: Final verification**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only intended files are modified.

- [ ] **Step 8: Commit**

```powershell
git add README.md
git commit -m "docs: explain Web Development 1 template import"
```

## Phase 1 Acceptance Criteria

- The master template contains eight ordered missions and 80 editable activities.
- Every mission includes reading, image/media, video/transcript, discussion, guided practice, build task, four quiz formats, optional Level Up, reflection, and badge celebration.
- Quiz mastery defaults to 80% with hints and explanations preserved.
- System administrators can edit all authored details through structured fields.
- Schools can adopt and independently edit a complete copy.
- Learners see child-friendly content but never teacher notes.
- The existing generic course builder remains compatible with older courses.
- Backend tests, frontend tests, frontend build, database import, and browser verification all pass.
