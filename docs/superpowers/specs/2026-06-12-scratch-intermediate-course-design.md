# Scratch Intermediate Course Design

## Course Identity

**Title:** Scratch Intermediate: Creating Games, Animations and Interactive Projects

**Template code:** `SCRATCH-INTERMEDIATE`

**Audience:** Learners aged 8-14

**Level:** Intermediate

**Duration:** 10 modules

**Approach:** Project-based, self-paced learning suitable for classrooms and coding clubs

**Final outcome:** Each learner completes a Scratch portfolio containing games,
animations, quizzes, simulations, and interactive stories.

## Product Direction

The course will be an editable built-in master template. Schools adopt a copy
through the existing template workflow, then authorized staff may edit its
modules, activities, text, images, quizzes, projects, and teacher notes.

The implementation will reuse the existing course builder, learner module view,
quiz system, reflection activities, project submissions, file uploads, template
adoption, and template synchronization. Database changes are not expected.

The built-in template validator will be generalized so template-specific rules
do not force every course to contain the Web Development 1 structure of eight
modules and ten fixed activity purposes.

## Learning Goals

By the end of the course, learners will be able to:

- plan programs using algorithms, sequences, flowcharts, and pseudocode;
- use events, loops, conditionals, variables, lists, messages, clones, and
  custom blocks in Scratch projects;
- break large problems into smaller steps and test one part at a time;
- find and repair logical, timing, input, and movement bugs;
- design interactive projects that respond clearly to users;
- explain important design and coding decisions;
- improve projects through testing, feedback, and reflection;
- create and submit a portfolio of original Scratch projects.

Each module will also contain at least four specific, measurable objectives
using observable actions such as create, explain, test, compare, debug, and
submit.

## Module Learning Pattern

Each module will contain the following learner experiences. They may be grouped
into activities in the way that best fits the existing builder rather than
forcing every heading to become a separate database activity.

1. Module overview and four or more SMART learning objectives
2. Key concepts explained in child-friendly language
3. Visual learning guide with an original image, diagram, or annotated Scratch
   illustration
4. Detailed guided notes with short examples and vocabulary
5. Algorithm thinking activity using steps, pseudocode, or a flowchart
6. Short hands-on Scratch practice
7. Main project with success checks
8. Optional challenge extension
9. Five-question multiple-choice knowledge check
10. Reflection and `.sb3` project submission

The practical activity sequence will use existing supported types:

- `lesson` for overview, concepts, guided notes, and visual learning;
- `coding` for algorithm planning and hands-on practice instructions;
- `project` for the main build and `.sb3` upload;
- `quiz` for the five-question knowledge check;
- `assignment` for the optional challenge;
- `reflection` for learner reflection.

Quiz mastery will default to 80 percent with friendly hints, explanations, and
unlimited retries. Challenge activities remain optional.

## Course Introduction

Module 1 will begin with a short introduction for learners who have not used
eduClub courses before. It will explain:

- what learners will create during the ten modules;
- how to open Scratch and save an `.sb3` project;
- how to follow a lesson, complete a quiz, and upload work;
- how to use safe project names and avoid sharing private information;
- how to ask for help and use hints;
- how to test often and treat mistakes as useful information.

This introduction is part of the template content and does not require a new
platform onboarding feature.

## Ten-Module Journey

### Module 1: Interactive Story Studio

**Focus:** Review events, sequences, coordinates, timing, and messages.

**Algorithm:** Start the story, introduce characters, broadcast scene changes,
wait for dialogue, switch backdrops, and end.

**Practice:** Coordinate a short conversation between two sprites.

**Main project:** Create a three-scene interactive story with a user choice.

**Challenge:** Add a second ending based on the learner's choice.

### Module 2: Maze Game Designer

**Focus:** Movement, keyboard input, sensing, conditionals, and coordinates.

**Algorithm:** Read a key, move the player, check wall contact, undo invalid
movement, check the goal, and finish the level.

**Practice:** Move a sprite with arrow keys while stopping at walls.

