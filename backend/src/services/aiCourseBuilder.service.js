const { query } = require("../config");
const courseTemplatesService = require("./courseTemplates.service");
const { getActiveProvider } = require("./aiSettings.service");
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

const ACTIVITY_OUTPUT_SCHEMA = `Return JSON only with this shape:
{
  "title": "activity title",
  "activity_type": "lesson|quiz|assignment|discussion|coding|typing|project|reflection",
  "points": 0,
  "completion_rule": "manual|score|submission",
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
  const content = sanitizeActivityContent(activity.content || {});
  const questions = Array.isArray(content.questions)
    ? content.questions.map(normalizeQuestion).filter((question) => question.prompt)
    : [];
  const normalizedContent = {
    ...content,
    body:
      typeof content.body === "string"
        ? sanitizeRichHtml(content.body)
        : sanitizeRichHtml(String(activity.description || activity.summary || "")),
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
      questions.reduce((total, question) => total + Number(question.points || 0), 0),
      0,
      100,
    ),
    position: index + 1,
    is_required: activity.availability_mode === "try_more" ? false : activity.is_required !== false,
    availability_mode: activity.availability_mode === "try_more" ? "try_more" : "required",
    completion_rule: activityType === "quiz" ? "score" : activity.completion_rule || "manual",
    pass_score:
      activityType === "quiz"
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

function buildCourseBuilderMessages(options = {}) {
  const template = options.template || {};
  const moduleCount = clampNumber(options.module_count, 4, 1, 12);
  const activitiesPerModule = clampNumber(options.activities_per_module, 6, 1, 10);
  const mode = SUPPORTED_MODES.has(options.mode) ? options.mode : "full_course";
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
Level: ${template.target_level || options.target_level || "Primary learners"}
Learner age: ${options.learner_age || "8 years old beginner"}
Objective: ${options.objective || template.description || "Build practical digital skills"}
Modules requested: ${moduleCount}
Activities per module: ${activitiesPerModule}
Interactivity level: ${interactiveOptions.interactivity_level}
Include quizzes: ${interactiveOptions.include_quizzes ? "yes" : "no"}
Include discussions: ${interactiveOptions.include_discussions ? "yes" : "no"}
Include try-more activities: ${interactiveOptions.include_try_more ? "yes" : "no"}
Include coding challenges: ${interactiveOptions.include_coding ? "yes" : "no"}
Include teacher notes: ${interactiveOptions.include_teacher_notes ? "yes" : "no"}

Quality rules:
- JSON only, no markdown fences.
- Structure must be: title, description, learning_objectives, teacher_notes, modules[].
- Each module needs title, description, learning_outcomes[], activities[].
- Activities must use activity_type from lesson, quiz, assignment, discussion, coding, typing, project, reflection.
- Include quiz banks with question points, correct answers, hints, explanations, true/false where useful, matching or ordering where useful.
- Make lesson body content interactive and clickable where useful using simple HTML buttons, hint blocks, reflection prompts, sorting/check questions, and short practice tasks.
- Include rich beginner-friendly visuals using simple image placeholders, icons, diagrams made with HTML/CSS, click-to-reveal cards, flashcards, checkboxes, mini-checks, and slide-style step panels.
- Any slide-style content must work as plain lightweight HTML sections without external libraries.
- For an 8-year-old beginner, use short sentences, concrete examples, playful challenges, and one small skill per step.
- Teach step by step: explain, show an example, let the learner try, give a hint, then check understanding.
- Prefer project-based learning: every module should build toward a small visible creation or real-world task.
- Add lightweight animations or interactive moments only with simple HTML/CSS snippets inside content.body; do not require heavy libraries.
- Include clear learner guides, teacher facilitation notes, common mistakes, and extension ideas.
- Include teacher_notes and try-more activities for fast learners when enabled.
- Make the course progressive: each module should build from the previous one.
- Make learner content interactive but lightweight for fast loading.`,
    },
  ];
}

