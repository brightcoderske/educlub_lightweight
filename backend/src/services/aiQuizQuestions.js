/**
 * Turning AI output into questions the grader can actually mark.
 *
 * `quizAnswerPolicy.answersMatch` reads exactly one field: `correct_answer`,
 * and its expected shape differs per question type. A model given the old
 * schema hint - literally `"questions": []` - had nothing to aim at, so it put
 * the real quiz inside `rich_html` as decorative buttons and left `questions`
 * empty or in a shape the marker ignores.
 *
 * Two things fix that, and both are needed:
 *   1. Tell the model the exact shape, with a worked example per type.
 *   2. Do not trust it. Coerce what comes back into the grader's contract and
 *      discard anything that cannot be marked, rather than saving a question
 *      that silently awards nobody any marks.
 */

// Every type the learner UI can actually render. A question outside this set
// would be saved but never displayed.
const SUPPORTED_TYPES = new Set([
  "multiple_choice",
  "multi_select",
  "true_false",
  "short_answer",
  "matching",
  "ordering",
]);

/** The shape block injected into the prompt. One source of truth with the code below. */
const QUIZ_QUESTION_SCHEMA = `Every question object must be markable by the grader. The grader reads ONLY the
"correct_answer" field, and its shape depends on "question_type". Use these exactly:

- multiple_choice - one right option.
  {"question_type":"multiple_choice","prompt":"Which block starts a Scratch script?","options":["when green flag clicked","move 10 steps","say Hello"],"correct_answer":"when green flag clicked","points":1,"hint":"Look for the hat block.","explanation":"The green flag block runs the script when the project starts."}

- multi_select - two or more right options.
  {"question_type":"multi_select","prompt":"Which are loops?","options":["repeat 10","forever","say Hi","wait 1 second"],"correct_answer":["repeat 10","forever"],"points":2,"hint":"Loops repeat.","explanation":"repeat and forever both run blocks again."}

- true_false - correct_answer is a real boolean, not the string "true".
  {"question_type":"true_false","prompt":"A sprite can have more than one costume.","options":["True","False"],"correct_answer":true,"points":1,"hint":"Think about animation.","explanation":"Costumes are how a sprite animates."}

- short_answer - correct_answer is an ARRAY of every acceptable wording.
  {"question_type":"short_answer","prompt":"What block repeats forever?","options":[],"correct_answer":["forever","forever block"],"points":1,"hint":"It never stops.","explanation":"The forever block loops until the project stops."}

- matching - correct_answer is an OBJECT mapping each left item to its right item.
  {"question_type":"matching","prompt":"Match the block to what it does.","options":[{"left":"move 10 steps","right":"moves the sprite"},{"left":"say Hello","right":"shows a speech bubble"}],"correct_answer":{"move 10 steps":"moves the sprite","say Hello":"shows a speech bubble"},"points":2,"hint":"Read each block aloud.","explanation":"Each block does one job."}

- ordering - correct_answer is an ARRAY in the right order; options may be shuffled.
  {"question_type":"ordering","prompt":"Put the steps in order.","options":["click green flag","sprite moves","project stops"],"correct_answer":["click green flag","sprite moves","project stops"],"points":2,"hint":"What happens first?","explanation":"Scripts run from the top down."}

Hard rules:
- For multiple_choice and multi_select, every value in correct_answer MUST appear
  character-for-character in options. A correct answer the learner cannot select
  is an unmarkable question and will be discarded.
- Never leave correct_answer empty, null, or "TBD".
- Do not put the quiz inside rich_html. Buttons in rich_html are decoration; they
  record nothing and mark nothing. The questions array is the assessment.
- Give every question a hint and an explanation. Learners see them after marking.`;

function text(value) {
  return String(value ?? "").trim();
}

function normalizeKey(value) {
  return text(value).toLowerCase().replace(/\s+/g, " ");
}

function toBoolean(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const word = normalizeKey(value);
  if (["true", "yes", "t", "y", "1"].includes(word)) return true;
  if (["false", "no", "f", "n", "0"].includes(word)) return false;
  return null;
}

function clampPoints(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(20, Math.max(1, Math.round(parsed)));
}

/**
 * Options arrive either as plain strings or, for matching, as {left,right}
 * pairs. The previous normaliser ran String() over everything, which turned a
 * matching pair into "[object Object]" and made the question unanswerable.
 */
function normalizeOptions(raw, type) {
  if (!Array.isArray(raw)) return [];

  if (type === "matching") {
    return raw
      .map((option) => {
        if (option && typeof option === "object") {
          return { left: text(option.left ?? option.term), right: text(option.right ?? option.match) };
        }
        return null;
      })
      .filter((pair) => pair && pair.left && pair.right);
  }

  return raw.map((option) => text(option)).filter(Boolean);
}

/**
 * Coerces the model's answer into the shape `answersMatch` expects for this
 * type. Returns undefined when the question cannot be marked, which is the
 * signal to discard it.
 */
