const { query } = require("../config");
const courseTemplatesService = require("./courseTemplates.service");
const coursesService = require("./courses.service");
const {
  getActiveProvider,
  getAiAvailability,
} = require("./aiSettings.service");
const {
  sanitizeActivityContent,
  sanitizeRichHtml,
} = require("../utils/richTextSanitizer");

const ALLOWED_ACTIVITY_TYPES = new Set([
  "lesson",
  "quiz",
  "assignment",
  "discussion",
  "coding",
  "typing",
  "project",
  "reflection",
]);

const SUPPORTED_MODES = new Set([
  "full_course",
  "outline",
  "modules",
  "activities",
  "quiz_bank",
  "teacher_notes",
  "try_more",
]);

const LEARNER_AI_BLOCKED_ACTIVITY_TYPES = new Set(["quiz"]);
const LEARNER_AI_ACTIONS = {
  explain_simple:
    "Explain this activity in simple steps for a beginner learner.",
  next_step:
    "Tell the learner the next small step to try without doing the work for them.",
  code_idea:
    "Explain the coding idea and what each important part means without giving a full final answer.",
  debug_hint:
    "Help the learner debug their thinking with checks they can try, but do not complete the code.",
  small_hint:
    "Give one small hint and one question the learner should ask themselves.",
  discussion_prompt:
    "Explain the discussion prompt and help the learner understand what kind of idea they can share.",
  plan_reply:
    "Help the learner plan a thoughtful discussion reply without writing the final post.",
  sentence_starters:
    "Give child-friendly sentence starters so the learner can write their own answer.",
  break_down: "Break the task into small steps the learner can follow.",
  expected_work:
    "Explain what good work should include without writing or completing it.",
  project_plan:
    "Help the learner plan the project with simple steps, but do not build it for them.",
  improve_idea:
    "Suggest ways the learner can improve their own idea while still doing the work themselves.",
  checklist: "Give a short checklist the learner can use for this activity.",
  reflection_help:
    "Help the learner reflect with simple questions, without writing the reflection for them.",
  learned_recap:
    "Help the learner identify what they may have learned without writing their answer.",
  typing_tips: "Give simple typing tips based on this activity.",
  improve_typing:
    "Explain how the learner can improve accuracy and speed without rushing.",
  practice_plan: "Give a tiny practice plan the learner can do now.",
  example_idea:
    "Give a small example idea without completing the activity for the learner.",
  quick_recap: "Give a quick recap and the most important thing to remember.",
};
const LEARNER_AI_ALLOWED_HTML_TAGS = new Set([
  "p",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "code",
  "pre",
  "div",
  "span",
  "br",
]);

const COMPLETION_RULES = new Set([
  "manual",
  "viewed",
  "scrolled",
  "submitted",
  "graded",
  "score_at_least",
]);

const EDUCLUB_INTERACTIVE_BLOCK_GUIDE = `Use eduClub-safe interactive HTML only. Do not use <script>, inline event handlers such as onclick, external JavaScript, external CSS, or heavy libraries.
Because the response must be valid JSON, use single-quoted HTML attributes inside rich_html. If you must use double quotes inside any JSON string, escape them as \\".
Allowed interactive patterns:
- Click-to-reveal/flashcard:
  <div data-interactive-block='reveal' data-block-title='Title' data-block-prompt='Question' data-block-answer='Answer'><button type='button' data-interactive-toggle='true'>Show answer</button><div data-interactive-answer='true' hidden>Answer</div></div>
- Hint:
  <button type='button' data-hint-toggle='hint-1' aria-expanded='false'>Show hint</button><div data-hint-panel='hint-1'>Helpful hint text.</div>
- Progress and checklist:
  <div data-rich-root='activity-key'><div data-rich-progress='activity-key'><span data-rich-progress-text>0% complete</span><div><div data-rich-progress-fill style='width:0%'></div></div></div><label><input type='checkbox' data-rich-check data-rich-key='activity-key-step-1'> I tried step 1</label></div>
- Mini quiz:
  <div data-rich-quiz='activity-key-q1'><p>Question?</p><button type='button' data-quiz-option data-correct='true'>Correct option</button><button type='button' data-quiz-option data-correct='false'>Wrong option</button><p data-quiz-feedback></p></div>
- Reflection:
  <textarea data-rich-reflection data-rich-key='activity-key-reflection' placeholder='Write your idea here.'></textarea>
- Celebration:
  <button type='button' data-celebrate='true'>Celebrate progress</button>`;

