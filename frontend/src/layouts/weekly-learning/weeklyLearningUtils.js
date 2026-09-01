// Form shapes, option labels and value formatting for the weekly typing and
// quiz screens. Pure and side-effect free, so it is testable without
// rendering the page.

export const categories = [
  ["weekly_typing", "Weekly Typing"],
  ["weekly_quiz", "Weekly Quizzes"],
];

export const defaultLessons = () => [
  { title: "Lesson 1", passage: "", instructions: "" },
  { title: "Lesson 2", passage: "", instructions: "" },
  { title: "Lesson 3", passage: "", instructions: "" },
];

export const emptyTypingForm = () => ({
  name: "Week 1 Typing Assessment",
  description: "",
  term: "",
  academic_year: "",
  week_number: 1,
  test_type: "weekly",
  competition_id: "",
  school_id: "",
  eligible_grades: [],
  pass_threshold: 25,
  allow_reattempts: true,
  max_attempts: 3,
  duration_seconds: 300,
  deadline_at: "",
  is_published: false,
  is_open: false,
  lessons: defaultLessons(),
});

export const defaultQuestions = () => [
  {
    position: 1,
    question_type: "single_choice",
    prompt: "",
    options: ["", "", "", ""],
    correct_answer: "",
    points: 5,
  },
];

export const emptyQuizForm = () => ({
  name: "Week 1 Quiz",
  description: "",
  term: "",
  academic_year: "",
  week_number: 1,
  quiz_type: "weekly",
  competition_id: "",
  quiz_category: "quiz",
  eligible_grades: [],
  pass_score: 50,
  max_attempts: 1,
  duration_seconds: 600,
  total_points: 5,
  is_published: false,
  is_open: false,
  questions: defaultQuestions(),
});

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

export function shuffled(items = []) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  const unchanged = next.length > 1 && next.every((item, index) => item === items[index]);
  return unchanged ? [...next.slice(1), next[0]] : next;
}

export function optionLabel(index) {
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index] || `${index + 1}`;
}

export function formatWeekDate(value) {
  if (!value) return "";
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatReviewAnswer(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([left, right]) => `${left}: ${right}`)
      .join(", ");
  }
  return String(value ?? "") || "-";
}

export const gradeOptions = Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`);
