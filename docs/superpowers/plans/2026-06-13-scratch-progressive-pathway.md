# Scratch Progressive Pathway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the existing Scratch Intermediate template and ship three additional editable built-in Scratch courses with 30 complete modules, real learner content, projects, challenges, discussions, quizzes, teacher guidance, Scratch submissions, and independent import commands.

**Architecture:** Replace the single Scratch-specific template builder with a shared progressive-course builder and three focused course data files. Keep course-specific content declarative, validate every learner-facing field, register all templates independently, and reuse Educlub's existing activity, quiz, submission, adoption, and synchronization flows.

**Tech Stack:** Node.js, CommonJS, Node test runner, PostgreSQL template importer, React 18, static WebP/SVG course assets

---

### Task 1: Define the Progressive Scratch Contract

**Files:**
- Modify: `backend/src/courseTemplates/templateDefinition.js`
- Create: `backend/test/scratchProgressive.template.test.js`
- Preserve: `backend/test/scratchIntermediate.template.test.js`

- [ ] Write failing tests requiring `SCRATCH-EXPLORER`, `SCRATCH-CREATOR`, and `SCRATCH-INNOVATOR`, each with 10 modules and 9 activities in this order: `overview`, `visual_learning`, `algorithm`, `discussion`, `guided_practice`, `main_project`, `challenge`, `quiz`, `reflection`.
- [ ] Require every overview to contain at least four objectives, four vocabulary items, four guided notes, and a complete 90-minute session plan.
- [ ] Require every discussion to contain a real prompt, three discussion questions, sentence starters, and moderation notes.
- [ ] Require every guided practice to contain a project brief, at least five steps, three success checks, and three debugging hints.
- [ ] Require every main project to contain two complete project choices, each with a brief, build steps, and success checks.
- [ ] Require every challenge to contain an extension brief, steps, and success checks.
- [ ] Require every quiz to contain five unique multiple-choice questions, four options, one valid answer, a specific hint, and a specific explanation.
- [ ] Require every reflection to contain four prompts and `.sb3` submission guidance.
- [ ] Require Creator and Innovator AI modules to include privacy, testing, limitations, and human-oversight guidance.
- [ ] Run `node --test test/scratchProgressive.template.test.js` and confirm failure because the three templates do not exist.
- [ ] Replace `scratch_intermediate` validation with `scratch_progressive`, enforcing the complete contract above.
- [ ] Run the focused validation tests and confirm they pass.

### Task 2: Build the Shared Course Factory and Scratch Explorer

**Files:**
- Create: `backend/src/courseTemplates/scratchProgressive.builder.js`
- Create: `backend/src/courseTemplates/scratchExplorer.modules.js`
- Create: `backend/src/courseTemplates/scratchExplorer.template.js`

- [ ] Implement a shared builder that transforms complete module data into nine Educlub activities without inventing or padding missing content.
- [ ] Add all ten Explorer modules from the approved design: creative coding, stories, animation/music, patterns, maze, catch/score, quiz, nature movement, engineering testing, and showcase.
- [ ] Write original learner notes, algorithms, discussion prompts, guided projects, two main project choices, extensions, quiz questions, reflections, differentiation, and teacher notes for every Explorer module.
- [ ] Add `.sb3` submission metadata to required projects and reflections.
- [ ] Run focused tests and correct any incomplete learning content.

### Task 3: Build Creator and Innovator as Separate Courses

**Files:**
- Create: `backend/src/courseTemplates/scratchCreator.modules.js`
- Create: `backend/src/courseTemplates/scratchCreator.template.js`
- Create: `backend/src/courseTemplates/scratchInnovator.modules.js`
- Create: `backend/src/courseTemplates/scratchInnovator.template.js`
- Preserve: `backend/src/courseTemplates/scratchIntermediate.modules.js`
- Preserve: `backend/src/courseTemplates/scratchIntermediate.template.js`

- [ ] Use the approved Creator progression to create an independent course containing interactive stories, advanced mazes, arcade systems, procedures, smart pets, forces, ecosystems, data, machine learning, and design challenge.
- [ ] Keep the existing `SCRATCH-INTERMEDIATE` code, content, assets, validation, and tests intact.
- [ ] Add all ten Innovator modules with complete content: software design, game architecture, search/sort/recommendation, scientific modelling, control systems, data science, machine learning, generative AI, AI for people and planet, and capstone.
- [ ] For every real-AI activity, provide a school-approved tool path and a Scratch-only alternative teaching the same concept.
- [ ] Add explicit AI privacy, attribution, bias, accuracy, limitations, and human-review requirements.
- [ ] Run focused tests and verify 30 modules, 270 activities, 150 quiz questions, and no placeholder text.

### Task 4: Register, Import, and Present the Courses

**Files:**
- Modify: `backend/src/services/builtInTemplates.service.js`
- Modify: `backend/test/builtInTemplates.service.test.js`
- Create: `backend/scripts/import-scratch-pathway.js`
- Modify: `backend/package.json`
- Modify: `backend/test/packageScripts.test.js`
- Modify: `backend/src/server.js`

- [ ] Write failing registry tests expecting `WEB-DEV-1`, `SCRATCH-INTERMEDIATE`, `SCRATCH-EXPLORER`, `SCRATCH-CREATOR`, and `SCRATCH-INNOVATOR`.
- [ ] Register the three templates and preserve existing editable masters independently.
- [ ] Add `npm run import:scratch-pathway` to import or update all three Scratch templates deliberately.
- [ ] Update startup logging to report aggregate imported, preserved, module, and activity counts.
- [ ] Run registry, import-service, package-script, and full backend tests.

### Task 5: Complete Submission UI and Course Assets

**Files:**
- Modify: `backend/src/controllers/courses.controller.js`
- Modify: `backend/test/submissionUploads.test.js`
- Modify: `frontend/src/layouts/learner/module-learn/activityContent.js`
- Modify: `frontend/src/layouts/learner/module-learn/index.js`
- Modify: `frontend/src/__tests__/activityContent.test.js`
- Create: `frontend/public/course-assets/scratch-explorer/course-cover.svg`
- Create: `frontend/public/course-assets/scratch-explorer/course-roadmap.svg`
- Create: `frontend/public/course-assets/scratch-creator/course-cover.svg`
- Create: `frontend/public/course-assets/scratch-creator/course-roadmap.svg`
- Create: `frontend/public/course-assets/scratch-innovator/course-cover.svg`
- Create: `frontend/public/course-assets/scratch-innovator/course-roadmap.svg`

- [ ] Keep `.sb3` restricted to recognized Scratch/ZIP/octet-stream MIME types and reject arbitrary ZIP uploads.
- [ ] Ensure the learner picker uses each activity's accepted extensions and displays Scratch saving help.
- [ ] Add accessible original course cover and roadmap assets with distinct Explorer, Creator, and Innovator visual identities.
- [ ] Run focused frontend tests and production build.

### Task 6: Launch Verification

**Files:**
- Review all changed files

- [ ] Run `npm test` in `backend`.
- [ ] Run `npm test -- --runInBand activityContent.test.js` in `frontend`.
- [ ] Run `npm run build` in `frontend`.
- [ ] Run a direct template audit confirming the preserved Intermediate course plus 3 new courses, with the new pathway containing 30 modules, 270 activities, 150 quiz questions, 30 discussions, 60 main project choices, and 30 optional challenges.
- [ ] Run `git diff --check`.
- [ ] Review the final diff for accidental changes and confirm unrelated work remains untouched.