function normalizeCorrectAnswer(question, type, options) {
  // Models variously use correct_answer, answer, correct, correct_order or
  // pairs. All of them mean the same thing to the grader.
  const raw =
    question.correct_answer ??
    question.answer ??
    question.correct ??
    (type === "ordering" ? question.correct_order : undefined) ??
    (type === "matching" ? question.pairs : undefined);

  if (type === "true_false") {
    const value = toBoolean(raw);
    return value === null ? undefined : value;
  }

  if (type === "short_answer") {
    const accepted = (Array.isArray(raw) ? raw : [raw])
      .concat(Array.isArray(question.acceptable_answers) ? question.acceptable_answers : [])
      .map(text)
      .filter(Boolean);
    return accepted.length ? [...new Set(accepted)] : undefined;
  }

  if (type === "matching") {
    if (Array.isArray(raw)) {
      // pairs: [{left, right}] -> {left: right}
      const map = {};
      for (const pair of raw) {
        if (pair && typeof pair === "object" && text(pair.left) && text(pair.right)) {
          map[text(pair.left)] = text(pair.right);
        }
      }
      return Object.keys(map).length ? map : undefined;
    }
    if (raw && typeof raw === "object") {
      const map = {};
      for (const [left, right] of Object.entries(raw)) {
        if (text(left) && text(right)) map[text(left)] = text(right);
      }
      return Object.keys(map).length ? map : undefined;
    }
    // Fall back to the pairs already carried in options.
    const fromOptions = {};
    for (const pair of options) fromOptions[pair.left] = pair.right;
    return Object.keys(fromOptions).length ? fromOptions : undefined;
  }

  if (type === "ordering") {
    const order = (Array.isArray(raw) ? raw : []).map(text).filter(Boolean);
    return order.length > 1 ? order : undefined;
  }

  if (type === "multi_select") {
    const chosen = (Array.isArray(raw) ? raw : [raw]).map(text).filter(Boolean);
    return chosen.length ? [...new Set(chosen)] : undefined;
  }

  const single = text(Array.isArray(raw) ? raw[0] : raw);
  return single || undefined;
}

/**
 * A correct answer the learner has no way of selecting marks nobody. This is
 * the check that catches the most common model error: an answer that is a
 * paraphrase of an option rather than the option itself.
 */
function answerIsSelectable(type, correctAnswer, options) {
  if (type === "multiple_choice" || type === "multi_select") {
    const available = new Set(options.map(normalizeKey));
    const chosen = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
    return chosen.every((value) => available.has(normalizeKey(value)));
  }

  if (type === "ordering") {
    const available = new Set(options.map(normalizeKey));
    return (
      correctAnswer.length === options.length &&
      correctAnswer.every((value) => available.has(normalizeKey(value)))
    );
  }

  if (type === "matching") {
    return Object.keys(correctAnswer).length === options.length;
  }

  return true;
}

/**
 * @returns {{questions: Array, rejected: Array<{prompt: string, reason: string}>}}
 */
function buildMarkableQuestions(rawQuestions, { activityId = "q" } = {}) {
  const questions = [];
  const rejected = [];

  (Array.isArray(rawQuestions) ? rawQuestions : []).forEach((raw, index) => {
    const prompt = text(raw?.prompt || raw?.question);
    const requested = normalizeKey(raw?.question_type || raw?.type).replace(/[\s-]/g, "_");
    const type = SUPPORTED_TYPES.has(requested) ? requested : "multiple_choice";

    if (!prompt) {
      rejected.push({ prompt: `question ${index + 1}`, reason: "no prompt" });
      return;
    }

    let options = normalizeOptions(raw?.options, type);
    if (type === "true_false" && options.length !== 2) options = ["True", "False"];

    const needsOptions = ["multiple_choice", "multi_select", "matching", "ordering"];
    if (needsOptions.includes(type) && options.length < 2) {
      rejected.push({ prompt, reason: `${type} needs at least two options` });
      return;
    }

    const correctAnswer = normalizeCorrectAnswer(raw || {}, type, options);
    if (correctAnswer === undefined) {
      rejected.push({ prompt, reason: "no usable correct answer" });
      return;
    }

    if (!answerIsSelectable(type, correctAnswer, options)) {
      rejected.push({ prompt, reason: "correct answer is not among the options" });
      return;
    }

    questions.push({
      id: text(raw.id) || `${activityId}-q${questions.length + 1}`,
      question_type: type,
      prompt,
      options,
      correct_answer: correctAnswer,
      points: clampPoints(raw.points),
      position: questions.length + 1,
      hint: text(raw.hint),
      explanation: text(raw.explanation),
      image_url: text(raw.image_url),
    });
  });

  return { questions, rejected };
}

module.exports = {
  QUIZ_QUESTION_SCHEMA,
  SUPPORTED_TYPES,
  buildMarkableQuestions,
  normalizeCorrectAnswer,
  answerIsSelectable,
};
