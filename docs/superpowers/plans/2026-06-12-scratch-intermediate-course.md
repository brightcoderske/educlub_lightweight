# Scratch Intermediate Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete, editable, image-supported Scratch Intermediate built-in course template with 10 project-based modules and `.sb3` submissions.

**Architecture:** Keep the existing generic template/import/adoption pipeline. Split shared template validation from course-specific validation profiles, define Scratch content in focused data and builder files, register both built-in templates independently, and extend the existing submission upload boundary to accept Scratch project files.

**Tech Stack:** Node.js, CommonJS, PostgreSQL template importer, React 18, Jest, Node test runner, static PNG/WebP course assets

---

## File Structure

- Create `backend/src/courseTemplates/scratchIntermediate.modules.js`: ten module definitions, objectives, concepts, notes, algorithms, projects, quiz data, and asset metadata.
- Create `backend/src/courseTemplates/scratchIntermediate.template.js`: converts module definitions into normalized eduClub activities.
- Create `backend/test/scratchIntermediate.template.test.js`: course completeness and content-contract tests.
- Create `backend/scripts/import-scratch-intermediate.js`: explicit database import and verification command.
- Modify `backend/src/courseTemplates/templateDefinition.js`: shared validation plus named Web Development and Scratch profiles.
- Modify `backend/src/courseTemplates/webDevelopment1.template.js`: declare its validation profile.
- Modify `backend/src/services/builtInTemplates.service.js`: independently skip/import every built-in template.
- Modify `backend/src/server.js`: log aggregate multi-template import results.
- Modify `backend/src/controllers/courses.controller.js`: allow Scratch `.sb3` uploads.
- Create `backend/test/submissionUploads.test.js`: upload MIME/extension validation coverage.
- Modify `backend/package.json`: add the Scratch import command.
- Modify `frontend/src/layouts/learner/module-learn/activityContent.js`: expose submission accept/help metadata.
- Modify `frontend/src/layouts/learner/module-learn/index.js`: show Scratch upload guidance and accept `.sb3`.
- Modify `frontend/src/__tests__/activityContent.test.js`: submission metadata tests.
- Create `frontend/public/course-assets/scratch-intermediate/`: generated course cover, roadmap, module heroes, and algorithm diagrams.

### Task 1: Generalize Template Validation Profiles

**Files:**
- Modify: `backend/src/courseTemplates/templateDefinition.js`
- Modify: `backend/src/courseTemplates/webDevelopment1.template.js`
- Modify: `backend/test/templateDefinition.test.js`

- [ ] **Step 1: Write failing profile tests**

Add tests that prove shared validation accepts different course lengths while the Web Development profile retains its exact rules:

```js
test("shared validation does not force every template to eight modules", () => {
  const generic = {
    name: "Small Course",
    code: "SMALL",
    estimated_weeks: 1,
    learning_objectives: ["Complete one project."],
    validation_profile: "generic",
    modules: [{
      title: "Module 1",
      activities: [{
        title: "Read",
        activity_type: "lesson",
        content: { purpose: "reading", body: "Hello" },
      }],
    }],
  };
  assert.equal(validateTemplateDefinition(generic).modules.length, 1);
});

test("Web Development profile still requires eight complete missions", () => {
  assert.equal(validateTemplateDefinition(template).modules.length, 8);
  assert.throws(
    () => validateTemplateDefinition({ ...template, modules: template.modules.slice(0, 7) }),
    /eight modules/
  );
});
```

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```powershell
cd backend
node --test test/templateDefinition.test.js
```

Expected: the generic course fails because the current validator requires eight weeks/modules and Web Development's fixed activity sequence.

- [ ] **Step 3: Split shared and profile validation**

Implement:

```js
const PROFILE_VALIDATORS = {
  generic: () => {},
  web_development_1: validateWebDevelopment1,
  scratch_intermediate: validateScratchIntermediate,
};

function validateTemplateDefinition(input) {
  const definition = normalizeTemplateDefinition(input);
  validateSharedDefinition(definition);
  const profile = definition.validation_profile || "generic";
  const validateProfile = PROFILE_VALIDATORS[profile];
  if (!validateProfile) throw new Error(`Unknown template validation profile ${profile}.`);
  validateProfile(definition);
  return definition;
}
```

Shared validation must require:

```js
if (!definition.name?.trim()) throw new Error("Template name is required.");
if (!definition.code?.trim()) throw new Error("Template code is required.");
if (!Number.isInteger(Number(definition.estimated_weeks)) || Number(definition.estimated_weeks) < 1) {
  throw new Error("Template estimated weeks must be a positive number.");
}
if (!definition.modules.length) throw new Error("Template must contain at least one module.");
```

Keep activity type, unique position, quiz completeness, and media-alt validation shared. Move the eight-module, ten-purpose, mixed quiz format, and 80-percent rules into `validateWebDevelopment1`.

Add this property to the Web Development export:

```js
validation_profile: "web_development_1",
```

- [ ] **Step 4: Run profile tests**

Run:

```powershell
cd backend
node --test test/templateDefinition.test.js
```

Expected: all template definition tests pass.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/courseTemplates/templateDefinition.js backend/src/courseTemplates/webDevelopment1.template.js backend/test/templateDefinition.test.js
git commit -m "refactor: support course-specific template validation"
```

### Task 2: Define the Complete Scratch Course

**Files:**
- Create: `backend/src/courseTemplates/scratchIntermediate.modules.js`
- Create: `backend/src/courseTemplates/scratchIntermediate.template.js`
- Create: `backend/test/scratchIntermediate.template.test.js`

- [ ] **Step 1: Write failing course-contract tests**

Create tests for the exact requirements:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateTemplateDefinition } = require("../src/courseTemplates/templateDefinition");
const template = require("../src/courseTemplates/scratchIntermediate.template");

test("Scratch Intermediate contains ten modules", () => {
  const result = validateTemplateDefinition(template);
  assert.equal(result.modules.length, 10);
});

test("every module contains the required project learning components", () => {
  const result = validateTemplateDefinition(template);
  for (const module of result.modules) {
    assert.ok(module.learning_outcomes.length >= 4);
    const purposes = module.activities.map((activity) => activity.content.purpose);
    for (const purpose of [
      "overview", "visual_learning", "algorithm", "guided_practice",
      "main_project", "challenge", "quiz", "reflection",
    ]) {
      assert.ok(purposes.includes(purpose), `${module.title} missing ${purpose}`);
    }
    const quiz = module.activities.find((activity) => activity.content.purpose === "quiz");
    assert.equal(quiz.content.questions.length, 5);
    assert.ok(quiz.content.questions.every((question) =>
      question.question_type === "multiple_choice" &&
      question.hint &&
      question.explanation
    ));
    const project = module.activities.find(
      (activity) => activity.content.purpose === "main_project"
    );
    assert.equal(project.activity_type, "project");
    assert.match(project.content.submission_instructions, /\.sb3/);
  }
});

test("every visual uses a local asset and accessible alternative text", () => {
  for (const module of validateTemplateDefinition(template).modules) {
    for (const activity of module.activities.filter((item) => item.content.media?.image_url)) {
      assert.match(
        activity.content.media.image_url,
        /^\/course-assets\/scratch-intermediate\//
      );
      assert.ok(activity.content.media.image_alt.trim());
    }
  }
});
```

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```powershell
cd backend
node --test test/scratchIntermediate.template.test.js
```

Expected: FAIL because the template files do not exist.

- [ ] **Step 3: Create focused module data**

Define ten objects in `scratchIntermediate.modules.js`. Every module must include:

```js
{
  slug: "interactive-story-studio",
  title: "Module 1 - Interactive Story Studio",
  badge: "Story Director",
  overview: "Welcome to Scratch Intermediate. You will plan and build an interactive story while reviewing events, sequences, coordinates, timing, and broadcasts.",
  objectives: [
    "By the end of this module, create a three-scene story using at least three broadcasts.",
    "Sequence dialogue so each character speaks in the intended order.",
    "Test two user choices and record whether each ending works.",
    "Submit a working .sb3 project and explain one debugging decision.",
  ],
  concepts: [
    { term: "Broadcast", meaning: "A message that tells one or more sprites to begin a script." },
    { term: "Sequence", meaning: "Instructions placed in the order they must happen." },
    { term: "Event", meaning: "Something that starts a script, such as clicking the green flag." },
    { term: "Coordinate", meaning: "An x and y position that locates a sprite on the stage." },
  ],
  guidedNotes: [
    "Plan each scene before adding blocks. Give every scene one clear purpose.",
    "Use broadcasts to coordinate sprites instead of guessing with long wait blocks.",
    "Choose File > Save to your computer to download an .sb3 project for eduClub.",
    "Use safe project names and never place private contact information in a project.",
    "Test after each scene and use the hints when a script does not run as expected.",
  ],
  algorithm: {
    steps: [
      "START",
      "Show the title scene",
      "Introduce both characters",
      "Ask the player to choose A or B",
      "Read the player's answer",
      "Broadcast the matching scene",
      "Play the selected ending",
      "END",
    ],
    decisions: ["Did the player choose option A?"],
  },
  practice: {
    title: "Two-Sprite Conversation",
    instructions: "Use broadcasts so two sprites speak in the correct order without talking over each other.",
    successChecks: [
      "The green flag starts the conversation.",
      "Each sprite waits for the correct broadcast.",
      "The dialogue always plays in the intended order.",
    ],
  },
  project: {
    title: "Choose Your Story",
    brief: "Create a three-scene interactive story in which the player makes a choice that changes the ending.",
    successChecks: [
      "The project contains at least three backdrops or scenes.",
      "At least two sprites communicate using three broadcasts.",
      "The player makes one choice.",
      "Both endings have been tested.",
    ],
  },
  challenge: "Add a second decision so the story can reach three different endings.",
  reflection: [
    "What did you learn about coordinating sprites?",
    "Which bug did you find, and how did you fix it?",
    "What would you improve if you had another session?",
  ],
  quiz: [
    {
      id: "m1-q1",
      prompt: "Which block is best for telling several sprites that a new scene should begin?",
      options: ["broadcast message", "move 10 steps", "change size by 10", "pen down"],
      correct_answer: "broadcast message",
      points: 1,
      hint: "Look for the block that sends information to other sprites.",
      explanation: "A broadcast sends a named message that other sprites can receive.",
    },
  ],
  teacherNotes: "Demonstrate one broadcast and receiving script. Watch for learners using unrelated wait blocks instead of messages. Ask learners to test both story choices.",
  heroImage: "/course-assets/scratch-intermediate/module-01-story.webp",
  heroAlt: "Two young creators planning an interactive space story with characters and branching scenes.",
  algorithmImage: "/course-assets/scratch-intermediate/module-01-algorithm.webp",
  algorithmAlt: "Flowchart that starts a story, asks for a choice, and follows one of two endings.",
}
```

Populate the ten approved projects:

1. Interactive Story Studio
2. Maze Game Designer
3. Catch and Score
4. Clone Attack
5. Quiz Show Challenge
6. Animation and Music Lab
7. Smart Pet Simulator
8. Drawing Machine
9. Eco-System Simulation
10. Portfolio Capstone

Module 1 guided notes must include the course introduction, saving `.sb3`, submission, privacy, hints, and testing guidance.

- [ ] **Step 4: Build normalized activities**

In `scratchIntermediate.template.js`, convert every module into eight activities:

```js
[
  activity("Explore the Module", "lesson", "overview", overviewContent),
  activity("See How It Works", "lesson", "visual_learning", visualContent),
  activity("Plan the Algorithm", "coding", "algorithm", algorithmContent),
  activity("Try It", "coding", "guided_practice", practiceContent),
  activity("Build the Main Project", "project", "main_project", projectContent, {
    points: 20,
    completion_rule: "submitted",
  }),
  activity("Challenge Extension", "assignment", "challenge", challengeContent, {
    is_required: false,
    completion_rule: "submitted",
  }),
  activity("Knowledge Check", "quiz", "quiz", quizContent, {
    points: 5,
    completion_rule: "score_at_least",
    pass_score: 80,
  }),
  activity("Reflect and Submit", "reflection", "reflection", reflectionContent, {
    completion_rule: "submitted",
  }),
]
```

Project instructions must say:

```text
Download your Scratch project as an .sb3 file. Upload the .sb3 file here, then add a short note explaining what works and what you improved.
```

Export:

```js
module.exports = {
  name: "Scratch Intermediate: Creating Games, Animations and Interactive Projects",
  code: "SCRATCH-INTERMEDIATE",
  validation_profile: "scratch_intermediate",
  description: "Create games, animations, quizzes, simulations, and interactive stories while learning algorithms, computational thinking, debugging, and project design.",
  target_level: "Ages 8-14 | Intermediate",
  image_url: "/course-assets/scratch-intermediate/course-cover.webp",
  estimated_weeks: 10,
  learning_objectives: [
    "Plan programs with algorithms, flowcharts, and clear sequences.",
    "Use intermediate Scratch concepts to create interactive projects.",
    "Test, debug, and improve programs using evidence.",
    "Complete a portfolio of original Scratch projects.",
  ],
  certificate_enabled: true,
  course_category: "general",
  settings: {
    mastery_score: 80,
    unlimited_quiz_retries: true,
    project_file_extension: ".sb3",
  },
  modules: modules.map(buildModule),
};
```

- [ ] **Step 5: Add the Scratch profile rules**

In `templateDefinition.js`, implement `validateScratchIntermediate` to require:

```js
if (definition.modules.length !== 10) {
  throw new Error("Scratch Intermediate must contain ten modules.");
}
```

For every module, require four objectives, all eight purposes, exactly five multiple-choice quiz questions, local visual paths with alt text, and `.sb3` project instructions.

- [ ] **Step 6: Run course tests**

Run:

```powershell
cd backend
node --test test/templateDefinition.test.js test/scratchIntermediate.template.test.js
```

Expected: all tests pass and report no validation errors.

- [ ] **Step 7: Commit**

```powershell
git add backend/src/courseTemplates/templateDefinition.js backend/src/courseTemplates/scratchIntermediate.modules.js backend/src/courseTemplates/scratchIntermediate.template.js backend/test/scratchIntermediate.template.test.js
git commit -m "feat: add Scratch Intermediate course content"
```

### Task 3: Generate and Wire Course Visuals

**Files:**
- Create: `frontend/public/course-assets/scratch-intermediate/course-cover.webp`
- Create: `frontend/public/course-assets/scratch-intermediate/course-roadmap.webp`
- Create: `frontend/public/course-assets/scratch-intermediate/module-01-story.webp`
- Create: `frontend/public/course-assets/scratch-intermediate/module-01-algorithm.webp`
- Create: corresponding `module-02` through `module-10` hero and algorithm WebP files
- Modify: `backend/test/scratchIntermediate.template.test.js`

- [ ] **Step 1: Add an asset-existence test**

Resolve public paths into the frontend public directory:

```js
const fs = require("node:fs");
const path = require("node:path");

test("every declared Scratch image exists", () => {
  const imageUrls = new Set([
    template.image_url,
    ...template.modules.flatMap((module) =>
      module.activities
        .map((activity) => activity.content.media?.image_url)
        .filter(Boolean)
    ),
  ]);
  for (const imageUrl of imageUrls) {
    assert.equal(
      fs.existsSync(path.join(__dirname, "../../frontend/public", imageUrl)),
      true,
      `Missing ${imageUrl}`
    );
  }
});
```