const ACTIVITY_OUTPUT_SCHEMA = `Return JSON only with this shape:
{
  "title": "activity title",
  "activity_type": "lesson|quiz|assignment|discussion|coding|typing|project|reflection",
  "points": 0,
  "completion_rule": "manual|viewed|scrolled|submitted|graded|score_at_least",
  "pass_score": 50,
  "content": {
    "purpose": "why learners are doing this",
    "description": "short teacher-facing description",
    "rich_html": "rich learner HTML using lightweight vanilla HTML/CSS/JS only",
    "discussion_prompt": "for discussion activities",
    "project_brief": "for project activities",
    "submission_instructions": "for assignment/project activities",
    "reflection_prompt": "for reflection activities",
    "teacher_notes": "teacher guide",
    "friendly_hints": ["hint one"],
    "starter_html": "",
    "starter_css": "",
    "starter_js": "",
    "language": "html_css",
    "challenge_mode": "build",
    "validation_checks": [],
    "questions": []
  }
}`;

function normalizeCompletionRule(rule, activityType) {
  if (activityType === "quiz") return "score_at_least";
  const normalized = String(rule || "")
    .trim()
    .toLowerCase();
  if (normalized === "score") return "score_at_least";
  if (normalized === "submission") return "submitted";
  return COMPLETION_RULES.has(normalized) ? normalized : "manual";
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function stripCodeFences(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseJsonDraft(text) {
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("AI returned content that was not valid JSON.");
  }
}

function buildJsonRepairMessages(rawText, parseError) {
  const clippedText = String(rawText || "").slice(0, 30000);
  return [
    {
      role: "system",
      content:
        "You repair invalid JSON for eduClub AI course content. Return complete valid JSON only. Do not add markdown fences, notes, summaries, or explanations.",
    },
    {
      role: "user",
      content: `Repair this invalid JSON into complete valid JSON.
Keep the same data and content wherever possible.
If rich_html contains HTML attributes, prefer single-quoted HTML attributes so JSON strings stay valid.
If any double quotes must remain inside JSON string values, escape them correctly.
If the JSON was truncated, close all open strings, arrays, and objects in the most sensible way without inventing unrelated modules.
Return complete valid JSON only.

Parser error:
${parseError?.message || "Unknown JSON parse error"}

Invalid JSON:
${clippedText}`,
    },
  ];
}

async function parseJsonDraftWithRepair(text, repairText) {
  try {
    return parseJsonDraft(text);
  } catch (initialError) {
    if (typeof repairText !== "function") {
      throw initialError;
    }

    const repairMessages = buildJsonRepairMessages(text, initialError);
    const repairedText = await repairText(repairMessages);
    try {
      return parseJsonDraft(repairedText);
    } catch (repairError) {
      throw new Error(
        `AI returned invalid JSON after an automatic repair attempt. ${repairError.message}`
      );
    }
  }
}

function normalizeQuestion(question = {}, index = 0) {
  const type = question.question_type || question.type || "multiple_choice";
  const options = Array.isArray(question.options)
    ? question.options.map((option) => String(option).trim()).filter(Boolean)
    : [];
  return {
    id: question.id || `ai-q-${Date.now()}-${index + 1}`,
    question_type: [
      "multiple_choice",
      "true_false",
      "short_answer",
      "matching",
      "ordering",
    ].includes(type)
      ? type
      : "multiple_choice",
    prompt: String(question.prompt || question.question || "").trim(),
    options,
    correct_answer: question.correct_answer ?? question.answer ?? "",
    acceptable_answers: Array.isArray(question.acceptable_answers)
      ? question.acceptable_answers
      : [],
    pairs: Array.isArray(question.pairs) ? question.pairs : [],
    correct_order: Array.isArray(question.correct_order)
      ? question.correct_order
      : [],
    points: clampNumber(question.points, 1, 1, 20),
    position: index + 1,
    hint: String(question.hint || "").trim(),
    explanation: String(question.explanation || "").trim(),
    image_url: String(question.image_url || "").trim(),
  };
}

function normalizeActivity(activity = {}, index = 0) {
  const activityType = ALLOWED_ACTIVITY_TYPES.has(activity.activity_type)
    ? activity.activity_type
    : "lesson";
  const completionRule = normalizeCompletionRule(
    activity.completion_rule,
    activityType
  );
  const content = sanitizeActivityContent(activity.content || {});
  const questions = Array.isArray(content.questions)
    ? content.questions
        .map(normalizeQuestion)
        .filter((question) => question.prompt)
    : [];
  const normalizedContent = {
    ...content,
    body:
      typeof content.body === "string"
        ? sanitizeRichHtml(content.body)
        : sanitizeRichHtml(
            String(activity.description || activity.summary || "")
          ),
    teacher_notes: Array.isArray(content.teacher_notes)
      ? content.teacher_notes
      : Array.isArray(activity.teacher_notes)
      ? activity.teacher_notes
      : [],
    questions,
  };

  return {
    title: String(activity.title || `Activity ${index + 1}`).trim(),
    activity_type: activityType,
    content: normalizedContent,
    points: clampNumber(
      activity.points,
      questions.reduce(
        (total, question) => total + Number(question.points || 0),
        0
      ),
      0,
      100
    ),
    position: index + 1,
    is_required:
      activity.availability_mode === "try_more"
        ? false
        : activity.is_required !== false,
    availability_mode:
      activity.availability_mode === "try_more" ? "try_more" : "required",
    completion_rule: completionRule,
    pass_score:
      completionRule === "score_at_least"
        ? clampNumber(activity.pass_score, 50, 1, 100)
        : activity.pass_score || null,
    is_published: activity.is_published !== false,
  };
}

function normalizeCourseDraft(rawDraft = {}) {
  const modules = Array.isArray(rawDraft.modules) ? rawDraft.modules : [];
  return {
    title: String(rawDraft.title || rawDraft.name || "AI course draft").trim(),
    description: String(rawDraft.description || "").trim(),
    learning_objectives: Array.isArray(rawDraft.learning_objectives)
      ? rawDraft.learning_objectives.map(String).filter(Boolean)
      : [],
    teacher_notes: Array.isArray(rawDraft.teacher_notes)
      ? rawDraft.teacher_notes.map(String).filter(Boolean)
      : [],
    modules: modules
      .map((courseModule, moduleIndex) => ({
        title: String(courseModule.title || `Module ${moduleIndex + 1}`).trim(),
        description: String(courseModule.description || "").trim(),
        learning_outcomes: Array.isArray(courseModule.learning_outcomes)
          ? courseModule.learning_outcomes.map(String).filter(Boolean)
          : [],
        position: moduleIndex + 1,
        is_published: courseModule.is_published !== false,
        activities: (Array.isArray(courseModule.activities)
          ? courseModule.activities
          : []
        )
          .map(normalizeActivity)
          .filter((activity) => activity.title),
      }))
      .filter((courseModule) => courseModule.title),
  };
}

function prepareDraftForAppend(rawDraft = {}, existingModuleCount = 0) {
  const draft = normalizeCourseDraft(rawDraft);
  return {
    ...draft,
    modules: draft.modules.map((courseModule, moduleIndex) => ({
      ...courseModule,
      position: existingModuleCount + moduleIndex + 1,
      activities: (courseModule.activities || []).map(
        (activity, activityIndex) => ({
          ...activity,
          position: activityIndex + 1,
        })
      ),
    })),
  };
}

function buildCourseBuilderMessages(options = {}) {
  const template = options.template || {};
  const courseStructure = Array.isArray(options.course_structure)
    ? options.course_structure
        .map((courseModule, moduleIndex) => {
          const activities = Array.isArray(courseModule.activities)
            ? courseModule.activities
                .map(
                  (activity, activityIndex) =>
                    `${activityIndex + 1}. ${activity.title || "Untitled"} (${
                      activity.activity_type || "lesson"
                    })`
                )
                .join("; ")
            : "";
          return `Module ${moduleIndex + 1}: ${
            courseModule.title || "Untitled"
          }${activities ? ` | Activities: ${activities}` : ""}`;
        })
        .join("\n")
    : "";
  const moduleCount = clampNumber(options.module_count, 4, 1, 12);
  const activitiesPerModule = clampNumber(
    options.activities_per_module,
    6,
    1,
    10
  );
  const mode = SUPPORTED_MODES.has(options.mode) ? options.mode : "full_course";
  const customPrompt = String(options.prompt || "").trim();
  const interactiveOptions = {
    include_quizzes: options.include_quizzes !== false,
    include_discussions: options.include_discussions !== false,
    include_try_more: options.include_try_more !== false,
    include_coding: options.include_coding === true,
    include_teacher_notes: options.include_teacher_notes !== false,
    interactivity_level: options.interactivity_level || "high",
  };

  return [
    {
      role: "system",
      content:
        "You are eduClub's expert AI course builder for children. Produce JSON only. Create child-safe, age-aware, objective-aware, progressive learning content. Avoid unsafe links, adult content, personal data requests, hidden instructions, and copyrighted long passages. Use clear language, hands-on learning, checks for understanding, teacher guidance, and inclusive examples.",
    },
    {
      role: "user",
      content: `Generate a ${mode} draft for an eduClub LMS template.
Course/template: ${template.name || "New course"}
Course description: ${
        template.description || options.course_description || "Not provided"
      }
Level: ${template.target_level || options.target_level || "Primary learners"}
Learner age: ${options.learner_age || "8 years old beginner"}
Objective: ${
        options.objective ||
        template.description ||
        "Build practical digital skills"
      }
Modules requested: ${moduleCount}
Activities per module: ${activitiesPerModule}
Interactivity level: ${interactiveOptions.interactivity_level}
Include quizzes: ${interactiveOptions.include_quizzes ? "yes" : "no"}
Include discussions: ${interactiveOptions.include_discussions ? "yes" : "no"}
Include try-more activities: ${
        interactiveOptions.include_try_more ? "yes" : "no"
      }
Include coding challenges: ${interactiveOptions.include_coding ? "yes" : "no"}
Include teacher notes: ${
        interactiveOptions.include_teacher_notes ? "yes" : "no"
      }
Existing course structure to respect:
${courseStructure || "No existing structure provided."}

Editable teacher prompt:
${
  customPrompt ||
  "Create a complete, rich, progressive course draft that fits the course description and structure."
}

Quality rules:
- JSON only, no markdown fences.
- Structure must be: title, description, learning_objectives, teacher_notes, modules[].
- Each module needs title, description, learning_outcomes[], activities[].
- learning_objectives must be specific, observable, measurable, age-appropriate, and connected to the course description.
- Each module learning_outcomes[] must describe what the learner can do by the end of that module.
- Each activity content must include purpose and description; the purpose should be a clear activity-level objective.
- Each activity should teach one focused skill and connect to the module objective.
- Activities must use activity_type from lesson, quiz, assignment, discussion, coding, typing, project, reflection.
- completion_rule must be one of manual, viewed, scrolled, submitted, graded, score_at_least. Use score_at_least for quizzes.
- Include quiz banks with question points, correct answers, hints, explanations, true/false where useful, matching or ordering where useful.
- Make lesson body or rich_html content interactive and clickable where useful using eduClub-safe blocks, hint blocks, reflection prompts, sorting/check questions, and short practice tasks.
- Include rich beginner-friendly visuals using simple image placeholders, icons, diagrams made with HTML/CSS, click-to-reveal cards, flashcards, checkboxes, mini-checks, and slide-style step panels.
- Any slide-style content must work as plain lightweight HTML sections without external libraries.
- For an 8-year-old beginner, use short sentences, concrete examples, playful challenges, and one small skill per step.
- Teach step by step: explain, show an example, let the learner try, give a hint, then check understanding.
- Prefer project-based learning: every module should build toward a small visible creation or real-world task.
- Add lightweight interactive moments only with safe eduClub data attributes; do not use scripts or event handlers inside rich content.
- Include clear learner guides, teacher facilitation notes, common mistakes, and extension ideas.
- Include teacher_notes and try-more activities for fast learners when enabled.
- Make the course progressive: each module should build from the previous one.
- Make learner content interactive but lightweight for fast loading.

${EDUCLUB_INTERACTIVE_BLOCK_GUIDE}`,
    },
  ];
}

function buildActivityBuilderMessages(options = {}) {
  const activity = options.activity || {};
  const activityType = ALLOWED_ACTIVITY_TYPES.has(activity.activity_type)
    ? activity.activity_type
    : "lesson";
  const customPrompt = String(options.prompt || "").trim();
  const generationMode = String(options.generation_mode || "generate_activity")
    .trim()
    .toLowerCase();
  const modulePosition = clampNumber(options.module_position, 1, 1, 100);
  const activityPosition = clampNumber(
    options.activity_position,
    activity.position || 1,
    1,
    100
  );
  const moduleDescription = String(options.module_description || "").trim();
  return [
    {
      role: "system",
      content:
        "You are the EduClub Master Activity Builder: an expert curriculum designer, software engineer, UX designer, child psychologist, coding instructor, and instructional designer for children aged 8-14. Produce JSON only. Keep content child-safe, age-aware, objective-aware, interactive, project-based, self-paced, encouraging, and lightweight. Never ask for personal information. Avoid unsafe external links and heavy libraries.",
    },
    {
      role: "user",
      content: `Create content for one existing eduClub activity only.
Course: ${options.course_name || "Current course"}
Module: ${options.module_title || "Current module"}
Module number: ${modulePosition}
Module description/objective: ${
        moduleDescription || "Use the module title and course context."
      }
Activity title: ${activity.title || "Untitled activity"}
Activity number in module: ${activityPosition}
Activity type: ${activityType}
Generation mode: ${generationMode}
Learner age: ${options.learner_age || "8 years old beginner"}
Marks/points: ${activity.points || 0}
Existing activity description/content:
${JSON.stringify(activity.content || {}, null, 2).slice(0, 4000)}

Teacher fine-tuning prompt:
${
  customPrompt ||
  "Create rich, step-by-step, beginner-friendly activity content."
}

EduClub Master Course Builder principles to follow:
- You are teaching like the world's best coding teacher for children.
- There is no teacher present during the learner experience, so every section must anticipate learner questions, explain difficult ideas simply, and gradually build confidence.
- Do not rush. Learning should feel fun, visual, interactive, encouraging, and original to EduClub.
- The learner should never feel lost.
- Learner profile: age 8-14, complete beginner, curious, learns by doing, learns independently, may make mistakes frequently, and needs constant encouragement.
- EduClub teaching philosophy: Explain -> Show -> Practice Together -> Practice Independently -> Create -> Improve -> Reflect.
- Never introduce a concept before enough background exists.
- Every new idea should connect naturally to previous learning and the current module position.

EduClub Master Prompt for this one activity:
- Generate only one EduClub activity.
- Do not generate any other activities.
- Build this activity as if it is the most important lesson in the module.
- The learner must finish the activity fully understanding the concept without requiring outside help.
- Include an engaging introduction, learning journey, step-by-step explanation, visual examples, code walkthroughs where useful, prediction questions, click-to-reveal hints, common mistakes, debugging moments, quick recap, mini challenge, encouragement, "Did you know?" facts, checkpoints, and reflection.
- The activity must be interactive rather than text-heavy.
- Every explanation should answer: What is this? Why do we use it? When should we use it? What happens if we don't? How does it connect to what we already know?

EduClub Knowledge Check rules when the activity is a quiz or Generation mode is quiz_builder:
- Generate a complete EduClub Knowledge Check.
- Measure understanding rather than memorisation.
- Use a balanced mix of multiple choice, drag-and-match, true/false, identify the mistake, complete the code, predict the output, debugging questions, and short practical coding tasks where suitable.
- Every answer should include immediate feedback explaining why it is correct or incorrect.
- Difficulty should gradually increase.
- Celebrate progress and encourage another attempt when needed.
- The experience should feel like a fun coding game rather than a traditional exam.

Requirements:
- Do not create modules or other activities.
- Keep the generated content focused on this activity only.
- Use the course, module, module number, activity number, activity title, activity description, and activity type as hard context.
- Align this activity with its position in the module: earlier activities should introduce and build confidence; later activities should apply, debug, create, improve, and reflect.
- If Generation mode is explain_activity, deeply explain and improve the existing activity without changing its intent.
- If Generation mode is improve_activity, enrich the current content with clearer scaffolding, interactivity, hints, and teacher notes.
- If Generation mode is quiz_builder, produce a strong knowledge check with mixed question styles and explanations.
- If Generation mode is coding_helper, produce editable browser-safe starter HTML/CSS/JavaScript and validation checks where relevant.
- Follow the EduClub teaching flow exactly where useful: Explain -> Show -> Practice Together -> Practice Independently -> Create -> Improve -> Reflect.
- Use rich_html for learner-facing content.
- Return one complete JSON object in one response. Do not stop mid-string, mid-tag, mid-code-block, or mid-object. If the activity becomes too long, shorten examples and explanations instead of truncating the JSON.
- In rich_html, use single-quoted HTML attributes to keep the JSON valid. Do not place raw unescaped double quotes inside JSON strings.
- rich_html should teach step by step: explain what it is, why it matters, when to use it, what happens if it is missing, how it connects to previous learning, show an example, let the learner try, give hints, then check understanding.
- Use eduClub-safe interactive HTML blocks. Do not include <script>, onclick, external libraries, external CSS, or unsafe links inside rich_html.
- Include visuals made with lightweight HTML/CSS, simple diagrams, click-to-reveal sections, flashcards, checkboxes, mini-checks, prediction questions, debugging moments, common mistakes, celebration cards, "Did you notice?", "Think before you code", and slide-style step panels where useful.
- Make the activity project based and practical for an 8-year-old beginner.
- Include a clear activity-level objective in content.purpose.
- Include a short learner-facing overview in content.description.
- completion_rule must be one of manual, viewed, scrolled, submitted, graded, score_at_least. Use score_at_least for quizzes.
- For quiz activities, include questions with points, correct answers, hints, explanations, true/false, matching, ordering, identify-the-mistake, complete-the-code, and predict-the-output where suitable.
- For discussion activities, include a discussion_prompt.
- For coding activities, include starter_html, starter_css, starter_js, validation_checks, and clear instructions. Code execution belongs in starter fields, not in rich_html scripts.
- Include teacher_notes, friendly_hints, common mistakes, quick recap, mini challenge, checkpoints, and reflection.
- The teacher must still click Save in the editor after reviewing.

${EDUCLUB_INTERACTIVE_BLOCK_GUIDE}

${ACTIVITY_OUTPUT_SCHEMA}`,
    },
  ];
}

function assertLearnerAiActivityAllowed(activity = {}) {
  const activityType = String(activity.activity_type || "").toLowerCase();
  if (LEARNER_AI_BLOCKED_ACTIVITY_TYPES.has(activityType)) {
    throw new Error("eduClub AI help is not available for quiz activities.");
  }
}

function compactLearningContent(content = {}) {
  return JSON.stringify(
    {
      purpose: content.purpose || "",
      description: content.description || "",
      body: content.body || content.text || content.instructions || "",
      rich_html: content.rich_html || "",
      discussion_prompt: content.discussion_prompt || "",
      project_brief: content.project_brief || "",
      submission_instructions: content.submission_instructions || "",
      reflection_prompt: content.reflection_prompt || "",
      friendly_hints: content.friendly_hints || [],
      starter_html: content.starter_html || "",
      starter_css: content.starter_css || "",
      starter_js: content.starter_js || "",
      language: content.language || "",
    },
    null,
    2
  ).slice(0, 6000);
}

function buildLearnerActivityExplainMessages(options = {}) {
  const activity = options.activity || {};
  const module = options.module || {};
  const course = options.course || {};
  const learner = options.learner || {};
  const question = String(options.question || "").trim();
  return [
    {
      role: "system",
      content:
        "You are eduClub AI, a child-safe learning helper for children aged 8-14. Explain concepts warmly, step by step, and never request personal information. Do not answer quiz questions, reveal assessment answers, or complete submitted work for the learner. Return JSON only.",
    },
    {
      role: "user",
      content: `Help a learner understand the currently opened eduClub activity.

Course: ${course.name || "Current course"}
Module: ${module.title || "Current module"}
Module number: ${module.position || ""}
Module objective/description: ${module.description || ""}
Activity title: ${activity.title || "Current activity"}
Activity ${activity.position || ""} type: ${activity.activity_type || "lesson"}
Learner level: ${learner.grade || "Beginner"}, age range 8-14

Learner question:
${
  question ||
  "Explain this activity in a simpler way and tell me what to do next."
}

Activity content summary:
${compactLearningContent(activity.content || {})}

Rules:
- Call yourself eduClub AI.
- Explain only this opened activity, using the course/module/activity context.
- Be module-aware and activity-number-aware.
- Keep the answer short enough for a learner panel, but useful.
- Use simple language for a child.
- Give the learner a next step they can try now.
- Use lightweight HTML only: p, ul, ol, li, strong, em, code, pre, div, span.
- Do not include scripts, event handlers, iframes, external links, images, forms, or hidden answers.
- Do not answer quiz questions, reveal correct options, or solve assessed tasks.
- If the learner asks for a direct answer to an assessment, explain the concept and ask them to try.

Return JSON only:
{
  "answer_html": "<div><p>Short helpful explanation...</p></div>",
  "next_step": "One practical next action"
}`,
    },
  ];
}

// The activity is part of the call shape, but the prompt is chosen by action
// alone; it stays in the signature so callers keep passing it positionally.
function buildLearnerAiActionPrompt(_activity = {}, action = "") {
  const actionKey = String(action || "explain_simple").trim();
  return LEARNER_AI_ACTIONS[actionKey] || LEARNER_AI_ACTIONS.explain_simple;
}

function sanitizeLearnerAiHtml(html = "") {
  return sanitizeRichHtml(html).replace(
    /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g,
    (tag, name) => {
      const tagName = String(name || "").toLowerCase();
      if (!LEARNER_AI_ALLOWED_HTML_TAGS.has(tagName)) return "";
      return tag.startsWith("</") ? `</${tagName}>` : `<${tagName}>`;
    }
  );
}

async function checkUsageLimits(user, settings) {
  const availability = await getAiAvailability(user);
  if (!availability.enabled) {
    throw new Error(
      availability.reason || "AI is not enabled for your account."
    );
  }

  const roleLimitResult = await query(
    "SELECT * FROM ai_role_limits WHERE role = $1 AND is_enabled = true",
    [user.role]
  );
  const roleLimit = roleLimitResult.rows[0];
  if (!roleLimit) {
    throw new Error("AI is not enabled for your role.");
  }

  const usageResult = await query(
    `SELECT
       COALESCE(SUM(total_tokens) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour'), 0) AS hour_tokens,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') AS hour_requests,
       COALESCE(SUM(total_tokens) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day'), 0) AS day_tokens,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') AS day_requests
     FROM ai_usage_logs
     WHERE user_id = $1
       AND status IN ('success', 'pending')`,
    [user.userId || user.id]
  );
  const usage = usageResult.rows[0] || {};
  if (Number(usage.hour_requests) >= Number(roleLimit.requests_per_hour)) {
    throw new Error("AI hourly request limit reached.");
  }
  if (Number(usage.day_requests) >= Number(roleLimit.requests_per_day)) {
    throw new Error("AI daily request limit reached.");
  }
  if (Number(usage.hour_tokens) >= Number(roleLimit.tokens_per_hour)) {
    throw new Error("AI hourly token limit reached.");
  }
  if (Number(usage.day_tokens) >= Number(roleLimit.tokens_per_day)) {
    throw new Error("AI daily token limit reached.");
  }
  if (Number(usage.hour_requests) >= Number(settings.max_requests_per_hour)) {
    throw new Error("Global AI hourly request limit reached.");
  }
  if (Number(usage.day_requests) >= Number(settings.max_requests_per_day)) {
    throw new Error("Global AI daily request limit reached.");
  }
}

async function logUsage(user, payload) {
  const result = await query(
    `INSERT INTO ai_usage_logs (
       user_id, school_id, role, provider_key, model, feature, activity_id,
       prompt_tokens, completion_tokens, total_tokens, estimated_cost, status, error_message
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12)
     RETURNING id`,
    [
      user.userId || user.id || null,
      user.schoolId || null,
      user.role || null,
      payload.provider_key || null,
      payload.model || null,
      payload.feature || "course_builder",
      payload.activity_id || null,
      payload.prompt_tokens || 0,
      payload.completion_tokens || 0,
      payload.total_tokens || 0,
      payload.status || "pending",
      payload.error_message || null,
    ]
  );
  return result.rows[0];
}

async function callOpenAiCompatibleProvider({
  provider,
  messages,
  temperature = 0.35,
}) {
  const endpoint = `${String(provider.base_url || "").replace(
    /\/$/,
    ""
  )}/chat/completions`;
  const configuredMaxTokens = Number(provider.config?.max_tokens || 12000);
  const maxTokens =
    Number.isFinite(configuredMaxTokens) && configuredMaxTokens > 0
      ? Math.floor(configuredMaxTokens)
      : 12000;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.api_key}`,
    },
    body: JSON.stringify({
      model: provider.default_model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || "AI provider request failed.");
  }
  return {
    text: payload.choices?.[0]?.message?.content || "{}",
    usage: payload.usage || {},
  };
}

async function generateCourseBuilderDraft(payload = {}, user = {}) {
  const template = payload.template_id
    ? (await courseTemplatesService.getTemplateBuilder(payload.template_id))
        ?.template
    : payload.template || {};
  const { settings, provider } = await getActiveProvider(payload.provider_key);
  await checkUsageLimits(user, settings);
  const messages = buildCourseBuilderMessages({ ...payload, template });
  const pendingLog = await logUsage(user, {
    provider_key: provider.provider_key,
    model: provider.default_model,
    feature: "course_builder_generate",
    status: "pending",
  });

  try {
    const providerResult = await callOpenAiCompatibleProvider({
      provider,
      messages,
    });
    let repairUsage = {};
    const parsedDraft = await parseJsonDraftWithRepair(
      providerResult.text,
      async (repairMessages) => {
        const repairResult = await callOpenAiCompatibleProvider({
          provider,
          messages: repairMessages,
          temperature: 0,
        });
        repairUsage = repairResult.usage || {};
        return repairResult.text;
      }
    );
    const draft = normalizeCourseDraft(parsedDraft);
    const usage = providerResult.usage || {};
    await query(
      `UPDATE ai_usage_logs
       SET status = 'success',
           prompt_tokens = $1,
           completion_tokens = $2,
           total_tokens = $3
       WHERE id = $4`,
      [
        Number(usage.prompt_tokens || 0) +
          Number(repairUsage.prompt_tokens || 0),
        Number(usage.completion_tokens || 0) +
          Number(repairUsage.completion_tokens || 0),
        Number(usage.total_tokens || 0) + Number(repairUsage.total_tokens || 0),
        pendingLog.id,
      ]
    );
    return {
      draft,
      prompt: messages.map((message) => message.content).join("\n\n"),
      provider: provider.provider_key,
      model: provider.default_model,
      inserted: false,
    };
  } catch (error) {
    await query(
      "UPDATE ai_usage_logs SET status = 'failed', error_message = $1 WHERE id = $2",
      [error.message, pendingLog.id]
    );
    throw error;
  }
}

async function generateActivityContentDraft(payload = {}, user = {}) {
  const { settings, provider } = await getActiveProvider(payload.provider_key);
  await checkUsageLimits(user, settings);
  const messages = buildActivityBuilderMessages(payload);
  const pendingLog = await logUsage(user, {
    provider_key: provider.provider_key,
    model: provider.default_model,
    feature: "activity_content_generate",
    activity_id: payload.activity?.id || null,
    status: "pending",
  });

  try {
    const providerResult = await callOpenAiCompatibleProvider({
      provider,
      messages,
    });
    let repairUsage = {};
    const parsedActivity = await parseJsonDraftWithRepair(
      providerResult.text,
      async (repairMessages) => {
        const repairResult = await callOpenAiCompatibleProvider({
          provider,
          messages: repairMessages,
          temperature: 0,
        });
        repairUsage = repairResult.usage || {};
        return repairResult.text;
      }
    );
    const activity = normalizeActivity({
      ...(payload.activity || {}),
      ...parsedActivity,
    });
    const usage = providerResult.usage || {};
    await query(
      `UPDATE ai_usage_logs
       SET status = 'success',
           prompt_tokens = $1,
           completion_tokens = $2,
           total_tokens = $3
       WHERE id = $4`,
      [
        Number(usage.prompt_tokens || 0) +
          Number(repairUsage.prompt_tokens || 0),
        Number(usage.completion_tokens || 0) +
          Number(repairUsage.completion_tokens || 0),
        Number(usage.total_tokens || 0) + Number(repairUsage.total_tokens || 0),
        pendingLog.id,
      ]
    );
    return {
      activity,
      prompt: messages.map((message) => message.content).join("\n\n"),
      inserted: false,
      provider: provider.provider_key,
      model: provider.default_model,
    };
  } catch (error) {
    await query(
      "UPDATE ai_usage_logs SET status = 'failed', error_message = $1 WHERE id = $2",
      [error.message, pendingLog.id]
    );
    throw error;
  }
}

async function generateLearnerActivityExplanation(
  activityId,
  payload = {},
  user = {}
) {
  const activityAccess = await coursesService.assertActivityAccess(
    activityId,
    user
  );
  const activity = activityAccess.activity;
  if (!activity || !activityAccess.learner) {
    throw new Error("This activity is not available to your account.");
  }
  assertLearnerAiActivityAllowed(activity);

  const contextResult = await query(
    `SELECT c.id AS course_id, c.name AS course_name,
            cm.id AS module_id, cm.title AS module_title,
            cm.description AS module_description, cm.position AS module_position
     FROM learning_activities la
     JOIN course_modules cm ON cm.id = la.module_id
     JOIN courses c ON c.id = cm.course_id
     WHERE la.id = $1`,
    [activity.id]
  );
  const context = contextResult.rows[0] || {};
  const { settings, provider } = await getActiveProvider();
  await checkUsageLimits(user, settings);
  const messages = buildLearnerActivityExplainMessages({
    learner: activityAccess.learner,
    course: {
      id: context.course_id,
      name: context.course_name,
    },
    module: {
      id: context.module_id,
      title: context.module_title,
      description: context.module_description,
      position: context.module_position,
    },
    activity,
    question: buildLearnerAiActionPrompt(activity, payload.action),
  });
  const pendingLog = await logUsage(user, {
    provider_key: provider.provider_key,
    model: provider.default_model,
    feature: "learner_activity_explain",
    activity_id: activity.id,
    status: "pending",
  });

  try {
    const providerResult = await callOpenAiCompatibleProvider({
      provider,
      messages,
      temperature: 0.25,
    });
    let repairUsage = {};
    const parsed = await parseJsonDraftWithRepair(
      providerResult.text,
      async (repairMessages) => {
        const repairResult = await callOpenAiCompatibleProvider({
          provider,
          messages: repairMessages,
          temperature: 0,
        });
        repairUsage = repairResult.usage || {};
        return repairResult.text;
      }
    );
    const usage = providerResult.usage || {};
    await query(
      `UPDATE ai_usage_logs
       SET status = 'success',
           prompt_tokens = $1,
           completion_tokens = $2,
           total_tokens = $3
       WHERE id = $4`,
      [
        Number(usage.prompt_tokens || 0) +
          Number(repairUsage.prompt_tokens || 0),
        Number(usage.completion_tokens || 0) +
          Number(repairUsage.completion_tokens || 0),
        Number(usage.total_tokens || 0) + Number(repairUsage.total_tokens || 0),
        pendingLog.id,
      ]
    );

    const answerHtml = sanitizeLearnerAiHtml(
      parsed.answer_html || parsed.answer || parsed.explanation || ""
    );
    return {
      answer_html:
        answerHtml ||
        "<p>eduClub AI could not prepare a clear explanation this time. Try asking again in simpler words.</p>",
      next_step: String(parsed.next_step || "").trim(),
      provider: provider.provider_key,
      model: provider.default_model,
    };
  } catch (error) {
    await query(
      "UPDATE ai_usage_logs SET status = 'failed', error_message = $1 WHERE id = $2",
      [error.message, pendingLog.id]
    );
    throw error;
  }
}

async function applyCourseBuilderDraft(payload = {}) {
  const templateId = Number(payload.template_id);
  if (!templateId) throw new Error("Template is required.");
  const existingBuilder = await courseTemplatesService.getTemplateBuilder(
    templateId
  );
  const existingModuleCount = existingBuilder?.modules?.length || 0;
  const draft = prepareDraftForAppend(payload.draft || {}, existingModuleCount);
  const insertedModules = [];

  for (const moduleDraft of draft.modules) {
    const insertedModule = await courseTemplatesService.createTemplateModule(
      templateId,
      { ...moduleDraft, skip_version_bump: true }
    );
    insertedModule.activities = [];
    for (const activityDraft of moduleDraft.activities) {
      const insertedActivity =
        await courseTemplatesService.createTemplateActivity(insertedModule.id, {
          ...activityDraft,
          skip_version_bump: true,
        });
      insertedModule.activities.push(insertedActivity);
    }
    insertedModules.push(insertedModule);
  }
  if (insertedModules.length) {
    await courseTemplatesService.bumpTemplateVersion(templateId);
  }

  return {
    message: "AI draft inserted into template.",
    inserted: true,
    modules: insertedModules,
  };
}

module.exports = {
  assertLearnerAiActivityAllowed,
  buildActivityBuilderMessages,
  buildCourseBuilderMessages,
  buildJsonRepairMessages,
  buildLearnerAiActionPrompt,
  buildLearnerActivityExplainMessages,
  generateActivityContentDraft,
  generateCourseBuilderDraft,
  generateLearnerActivityExplanation,
  applyCourseBuilderDraft,
  normalizeCourseDraft,
  prepareDraftForAppend,
  parseJsonDraft,
  parseJsonDraftWithRepair,
  sanitizeLearnerAiHtml,
};
