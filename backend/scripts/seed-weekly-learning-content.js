require("dotenv").config({ path: ".env" });

const { pool, query } = require("../src/config/db");
const quizTests = require("../src/services/quizTests.service");
const typing = require("../src/services/typing.service");

const QUIZ_THEMES = [
  {
    category: "quiz",
    title: "Computer Basics",
    focus: "general computer knowledge",
    questions: [
      {
        question_type: "single_choice",
        prompt:
          "Which device is mainly used to type letters and numbers into a computer?",
        options: ["Monitor", "Keyboard", "Speaker", "Printer"],
        correct_answer: "Keyboard",
        points: 2,
      },
      {
        question_type: "true_false",
        prompt:
          "A strong password should be easy for everyone in class to guess.",
        options: ["True", "False"],
        correct_answer: "False",
        points: 2,
      },
      {
        question_type: "matching",
        prompt: "Match each computer part to its use.",
        options: [
          { left: "Mouse", right: "Points and clicks" },
          { left: "Monitor", right: "Shows pictures and text" },
          { left: "Printer", right: "Makes paper copies" },
        ],
        correct_answer: {
          Mouse: "Points and clicks",
          Monitor: "Shows pictures and text",
          Printer: "Makes paper copies",
        },
        points: 3,
      },
      {
        question_type: "ordering",
        prompt: "Arrange the safe login steps in order.",
        options: [
          "Open the login page",
          "Type username",
          "Type password",
          "Click login",
        ],
        correct_answer: [
          "Open the login page",
          "Type username",
          "Type password",
          "Click login",
        ],
        points: 3,
      },
    ],
  },
  {
    category: "maths",
    title: "Maths Logic",
    focus: "numbers, patterns and problem solving",
    questions: [
      {
        question_type: "single_choice",
        prompt: "What is 8 x 7?",
        options: ["54", "56", "64", "78"],
        correct_answer: "56",
        points: 2,
      },
      {
        question_type: "true_false",
        prompt: "An even number can be divided by 2 without a remainder.",
        options: ["True", "False"],
        correct_answer: "True",
        points: 2,
      },
      {
        question_type: "matching",
        prompt: "Match each shape to its number of sides.",
        options: [
          { left: "Triangle", right: "3" },
          { left: "Square", right: "4" },
          { left: "Pentagon", right: "5" },
        ],
        correct_answer: { Triangle: "3", Square: "4", Pentagon: "5" },
        points: 3,
      },
      {
        question_type: "ordering",
        prompt: "Arrange the numbers from smallest to largest.",
        options: ["12", "19", "27", "35"],
        correct_answer: ["12", "19", "27", "35"],
        points: 3,
      },
    ],
  },
  {
    category: "science",
    title: "Science Around Us",
    focus: "everyday science",
    questions: [
      {
        question_type: "single_choice",
        prompt: "Which part of a plant usually takes in water from the soil?",
        options: ["Flower", "Leaf", "Root", "Fruit"],
        correct_answer: "Root",
        points: 2,
      },
      {
        question_type: "true_false",
        prompt: "The Sun is a source of light and heat for Earth.",
        options: ["True", "False"],
        correct_answer: "True",
        points: 2,
      },
      {
        question_type: "matching",
        prompt: "Match each state of matter to an example.",
        options: [
          { left: "Solid", right: "Stone" },
          { left: "Liquid", right: "Water" },
          { left: "Gas", right: "Air" },
        ],
        correct_answer: { Solid: "Stone", Liquid: "Water", Gas: "Air" },
        points: 3,
      },
      {
        question_type: "ordering",
        prompt: "Arrange the simple investigation steps.",
        options: [
          "Ask a question",
          "Make a prediction",
          "Test",
          "Record results",
        ],
        correct_answer: [
          "Ask a question",
          "Make a prediction",
          "Test",
          "Record results",
        ],
        points: 3,
      },
    ],
  },
  {
    category: "stem",
    title: "STEM Thinking",
    focus: "building, testing and improving ideas",
    questions: [
      {
        question_type: "single_choice",
        prompt: "What should you do first when solving a STEM problem?",
        options: [
          "Guess and stop",
          "Understand the problem",
          "Hide your work",
          "Skip testing",
        ],
        correct_answer: "Understand the problem",
        points: 2,
      },
      {
        question_type: "true_false",
        prompt: "Testing helps you find ways to improve a design.",
        options: ["True", "False"],
        correct_answer: "True",
        points: 2,
      },
      {
        question_type: "matching",
        prompt: "Match each STEM word to its meaning.",
        options: [
          { left: "Prototype", right: "A first model" },
          { left: "Data", right: "Collected information" },
          { left: "Improve", right: "Make better" },
        ],
        correct_answer: {
          Prototype: "A first model",
          Data: "Collected information",
          Improve: "Make better",
        },
        points: 3,
      },
      {
        question_type: "ordering",
        prompt: "Arrange the design cycle.",
        options: ["Plan", "Build", "Test", "Improve"],
        correct_answer: ["Plan", "Build", "Test", "Improve"],
        points: 3,
      },
    ],
  },
];