- [ ] **Step 2: Run the test and confirm missing assets**

Run:

```powershell
cd backend
node --test test/scratchIntermediate.template.test.js
```

Expected: FAIL listing the first missing course asset.

- [ ] **Step 3: Generate the visual set with the image generation skill**

Generate 22 original images:

- Cover: a diverse group of children creating colorful games, animation, quiz,
  drawing, and simulation projects on laptops; bright educational illustration;
  no logos; no readable UI text.
- Roadmap: ten connected project islands or cards, one per module; numbered
  clearly; simple labels only.
- Ten heroes: one scene illustrating each module project.
- Ten algorithms: clean educational flowcharts with large shapes, short labels,
  START/END, arrows, and Yes/No branches where required.

Use a consistent palette and 16:9 composition. Do not reproduce the Scratch
interface or Scratch cat. Save optimized WebP files, targeting under 350 KB per
image where practical.

- [ ] **Step 4: Inspect generated assets**

Check:

```powershell
Get-ChildItem frontend/public/course-assets/scratch-intermediate -File |
  Select-Object Name,Length
```

Expected: 22 WebP files, none empty, with predictable names.

Visually inspect the cover, roadmap, one hero, and one algorithm image. Regenerate
any image with unreadable flowchart labels, accidental logos, frightening
content, or inconsistent style.

- [ ] **Step 5: Run asset tests**

Run:

```powershell
cd backend
node --test test/scratchIntermediate.template.test.js
```

Expected: all Scratch template and asset tests pass.

- [ ] **Step 6: Commit**

```powershell
git add frontend/public/course-assets/scratch-intermediate backend/test/scratchIntermediate.template.test.js
git commit -m "feat: add Scratch course learning visuals"
```

### Task 4: Import Multiple Built-In Templates Independently

**Files:**
- Modify: `backend/src/services/builtInTemplates.service.js`
- Modify: `backend/src/server.js`
- Modify: `backend/test/builtInTemplates.service.test.js`

- [ ] **Step 1: Replace single-template tests with registry tests**

Test one existing and one missing template:

```js
test("skips existing templates and imports missing templates independently", async () => {
  const selectedCodes = [];
  let moduleId = 10;
  const client = {
    query: async (sql, params = []) => {
      if (sql.includes("SELECT id FROM course_templates")) {
        selectedCodes.push(params[0]);
        return params[0] === "WEB-DEV-1" ? { rows: [{ id: 42 }] } : { rows: [] };
      }
      if (sql.includes("INSERT INTO course_templates")) return { rows: [{ id: 77 }] };
      if (sql.includes("INSERT INTO course_template_modules")) {
        return { rows: [{ id: moduleId++ }] };
      }
      return { rows: [] };
    },
    release: () => {},
  };

  const result = await importBuiltInTemplates({ connect: async () => client });
  assert.deepEqual(selectedCodes, ["WEB-DEV-1", "SCRATCH-INTERMEDIATE"]);
  assert.equal(result.templates.length, 2);
  assert.equal(result.imported, 1);
  assert.equal(result.skipped, 1);
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```powershell
cd backend
node --test test/builtInTemplates.service.test.js
```

Expected: FAIL because only Web Development 1 is registered.

- [ ] **Step 3: Implement a built-in template registry**

Use:

```js
const builtInTemplates = [
  require("../courseTemplates/webDevelopment1.template"),
  require("../courseTemplates/scratchIntermediate.template"),
];
```

Loop on one checked-out client, check each code, skip existing rows, and call
`importTemplateDefinition` only for missing templates. Return:

```js
{
  imported,
  skipped,
  modules,
  activities,
  templates: [
    { code, template_id, skipped, modules, activities },
  ],
}
```

Update server logging to report:

```js
`Built-in templates ready: ${result.imported} imported, ${result.skipped} preserved, ${result.modules} modules, ${result.activities} activities.`
```

- [ ] **Step 4: Run registry and importer tests**

Run:

```powershell
cd backend
node --test test/builtInTemplates.service.test.js test/courseTemplateImport.service.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/services/builtInTemplates.service.js backend/src/server.js backend/test/builtInTemplates.service.test.js
git commit -m "feat: register multiple built-in course templates"
```

### Task 5: Accept Scratch Project Submissions

**Files:**
- Modify: `backend/src/controllers/courses.controller.js`
- Create: `backend/test/submissionUploads.test.js`
- Modify: `frontend/src/layouts/learner/module-learn/activityContent.js`
- Modify: `frontend/src/layouts/learner/module-learn/index.js`
- Modify: `frontend/src/__tests__/activityContent.test.js`

- [ ] **Step 1: Extract and test submission file policy**

Export a pure helper:

```js
const SUBMISSION_FILE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x.scratch.sb3",
  "application/zip",
  "application/octet-stream",
];