function buildActivityBuilderMessages(options = {}) {
  const activity = options.activity || {};
  const activityType = ALLOWED_ACTIVITY_TYPES.has(activity.activity_type)
    ? activity.activity_type
    : "lesson";
  const customPrompt = String(options.prompt || "").trim();
  return [
    {
      role: "system",
      content:
        "You are eduClub's expert activity author for young learners. Produce JSON only. Keep content child-safe, age-aware, objective-aware, interactive, project-based, and lightweight. Never ask for personal information. Avoid unsafe external links and heavy libraries.",
    },
    {
      role: "user",
      content: `Create content for one existing eduClub activity only.
Course: ${options.course_name || "Current course"}
Module: ${options.module_title || "Current module"}
Activity title: ${activity.title || "Untitled activity"}
Activity type: ${activityType}
Learner age: ${options.learner_age || "8 years old beginner"}
Marks/points: ${activity.points || 0}

Teacher fine-tuning prompt:
${customPrompt || "Create rich, step-by-step, beginner-friendly activity content."}

Requirements:
- Do not create modules or other activities.
- Keep the generated content focused on this activity only.
- Use rich_html for learner-facing content.
- rich_html should teach step by step: explain, show, let the learner try, give hints, then check understanding.
- Use vanilla HTML, CSS, and tiny vanilla JavaScript only where needed.
- Include visuals, simple diagrams, click-to-reveal sections, flashcards, checkboxes, mini-checks, and slide-style step panels where useful.
- Make the activity project based and practical for an 8-year-old beginner.
- For quiz activities, include questions with points, correct answers, hints, and explanations.
- For discussion activities, include a discussion_prompt.
- For coding activities, include starter_html, starter_css, starter_js, validation_checks, and clear instructions.
- Include teacher_notes, friendly_hints, and common mistakes.
- The teacher must still click Save in the editor after reviewing.

${ACTIVITY_OUTPUT_SCHEMA}`,
    },
  ];
}

async function checkUsageLimits(user, settings) {
  const roleLimitResult = await query(
    "SELECT * FROM ai_role_limits WHERE role = $1 AND is_enabled = true",
    [user.role],
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
    [user.userId || user.id],
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
    ],
  );
  return result.rows[0];
}

async function callOpenAiCompatibleProvider({ provider, messages }) {
  const endpoint = `${String(provider.base_url || "").replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.api_key}`,
    },
    body: JSON.stringify({
      model: provider.default_model,
      messages,
      temperature: 0.35,
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
    ? (await courseTemplatesService.getTemplateBuilder(payload.template_id))?.template
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
    const draft = normalizeCourseDraft(parseJsonDraft(providerResult.text));
    const usage = providerResult.usage || {};
    await query(
      `UPDATE ai_usage_logs
       SET status = 'success',
           prompt_tokens = $1,
           completion_tokens = $2,
           total_tokens = $3
       WHERE id = $4`,
      [
        usage.prompt_tokens || 0,
        usage.completion_tokens || 0,
        usage.total_tokens || 0,
        pendingLog.id,
      ],
    );
    return {
      draft,
      provider: provider.provider_key,
      model: provider.default_model,
      inserted: false,
    };
  } catch (error) {
    await query(
      "UPDATE ai_usage_logs SET status = 'failed', error_message = $1 WHERE id = $2",
      [error.message, pendingLog.id],
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
    const activity = normalizeActivity({
      ...(payload.activity || {}),
      ...parseJsonDraft(providerResult.text),
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
        usage.prompt_tokens || 0,
        usage.completion_tokens || 0,
        usage.total_tokens || 0,
        pendingLog.id,
      ],
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
      [error.message, pendingLog.id],
    );
    throw error;
  }
}

async function applyCourseBuilderDraft(payload = {}) {
  const templateId = Number(payload.template_id);
  if (!templateId) throw new Error("Template is required.");
  const draft = normalizeCourseDraft(payload.draft || {});
  const insertedModules = [];

  for (const moduleDraft of draft.modules) {
    const insertedModule = await courseTemplatesService.createTemplateModule(
      templateId,
      moduleDraft,
    );
    insertedModule.activities = [];
    for (const activityDraft of moduleDraft.activities) {
      const insertedActivity = await courseTemplatesService.createTemplateActivity(
        insertedModule.id,
        activityDraft,
      );
      insertedModule.activities.push(insertedActivity);
    }
    insertedModules.push(insertedModule);
  }

  return {
    message: "AI draft inserted into template.",
    inserted: true,
    modules: insertedModules,
  };
}

module.exports = {
  buildActivityBuilderMessages,
  buildCourseBuilderMessages,
  generateActivityContentDraft,
  generateCourseBuilderDraft,
  applyCourseBuilderDraft,
  normalizeCourseDraft,
  parseJsonDraft,
};