**Main project:** Build a maze game with a goal and restart behavior.

**Challenge:** Add a timer, hazards, or a second level.

### Module 3: Catch and Score

**Focus:** Variables, random positions, loops, scoring, and game rules.

**Algorithm:** Reset the score, spawn an item, move it, test for a catch or
miss, update the score, and repeat until time ends.

**Practice:** Create a collectible that appears at random positions.

**Main project:** Build a timed catching game with score and feedback.

**Challenge:** Add bonus and penalty objects with different point values.

### Module 4: Clone Attack

**Focus:** Clones, repeated behavior, spawn control, and difficulty.

**Algorithm:** Create enemies at intervals, give each clone movement rules,
check collisions, change lives or score, delete clones, and increase difficulty.

**Practice:** Make clones appear and move independently.

**Main project:** Create an avoid-or-defend game using clones.

**Challenge:** Add enemy types with different speeds or behavior.

### Module 5: Quiz Show Challenge

**Focus:** Questions, answers, conditionals, variables, validation, and feedback.

**Algorithm:** Ask a question, normalize or check the answer, give feedback,
update the score, move to the next question, and show the result.

**Practice:** Build one question with correct and incorrect feedback.

**Main project:** Create a five-question interactive quiz.

**Challenge:** Use a list as a question bank or add a countdown.

### Module 6: Animation and Music Lab

**Focus:** Costumes, sound, timing, parallel scripts, and synchronization.

**Algorithm:** Start music, animate performers, broadcast cues, synchronize
costume and backdrop changes, then finish together.

**Practice:** Synchronize movement with a sound beat.

**Main project:** Produce a short animated music or dance performance.

**Challenge:** Add camera-style scene changes or an interactive remix control.

### Module 7: Smart Pet Simulator

**Focus:** State, variables, decisions, gradual change, and simulation rules.

**Algorithm:** Set hunger and happiness, read player actions, change the pet's
state over time, choose reactions, prevent invalid values, and continue.

**Practice:** Change a sprite's mood based on one variable.

**Main project:** Build a virtual pet with needs and several player actions.

**Challenge:** Add day and night, health, or saved high-score-style progress.

### Module 8: Drawing Machine

**Focus:** Pen tools, loops, angles, custom blocks, and parameters.

**Algorithm:** Clear the stage, choose shape values, repeat movement and turns,
change color or size, and draw a pattern.

**Practice:** Create a custom block that draws a polygon.

**Main project:** Build an interactive geometric art generator.

**Challenge:** Create spirals or let the user control sides, size, and color.

### Module 9: Eco-System Simulation

**Focus:** Modeling, probability, clones or lists, rules, and observation.

**Algorithm:** Create organisms, apply movement and survival rules, reproduce
under set conditions, remove organisms when conditions fail, and report change.

**Practice:** Simulate one creature responding to food or weather.

**Main project:** Create a simple ecosystem or real-world process simulation.

**Challenge:** Add a controllable environmental variable and compare outcomes.

### Module 10: Portfolio Capstone

**Focus:** Decomposition, planning, iteration, debugging, user testing, and
presentation.

**Algorithm:** Choose a problem, define the user and goal, split the project
into features, plan scripts, build the minimum version, test, improve, and
present.

**Practice:** Produce a project proposal, flowchart, sprite list, and test plan.

**Main project:** Create an original polished Scratch game, animation, quiz,
story, or simulation that combines at least four intermediate concepts.

**Challenge:** Add accessibility options, multiple levels, or an advanced
feature justified by the learner.

## Visual Asset Set

The course will ship with original generated visual assets rather than empty
image placeholders. Assets will use a consistent bright, friendly,
classroom-safe illustration style and readable labels.

The minimum set is:

- one course cover image;
- one course roadmap showing all ten projects;
- one module hero image per module;
- one algorithm or flowchart diagram per module;
- selected annotated Scratch-style concept diagrams where they improve
  understanding, such as coordinates, broadcasts, clones, variables, custom
  blocks, and simulation rules.