function isAllowedSubmissionFile(fileName = "", mimeType = "") {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".sb3") {
    return [
      "application/x.scratch.sb3",
      "application/zip",
      "application/octet-stream",
    ].includes(mimeType.toLowerCase());
  }
  return SUBMISSION_FILE_TYPES.includes(mimeType.toLowerCase());
}
```

Test:

```js
test("accepts Scratch files from common browser MIME types", () => {
  for (const type of [
    "application/x.scratch.sb3",
    "application/zip",
    "application/octet-stream",
  ]) {
    assert.equal(isAllowedSubmissionFile("maze.sb3", type), true);
  }
});

test("does not accept arbitrary zip files as Scratch projects", () => {
  assert.equal(isAllowedSubmissionFile("archive.zip", "application/zip"), false);
});
```

- [ ] **Step 2: Run backend upload tests and confirm failure**

Run:

```powershell
cd backend
node --test test/submissionUploads.test.js
```

Expected: FAIL because the helper and Scratch policy do not exist.

- [ ] **Step 3: Apply the policy at the upload boundary**

Allow a custom `isAllowed` predicate in `saveDataUpload`, then configure
`uploadSubmissionFile` with `isAllowedSubmissionFile`. Preserve the original
extension from `fileName`, keep the 5 MB limit, and change the error to:

```text
Upload an image, PDF, text, Word, or Scratch .sb3 project file.
```

- [ ] **Step 4: Add frontend submission metadata tests**

Extend `selectActivityContent`:

```js
submission: {
  accept: content.submission_accept || DEFAULT_SUBMISSION_ACCEPT,
  help: content.submission_help || "",
},
```

Test:

```js
test("returns Scratch submission guidance", () => {
  const selected = selectActivityContent({
    submission_accept: ".sb3,application/x.scratch.sb3,application/zip",
    submission_help: "Upload your downloaded Scratch .sb3 project.",
  });
  expect(selected.submission.accept).toContain(".sb3");
  expect(selected.submission.help).toContain("Scratch");
});
```

- [ ] **Step 5: Run frontend test and confirm failure**

Run:

```powershell
cd frontend
npm test -- --runInBand activityContent.test.js
```

Expected: FAIL because `submission` is not returned.

- [ ] **Step 6: Wire the file picker**

Use:

```jsx
<input
  hidden
  type="file"
  accept={learnerContent.submission.accept}
  onChange={(event) => onSubmissionFileChange(event.target.files?.[0] || null)}
/>
```

Render `learnerContent.submission.help` below the picker when present. Add
`submission_accept` and `submission_help` to every Scratch main project and
reflection/submission activity:

```js
submission_accept: ".sb3,application/x.scratch.sb3,application/zip,application/octet-stream",
submission_help: "In Scratch, choose File > Save to your computer, then upload the downloaded .sb3 file.",
```

- [ ] **Step 7: Run upload and UI tests**

Run:

```powershell
cd backend
node --test test/submissionUploads.test.js test/scratchIntermediate.template.test.js
cd ..\frontend
npm test -- --runInBand activityContent.test.js
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```powershell
git add backend/src/controllers/courses.controller.js backend/test/submissionUploads.test.js backend/src/courseTemplates/scratchIntermediate.template.js frontend/src/layouts/learner/module-learn/activityContent.js frontend/src/layouts/learner/module-learn/index.js frontend/src/__tests__/activityContent.test.js
git commit -m "feat: support Scratch project submissions"
```