const STORY_THEMES = [
  {
    title: "The Careful Coder",
    passages: [
      "A careful coder sits tall, places fingers on the home row, and types one clear line at a time.",
      "When the code has a mistake, the coder reads slowly, fixes the small bug, and tests again with a smile.",
      "Good digital citizens save their work, protect passwords, and help friends learn safely online.",
    ],
  },
  {
    title: "The Science Lab Message",
    passages: [
      "In the science lab, learners observe, measure, and type notes before they make a fair conclusion.",
      "A warm bulb, a cup of water, and a shadow can teach big ideas when the results are recorded clearly.",
      "Typing accurate science words helps the class share discoveries with confidence and kindness.",
    ],
  },
  {
    title: "The Digital Safety Quest",
    passages: [
      "Maya checks the website address, reads the message carefully, and refuses to share her password.",
      "She reports strange links to her teacher and reminds her team to think before they click.",
      "A safe learner uses technology to create, practise, and solve problems without harming others.",
    ],
  },
];

function withPositions(questions) {
  return questions.map((question, index) => ({
    id: `q${index + 1}`,
    position: index + 1,
    image_url: "",
    ...question,
  }));
}

async function getSeedUser() {
  const result = await query(
    `SELECT id FROM users
     WHERE role = 'system_admin'
     ORDER BY id
     LIMIT 1`
  );
  const userId = result.rows[0]?.id;
  if (!userId)
    throw new Error("No system admin user found for created_by_user_id.");
  return { userId, role: "system_admin" };
}

async function getActiveTerm() {
  const result = await query(
    `SELECT t.*, ay.year AS academic_year
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.term_type = 'regular'
       AND (CURRENT_DATE BETWEEN t.start_date AND t.end_date OR t.is_active = true)
     ORDER BY CASE WHEN CURRENT_DATE BETWEEN t.start_date AND t.end_date THEN 0 ELSE 1 END,
              t.start_date DESC
     LIMIT 1`
  );
  if (!result.rows[0]) throw new Error("No active regular term found.");
  return result.rows[0];
}

async function getWeeks(termId) {
  const result = await query(
    `SELECT week_number
     FROM term_weeks
     WHERE term_id = $1::integer
       AND week_number >= 3
     ORDER BY week_number`,
    [termId]
  );
  return result.rows.map((row) => Number(row.week_number));
}

async function hasWeeklyQuiz(term, weekNumber) {
  const result = await query(
    `SELECT 1
     FROM quiz_tests
     WHERE quiz_type = 'weekly'
       AND term = $1::varchar
       AND academic_year = $2::integer
       AND week_number = $3::integer
     LIMIT 1`,
    [term.name, term.academic_year, weekNumber]
  );
  return result.rowCount > 0;
}

async function hasWeeklyTyping(term, weekNumber) {
  const result = await query(
    `SELECT 1
     FROM typing_tests
     WHERE test_type = 'weekly'
       AND term = $1::varchar
       AND academic_year = $2::integer
       AND week_number = $3::integer
     LIMIT 1`,
    [term.name, term.academic_year, weekNumber]
  );
  return result.rowCount > 0;
}

async function seedQuiz(user, term, weekNumber) {
  const theme = QUIZ_THEMES[(weekNumber - 3) % QUIZ_THEMES.length];
  return quizTests.createTest(user, {
    name: `Week ${weekNumber} ${theme.title} Quiz`,
    description: `A light weekly quiz covering ${theme.focus}.`,
    term: term.name,
    academic_year: term.academic_year,
    week_number: weekNumber,
    quiz_type: "weekly",
    quiz_category: theme.category,
    eligible_grades: [],
    eligible_streams: [],
    pass_score: 50,
    max_attempts: 2,
    duration_seconds: 600,
    total_points: 10,
    is_published: true,
    is_open: true,
    questions: withPositions(theme.questions),
  });
}

async function seedTyping(user, term, weekNumber) {
  const theme = STORY_THEMES[(weekNumber - 3) % STORY_THEMES.length];
  return typing.createTest(user, {
    name: `Week ${weekNumber} Typing Story: ${theme.title}`,
    description:
      "A fun typing story that builds accuracy, science thinking, and digital literacy.",
    term: term.name,
    academic_year: term.academic_year,
    week_number: weekNumber,
    test_type: "weekly",
    eligible_grades: [],
    eligible_streams: [],
    pass_threshold: 25,
    allow_reattempts: true,
    max_attempts: 3,
    duration_seconds: 180,
    is_published: true,
    is_open: true,
    lessons: theme.passages.map((passage, index) => ({
      lesson_order: index + 1,
      title: `Story Part ${index + 1}`,
      passage,
      instructions:
        "Type the story carefully. Accuracy is more important than rushing.",
      duration_seconds: 180,
    })),
  });
}

async function main() {
  const user = await getSeedUser();
  const term = await getActiveTerm();
  const weeks = await getWeeks(term.id);
  const created = [];
  const skipped = [];

  for (const weekNumber of weeks) {
    if (await hasWeeklyQuiz(term, weekNumber)) {
      skipped.push(`week ${weekNumber} quiz`);
    } else {
      const quiz = await seedQuiz(user, term, weekNumber);
      created.push(`week ${weekNumber} quiz: ${quiz.name}`);
    }

    if (await hasWeeklyTyping(term, weekNumber)) {
      skipped.push(`week ${weekNumber} typing`);
    } else {
      const test = await seedTyping(user, term, weekNumber);
      created.push(`week ${weekNumber} typing: ${test.name}`);
    }
  }

  console.log(
    `Checked ${weeks.length} weeks for ${term.name} ${term.academic_year}.`
  );
  console.table({
    created: created.length,
    skipped_existing: skipped.length,
  });
  if (created.length) console.log(created.join("\n"));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