Generated images must not imitate protected Scratch branding or reproduce the
Scratch interface exactly. Block diagrams will be original educational
illustrations using generic puzzle-shaped coding blocks and descriptive labels.

Assets will be stored in a stable public course-assets directory with predictable
file names. Every image will have concise alternative text, a written
explanation in the lesson, and a graceful text-only fallback. The template will
reference local assets so adopted school courses do not depend on third-party
image hosts.

## Guided Notes and Algorithms

Guided notes will use:

- short paragraphs and clear headings;
- one new idea at a time;
- real-world comparisons;
- vocabulary cards;
- block-by-block explanations;
- "predict before running" prompts;
- common mistake and debugging callouts;
- success checklists.

Algorithms will be represented in both plain numbered steps and a flowchart
image. Decision points will use questions such as "Touching the wall?" with
clearly labeled Yes and No paths. Learners will plan before opening Scratch.

## Assessment and Submission

Every module contains:

- a five-question multiple-choice quiz;
- immediate child-friendly feedback and explanations;
- a reflection prompt asking what was learned, what was difficult, and what
  will be improved;
- a required project submission accepting an `.sb3` file;
- an optional short written explanation or screenshot;
- teacher-visible success criteria and feedback guidance.

The platform's existing generic upload support will accept `.sb3` files. The
implementation must verify that file-name, MIME-type, and upload-size handling
do not reject valid Scratch projects. Course text will teach learners how to
download their Scratch project before submission.

## Differentiation

Support for younger or less confident learners includes starter project
instructions, smaller steps, vocabulary reminders, worked algorithms, hints,
and reduced optional workload.

Extension work deepens the same module concept for fast learners. It does not
block completion or introduce unrelated technology.

Activities will avoid assumptions about reading speed, gender, location, or
access to paid tools. Projects will offer safe topic choices and work in club,
classroom, or self-paced settings.

## Teacher Guidance

Each module includes editable teacher notes covering:

- the essential concept;
- preparation and demonstration suggestions;
- common misconceptions;
- questions to ask before coding;
- support and extension strategies;
- expected project evidence;
- a simple project feedback rubric;
- online safety or moderation notes where relevant.

## Builder and Template Changes

The built-in template registry will support more than one template and import
each independently without overwriting an edited existing master.

Template validation will retain shared structural checks while moving
Web Development 1's fixed eight-module and purpose-order requirements into its
own validation profile. The Scratch profile will require:

- exactly 10 ordered modules;
- at least four learning objectives per module;
- visual metadata and alt text;
- an algorithm activity;
- hands-on practice;
- a required main project;
- an optional challenge;
- exactly five multiple-choice quiz questions;
- a reflection;
- a project submission activity.

The template and adopted course remain fully editable through existing course
builder screens.

## Testing

Automated tests will verify:

- both built-in templates validate and import;
- existing Web Development 1 behavior remains unchanged;
- Scratch contains 10 modules and all required learning components;
- every module has at least four objectives and five quiz questions;
- every visual has alternative text and a valid local asset path;
- every project supports submission and includes `.sb3` instructions;
- repeated startup imports skip existing editable templates independently;
- template adoption preserves content, ordering, quiz data, and media paths;
- learner content renders without an image and remains usable on mobile.

## Success Criteria

The feature is complete when:

- Scratch Intermediate appears as an adoptable built-in course template;
- all 10 modules are complete, editable, and child-friendly;
- every required section from the course prompt is represented;
- original course images and diagrams display with accessible fallbacks;
- learners can complete quizzes, reflections, and upload Scratch projects;
- teachers can review projects and edit the adopted course;
- the existing Web Development template and other course-builder workflows
  continue to work.

## Out of Scope

- Embedding or reproducing the full Scratch editor inside eduClub
- Automatically grading `.sb3` project internals
- Requiring Scratch accounts or public Scratch sharing
- Live multiplayer projects
- Unmoderated public galleries