### Task 6: Add Explicit Import Command and Full Verification

**Files:**
- Create: `backend/scripts/import-scratch-intermediate.js`
- Modify: `backend/package.json`
- Modify: `backend/test/packageScripts.test.js`

- [ ] **Step 1: Add a failing package-script test**

Require:

```js
test("provides a Scratch Intermediate import command", () => {
  assert.equal(
    packageJson.scripts["import:scratch-intermediate"],
    "node scripts/import-scratch-intermediate.js"
  );
});
```

- [ ] **Step 2: Run the package test and confirm failure**

Run:

```powershell
cd backend
node --test test/packageScripts.test.js
```

Expected: FAIL because the command is missing.

- [ ] **Step 3: Create the import script**

Follow the Web Development import script pattern. Import
`scratchIntermediate.template`, call `importTemplateDefinition`, then verify and
print:

```text
Imported Scratch Intermediate: template <id>, 10 modules, 80 activities.
Verified database: 10 modules, 80 activities, 10 quizzes, 50 questions, pass score 80-80.
```

The verification query must count quiz questions from each activity's JSON:

```sql
SUM(
  CASE WHEN ta.activity_type = 'quiz'
    THEN jsonb_array_length(COALESCE(ta.content->'questions', '[]'::jsonb))
    ELSE 0
  END
)::integer AS questions
```

Add:

```json
"import:scratch-intermediate": "node scripts/import-scratch-intermediate.js"
```

- [ ] **Step 4: Run all backend tests**

Run:

```powershell
cd backend
npm test
```

Expected: all backend tests pass.

- [ ] **Step 5: Run focused frontend tests and production build**

Run:

```powershell
cd frontend
npm test -- --runInBand activityContent.test.js courseBuilderDialogs.test.js
npm run build
```

Expected: tests pass and the React production build completes successfully.

- [ ] **Step 6: Verify template shape directly**

Run:

```powershell
cd backend
node -e "const t=require('./src/courseTemplates/scratchIntermediate.template'); const v=require('./src/courseTemplates/templateDefinition').validateTemplateDefinition(t); console.log({modules:v.modules.length,activities:v.modules.reduce((n,m)=>n+m.activities.length,0),questions:v.modules.reduce((n,m)=>n+m.activities.filter(a=>a.activity_type==='quiz').reduce((q,a)=>q+a.content.questions.length,0),0)});"
```

Expected:

```text
{ modules: 10, activities: 80, questions: 50 }
```

- [ ] **Step 7: Review the final diff**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors. Existing unrelated deletions or untracked files
remain untouched.

- [ ] **Step 8: Commit**

```powershell
git add backend/scripts/import-scratch-intermediate.js backend/package.json backend/test/packageScripts.test.js
git commit -m "chore: add Scratch course import verification"
```

## Final Manual Checks

- [ ] Start the backend against a development database and confirm startup
  preserves an edited `WEB-DEV-1` template while importing
  `SCRATCH-INTERMEDIATE` when absent.
- [ ] Open the template list and confirm the Scratch cover appears.
- [ ] Open Module 1 as a learner and verify overview, image, algorithm,
  practice, project, quiz, challenge, and reflection content.
- [ ] Complete a five-question quiz and confirm friendly feedback and retries.
- [ ] Upload a real `.sb3` file under 5 MB and confirm the teacher review view
  can open the stored submission link.
- [ ] Confirm a normal `.zip` file is rejected.
- [ ] Check one module on a narrow mobile viewport and confirm images scale
  without horizontal scrolling.
- [ ] Adopt the template into a school course and confirm all 10 modules,
  80 activities, media paths, and quiz questions copy correctly.
