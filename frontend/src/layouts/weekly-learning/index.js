import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Radio from "@mui/material/Radio";

import DashboardIdentity from "components/DashboardIdentity";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDProgress from "components/MDProgress";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { apiClient } from "lib/api";
import { useAuth } from "context/AuthContext";
import {
  addAcceptableAnswer,
  normalizeAcceptableAnswers,
  removeAcceptableAnswer,
  updateAcceptableAnswer,
} from "./quizAnswerUtils";

const categories = [
  ["weekly_typing", "Weekly Typing"],
  ["weekly_quiz", "Weekly Quizzes"],
];

const defaultLessons = () => [
  { title: "Lesson 1", passage: "", instructions: "" },
  { title: "Lesson 2", passage: "", instructions: "" },
  { title: "Lesson 3", passage: "", instructions: "" },
];

const emptyTypingForm = () => ({
  name: "Week 1 Typing Assessment",
  description: "",
  term: "Term 1",
  academic_year: new Date().getFullYear(),
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

const defaultQuestions = () => [
  {
    position: 1,
    question_type: "single_choice",
    prompt: "",
    options: ["", "", "", ""],
    correct_answer: "",
    points: 5,
  },
];

const emptyQuizForm = () => ({
  name: "Week 1 Quiz",
  description: "",
  term: "Term 1",
  academic_year: new Date().getFullYear(),
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

function shuffled(items = []) {
  return [...items].sort(() => Math.random() - 0.5);
}

function optionLabel(index) {
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index] || `${index + 1}`;
}

function formatWeekDate(value) {
  if (!value) return "";
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatReviewAnswer(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([left, right]) => `${left}: ${right}`)
      .join(", ");
  }
  return String(value ?? "") || "-";
}

const gradeOptions = Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`);

function WeeklyLearning() {
  const { user, isSystemAdmin, isSchoolAdmin, isLearner } = useAuth();
  const [searchParams] = useSearchParams();
  const competitionQueryId = searchParams.get("competition_id") || searchParams.get("competition");
  const quizQueryId = searchParams.get("quiz");
  const [courses, setCourses] = useState([]);
  const [typingTests, setTypingTests] = useState([]);
  const [quizTests, setQuizTests] = useState([]);
  const [quizReport, setQuizReport] = useState([]);
  const [typingReport, setTypingReport] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [learners, setLearners] = useState([]);
  const [school, setSchool] = useState(null);
  const [academicTerms, setAcademicTerms] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [category, setCategory] = useState("weekly_typing");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [autoOpenedTestId, setAutoOpenedTestId] = useState("");
  const [activeTest, setActiveTest] = useState(null);
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [startedAt, setStartedAt] = useState(null);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [lessonElapsedSeconds, setLessonElapsedSeconds] = useState(0);
  const [lessonComplete, setLessonComplete] = useState(false);
  const [lessonLocked, setLessonLocked] = useState(false);
  const [advancingLesson, setAdvancingLesson] = useState(false);
  const [completionSummary, setCompletionSummary] = useState(null);
  const [editingTypingId, setEditingTypingId] = useState(null);
  const [editingQuizId, setEditingQuizId] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [previewImage, setPreviewImage] = useState("");
  const [quizRemaining, setQuizRemaining] = useState(0);
  const [quizMissing, setQuizMissing] = useState([]);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizAttemptReview, setQuizAttemptReview] = useState(null);
  const [quizAttemptReviewLoading, setQuizAttemptReviewLoading] = useState(false);
  const [quizReviewFilters, setQuizReviewFilters] = useState({
    grade: "",
    stream: "",
    learnerName: "",
  });
  const [quizMarkDrafts, setQuizMarkDrafts] = useState({});
  const [savingQuizAttemptId, setSavingQuizAttemptId] = useState(null);
  const quizStartedAtRef = useRef(null);
  const quizSubmitRef = useRef(null);
  const [bulkForm, setBulkForm] = useState({
    grade: "",
    stream: "",
    course_id: "",
    term: "Term 1",
    academic_year: new Date().getFullYear(),
  });
  const [syncForm, setSyncForm] = useState({
    term: "Term 1",
    academic_year: new Date().getFullYear(),
    week_number: 1,
  });
  const [typingReportFilters, setTypingReportFilters] = useState({
    term: "",
    academic_year: "",
    week_number: "",
    grade: "",
    stream: "",
    attempt_status: "",
  });
  const [typingForm, setTypingForm] = useState(emptyTypingForm);
  const [quizForm, setQuizForm] = useState(emptyQuizForm);
  const quizReviewOptions = useMemo(() => {
    const attempts = quizAttemptReview?.attempts || [];
    return {
      grades: [...new Set(attempts.map((attempt) => attempt.grade).filter(Boolean))].sort(),
      streams: [...new Set(attempts.map((attempt) => attempt.stream).filter(Boolean))].sort(),
    };
  }, [quizAttemptReview?.attempts]);
  const filteredQuizAttempts = useMemo(() => {
    const learnerName = quizReviewFilters.learnerName.trim().toLowerCase();
    return (quizAttemptReview?.attempts || []).filter(
      (attempt) =>
        (!quizReviewFilters.grade || attempt.grade === quizReviewFilters.grade) &&
        (!quizReviewFilters.stream || attempt.stream === quizReviewFilters.stream) &&
        (!learnerName ||
          String(attempt.full_name || "")
            .toLowerCase()
            .includes(learnerName))
    );
  }, [quizAttemptReview?.attempts, quizReviewFilters]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      if (category === "weekly_typing") {
        const params = new URLSearchParams();
        params.set("test_type", competitionQueryId ? "competition" : "weekly");
        if (searchParams.get("test")) params.set("id", searchParams.get("test"));
        const tests = await apiClient.get(`/typing/tests?${params.toString()}`);
        setTypingTests(
          searchParams.get("test")
            ? tests.filter((test) => String(test.id) === searchParams.get("test"))
            : tests
        );
        if (!isLearner()) {
          const reportParams = new URLSearchParams();
          if (typingReportFilters.term) reportParams.set("term", typingReportFilters.term);
          if (typingReportFilters.academic_year) {
            reportParams.set("academic_year", typingReportFilters.academic_year);
          }
          if (typingReportFilters.week_number) {
            reportParams.set("week_number", typingReportFilters.week_number);
          }
          if (typingReportFilters.grade) reportParams.set("grade", typingReportFilters.grade);
          if (typingReportFilters.stream) reportParams.set("stream", typingReportFilters.stream);
          const report = await apiClient
            .get(`/typing/report?${reportParams.toString()}`)
            .catch(() => []);
          setTypingReport(report);
        }
        setCourses([]);
      } else {
        const params = new URLSearchParams();
        params.set("quiz_type", competitionQueryId ? "competition" : "weekly");
        if (quizQueryId) params.set("id", quizQueryId);
        if (competitionQueryId) params.set("competition_id", competitionQueryId);
        const tests = await apiClient.get(`/quiz-tests/tests?${params.toString()}`);
        setQuizTests(
          quizQueryId ? tests.filter((test) => String(test.id) === String(quizQueryId)) : tests
        );
        if (!isLearner()) {
          const reportParams = new URLSearchParams();
          if (typingReportFilters.term) reportParams.set("term", typingReportFilters.term);
          if (typingReportFilters.academic_year) {
            reportParams.set("academic_year", typingReportFilters.academic_year);
          }
          if (typingReportFilters.week_number) {
            reportParams.set("week_number", typingReportFilters.week_number);
          }
          const report = await apiClient
            .get(`/quiz-tests/report?${reportParams.toString()}`)
            .catch(() => []);
          setQuizReport(report);
        }
        setCourses([]);
      }

      if (!isLearner()) {
        const [termRows, currentTerm, competitionRows] = await Promise.all([
          apiClient.get("/academic/terms").catch(() => []),
          apiClient.get("/academic/terms/current").catch(() => null),
          apiClient.get("/competitions").catch(() => []),
        ]);
        setAcademicTerms(Array.isArray(termRows) ? termRows : []);
        if (isSystemAdmin()) {
          setCompetitions(Array.isArray(competitionRows) ? competitionRows : []);
        }
        if (currentTerm?.name) {
          const currentAcademicYear =
            currentTerm.academic_year ||
            new Date(currentTerm.start_date || Date.now()).getFullYear();
          setTypingForm((current) =>
            current.term === "Term 1" && Number(current.academic_year) === new Date().getFullYear()
              ? {
                  ...current,
                  term: currentTerm.name,
                  academic_year: currentAcademicYear,
                  week_number: 1,
                }
              : current
          );
          setQuizForm((current) =>
            current.term === "Term 1" && Number(current.academic_year) === new Date().getFullYear()
              ? {
                  ...current,
                  term: currentTerm.name,
                  academic_year: currentAcademicYear,
                  week_number: 1,
                }
              : current
          );
          setSyncForm((current) => ({
            ...current,
            term: current.term === "Term 1" ? currentTerm.name : current.term,
            academic_year:
              current.academic_year === new Date().getFullYear()
                ? currentTerm.academic_year ||
                  new Date(currentTerm.start_date || Date.now()).getFullYear()
                : current.academic_year,
          }));
          setTypingReportFilters((current) => {
            const nextTerm = current.term || currentTerm.name;
            const nextAcademicYear =
              current.academic_year ||
              currentTerm.academic_year ||
              new Date(currentTerm.start_date || Date.now()).getFullYear();
            if (
              current.term === nextTerm &&
              String(current.academic_year || "") === String(nextAcademicYear || "")
            ) {
              return current;
            }
            return {
              ...current,
              term: nextTerm,
              academic_year: nextAcademicYear,
            };
          });
        }
      }

      if (isLearner()) {
        const learnerAllocations = await apiClient.get(`/allocations?category=${category}`);
        setAllocations(learnerAllocations);
      } else if (isSchoolAdmin()) {
        const [learnerRows, allocationRows, schoolRes] = await Promise.all([
          apiClient.get(`/learners?school_id=${user?.schoolId}`),
          apiClient.get(`/allocations?school_id=${user?.schoolId}&category=${category}`),
          apiClient.get(`/schools/${user?.schoolId}`).catch(() => null),
        ]);
        setLearners(learnerRows);
        setAllocations(allocationRows);
        setSchool(schoolRes);
      }
    } catch (err) {
      setError(err.message || "Failed to load typing/quizzes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    category,
    user?.schoolId,
    searchParams,
    typingReportFilters,
    competitionQueryId,
    quizQueryId,
  ]);

  useEffect(() => {
    if (searchParams.get("category") === "weekly_quiz") {
      setCategory("weekly_quiz");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!competitionQueryId || !isSystemAdmin()) return;
    if (searchParams.get("category") === "weekly_quiz") {
      const current = competitions.find((item) => String(item.id) === String(competitionQueryId));
      setQuizForm((form) => ({
        ...form,
        quiz_type: "competition",
        competition_id: competitionQueryId,
        quiz_category: current?.competition_type || form.quiz_category,
        name: current?.name ? `${current.name} Quiz` : form.name,
      }));
      return;
    }
    setCategory("weekly_typing");
    setTypingForm((current) => ({
      ...current,
      test_type: "competition",
      competition_id: competitionQueryId,
      name: current.name || "Typing Competition Assessment",
    }));
  }, [competitionQueryId, isSystemAdmin, searchParams, competitions]);

  useEffect(() => {
    if (!activeTest || !hasStartedTyping || !startedAt || remaining <= 0 || lessonLocked) {
      return undefined;
    }
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const duration = currentLessonDuration();
      const nextRemaining = Math.max(0, duration - elapsed);
      setRemaining(nextRemaining);
      if (nextRemaining === 0) {
        clearInterval(timer);
        setLessonElapsedSeconds(duration);
        setLessonComplete(true);
        setLessonLocked(true);
        setHasStartedTyping(false);
        setStartedAt(null);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [activeTest, hasStartedTyping, startedAt, remaining, lessonLocked]);

  const learnerStreams = Array.from(
    new Set(learners.map((learner) => learner.stream).filter(Boolean))
  );
  const grades = school?.grades_config?.length ? school.grades_config : gradeOptions;
  const streams = school?.streams_config?.length ? school.streams_config : learnerStreams;
  const termOptions = academicTerms.length ? academicTerms : [];
  const typingTerms = termOptions.filter(
    (term) => String(term.academic_year || "") === String(typingForm.academic_year || "")
  );
  const quizTerms = termOptions.filter(
    (term) => String(term.academic_year || "") === String(quizForm.academic_year || "")
  );
  const terms = [...new Set(termOptions.map((term) => term.name))];
  const academicYears = Array.from({ length: 5 }, (_, index) => new Date().getFullYear() + index);
  const selectedTerm = termOptions.find(
    (term) =>
      term.name === typingForm.term &&
      String(term.academic_year || "") === String(typingForm.academic_year || "")
  );
  const selectedReportTerm = termOptions.find(
    (term) =>
      term.name === typingReportFilters.term &&
      String(term.academic_year || "") === String(typingReportFilters.academic_year || "")
  );
  const weekOptions = Array.isArray(selectedTerm?.weeks) ? selectedTerm.weeks : [];
  const selectedQuizTerm = termOptions.find(
    (term) =>
      term.name === quizForm.term &&
      String(term.academic_year || "") === String(quizForm.academic_year || "")
  );
  const quizWeekOptions = Array.isArray(selectedQuizTerm?.weeks) ? selectedQuizTerm.weeks : [];
  useEffect(() => {
    if (!selectedTerm) return;
    const availableWeeks = Array.isArray(selectedTerm.weeks) ? selectedTerm.weeks : [];
    const currentExists = availableWeeks.some(
      (week) => Number(week.week_number) === Number(typingForm.week_number)
    );
    if (!currentExists) {
      setTypingForm((current) => ({
        ...current,
        week_number: availableWeeks[0]?.week_number || "",
      }));
    }
  }, [selectedTerm?.id, selectedTerm?.weeks, typingForm.week_number]);

  useEffect(() => {
    if (!selectedQuizTerm) return;
    const availableWeeks = Array.isArray(selectedQuizTerm.weeks) ? selectedQuizTerm.weeks : [];
    const currentExists = availableWeeks.some(
      (week) => Number(week.week_number) === Number(quizForm.week_number)
    );
    if (!currentExists) {
      setQuizForm((current) => ({
        ...current,
        week_number: availableWeeks[0]?.week_number || "",
      }));
    }
  }, [selectedQuizTerm?.id, selectedQuizTerm?.weeks, quizForm.week_number]);
  const reportWeekOptions =
    typingReportFilters.term && selectedReportTerm?.total_weeks
      ? Array.from(
          { length: Number(selectedReportTerm.total_weeks || 13) },
          (_, index) => index + 1
        )
      : weekOptions.map((week) => (typeof week === "object" ? week.week_number : week));
  const typingCompetitions = competitions.filter(
    (competition) => competition.competition_type === "typing"
  );
  const quizCompetitions = competitions.filter((competition) =>
    ["quiz", "maths", "science", "stem"].includes(competition.competition_type)
  );

  const saveTypingTest = async () => {
    setMessage("");
    setError("");
    try {
      const payload = {
        ...typingForm,
        competition_id: typingForm.test_type === "competition" ? typingForm.competition_id : "",
        eligible_grades: typingForm.eligible_grades,
        eligible_streams: [],
      };
      const response = editingTypingId
        ? await apiClient.put(`/typing/tests/${editingTypingId}`, payload)
        : await apiClient.post("/typing/tests", payload);
      setMessage(`${editingTypingId ? "Updated" : "Saved"} ${response.name}`);
      setEditingTypingId(null);
      setTypingForm(emptyTypingForm());
      await loadData();
    } catch (err) {
      setError(err.message || "Could not save typing test.");
    }
  };

  const editTypingTest = async (test) => {
    setMessage("");
    setError("");
    try {
      const response = await apiClient.get(`/typing/tests/${test.id}`);
      setEditingTypingId(response.id);
      setTypingForm({
        ...emptyTypingForm(),
        ...response,
        competition_id: response.competition_id || "",
        eligible_grades: Array.isArray(response.eligible_grades) ? response.eligible_grades : [],
        deadline_at: response.deadline_at ? String(response.deadline_at).slice(0, 16) : "",
        lessons: response.lessons?.length ? response.lessons : defaultLessons(),
      });
    } catch (err) {
      setError(err.message || "Could not load typing setup.");
    }
  };

  const duplicateTypingTest = async (test) => {
    setMessage("");
    setError("");
    try {
      const response = await apiClient.post(`/typing/tests/${test.id}/duplicate`, {});
      setMessage(`Duplicated ${response.name}. Review it before publishing.`);
      await loadData();
    } catch (err) {
      setError(err.message || "Could not duplicate typing setup.");
    }
  };

  const deleteTypingTest = async (test) => {
    if (
      !window.confirm(
        `Delete "${test.name}"? This will remove the typing setup and its linked typing data.`
      )
    ) {
      return;
    }
    setMessage("");
    setError("");
    try {
      const response = await apiClient.delete(`/typing/tests/${test.id}`);
      setMessage(response.message || "Typing setup deleted.");
      if (editingTypingId === test.id) {
        setEditingTypingId(null);
        setTypingForm(emptyTypingForm());
      }
      await loadData();
    } catch (err) {
      setError(err.message || "Could not delete typing setup.");
    }
  };

  const cancelTypingEdit = () => {
    setEditingTypingId(null);
    setTypingForm(emptyTypingForm());
  };

  const toggleTypingGrade = (grade) => {
    setTypingForm((current) => {
      const selected = current.eligible_grades || [];
      return {
        ...current,
        eligible_grades: selected.includes(grade)
          ? selected.filter((item) => item !== grade)
          : [...selected, grade],
      };
    });
  };

  const toggleQuizGrade = (grade) => {
    setQuizForm((current) => {
      const selected = current.eligible_grades || [];
      return {
        ...current,
        eligible_grades: selected.includes(grade)
          ? selected.filter((item) => item !== grade)
          : [...selected, grade],
      };
    });
  };

  const updateQuizQuestion = (index, updates) => {
    setQuizForm((current) => {
      const questions = [...current.questions];
      questions[index] = { ...questions[index], ...updates };
      return { ...current, questions };
    });
  };

  const addQuizQuestion = () => {
    setQuizForm((current) => ({
      ...current,
      questions: [
        ...current.questions,
        {
          ...defaultQuestions()[0],
          position: current.questions.length + 1,
        },
      ],
    }));
  };

  const removeQuizQuestion = (index) => {
    setQuizForm((current) => ({
      ...current,
      questions: current.questions
        .filter((_, questionIndex) => questionIndex !== index)
        .map((question, questionIndex) => ({ ...question, position: questionIndex + 1 })),
    }));
  };

  const addQuizOption = (questionIndex) => {
    setQuizForm((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              options: [
                ...(question.options || []),
                `Option ${(question.options || []).length + 1}`,
              ],
            }
          : question
      ),
    }));
  };

  const removeQuizOption = (questionIndex, optionIndex) => {
    setQuizForm((current) => ({
      ...current,
      questions: current.questions.map((question, index) => {
        if (index !== questionIndex) return question;
        const removed = question.options[optionIndex];
        const options = question.options.filter((_, currentIndex) => currentIndex !== optionIndex);
        const correctAnswer = Array.isArray(question.correct_answer)
          ? question.correct_answer.filter((answer) => answer !== removed)
          : question.correct_answer === removed
          ? ""
          : question.correct_answer;
        return {
          ...question,
          options,
          correct_answer: question.question_type === "ordering" ? options : correctAnswer,
        };
      }),
    }));
  };

  const toggleQuizCorrectOption = (questionIndex, option) => {
    const question = quizForm.questions[questionIndex];
    if (question.question_type === "multiple_choice") {
      const selected = Array.isArray(question.correct_answer) ? question.correct_answer : [];
      updateQuizQuestion(questionIndex, {
        correct_answer: selected.includes(option)
          ? selected.filter((answer) => answer !== option)
          : [...selected, option],
      });
      return;
    }
    updateQuizQuestion(questionIndex, { correct_answer: option });
  };

  const uploadQuizQuestionImage = async (index, file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Question images are capped at 2MB.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const uploaded = await apiClient.post("/courses/activity-images", {
        fileName: file.name,
        dataUrl,
      });
      updateQuizQuestion(index, { image_url: uploaded.url });
    } catch (err) {
      setError(err.message || "Could not upload question image.");
    }
  };

  const saveQuizTest = async () => {
    setMessage("");
    setError("");
    try {
      const allocated = quizForm.questions.reduce(
        (sum, question) => sum + Number(question.points ?? 0),
        0
      );
      if (allocated > Number(quizForm.total_points ?? 0)) {
        setError(
          `Question marks total ${allocated}, which exceeds the quiz total of ${quizForm.total_points}.`
        );
        return;
      }
      const payload = {
        ...quizForm,
        competition_id: quizForm.quiz_type === "competition" ? quizForm.competition_id : "",
        questions: quizForm.questions.map((question, index) => ({
          ...question,
          position: index + 1,
          options: question.options.filter((option) =>
            typeof option === "object" ? option.left || option.right : Boolean(option)
          ),
          correct_answer:
            question.question_type === "multiple_choice"
              ? String(question.correct_answer || "")
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : question.question_type === "matching"
              ? Object.fromEntries(
                  question.options
                    .filter((pair) => pair.left)
                    .map((pair) => [pair.left, pair.right])
                )
              : question.question_type === "ordering"
              ? question.options
              : question.question_type === "short_answer"
              ? normalizeAcceptableAnswers(question.correct_answer)
                  .map((answer) => answer.trim())
                  .filter(Boolean)
              : question.correct_answer,
        })),
      };
      const response = editingQuizId
        ? await apiClient.put(`/quiz-tests/tests/${editingQuizId}`, payload)
        : await apiClient.post("/quiz-tests/tests", payload);
      setMessage(`${editingQuizId ? "Updated" : "Saved"} ${response.name}`);
      setEditingQuizId(null);
      setQuizForm(emptyQuizForm());
      await loadData();
    } catch (err) {
      setError(err.message || "Could not save quiz.");
    }
  };

  const editQuizTest = async (test) => {
    setMessage("");
    setError("");
    try {
      const response = await apiClient.get(`/quiz-tests/tests/${test.id}`);
      setEditingQuizId(response.id);
      setQuizForm({
        ...emptyQuizForm(),
        ...response,
        competition_id: response.competition_id || "",
        eligible_grades: Array.isArray(response.eligible_grades) ? response.eligible_grades : [],
        questions: response.questions?.length
          ? response.questions.map((question) => ({
              ...question,
              correct_answer:
                question.question_type === "multiple_choice" ||
                question.question_type === "short_answer"
                  ? normalizeAcceptableAnswers(question.correct_answer)
                  : question.question_type !== "ordering" && Array.isArray(question.correct_answer)
                  ? question.correct_answer.join(", ")
                  : question.correct_answer || "",
              options: question.options?.length
                ? question.options
                : question.question_type === "matching"
                ? [{ left: "", right: "" }]
                : ["", "", "", ""],
            }))
          : defaultQuestions(),
      });
    } catch (err) {
      setError(err.message || "Could not load quiz setup.");
    }
  };

  const deleteQuizTest = async (test) => {
    if (!window.confirm(`Delete "${test.name}"? This will remove the quiz setup.`)) return;
    setMessage("");
    setError("");
    try {
      const response = await apiClient.delete(`/quiz-tests/tests/${test.id}`);
      setMessage(response.message || "Quiz deleted.");
      if (editingQuizId === test.id) {
        setEditingQuizId(null);
        setQuizForm(emptyQuizForm());
      }
      await loadData();
    } catch (err) {
      setError(err.message || "Could not delete quiz.");
    }
  };

  const duplicateQuizTest = async (test) => {
    setMessage("");
    setError("");
    try {
      const response = await apiClient.post(`/quiz-tests/tests/${test.id}/duplicate`, {});
      setMessage(`Duplicated ${response.name}. Review it before publishing.`);
      await loadData();
    } catch (err) {
      setError(err.message || "Could not duplicate quiz setup.");
    }
  };

  const openQuizAttemptReview = async (test) => {
    setError("");
    setQuizAttemptReviewLoading(true);
    setQuizReviewFilters({ grade: "", stream: "", learnerName: "" });
    setQuizAttemptReview({ test, attempts: [] });
    try {
      const review = await apiClient.get(`/quiz-tests/tests/${test.id}/attempts`);
      setQuizAttemptReview(review);
      setQuizMarkDrafts(
        Object.fromEntries(
          (review.attempts || []).map((attempt) => [attempt.id, attempt.earned_points])
        )
      );
    } catch (err) {
      setQuizAttemptReview(null);
      setError(err.message || "Could not load quiz attempts.");
    } finally {
      setQuizAttemptReviewLoading(false);
    }
  };

  const saveQuizAttemptMarks = async (attempt) => {
    setError("");
    setMessage("");
    setSavingQuizAttemptId(attempt.id);
    try {
      const updated = await apiClient.put(`/quiz-tests/attempts/${attempt.id}/marks`, {
        earned_points: quizMarkDrafts[attempt.id],
      });
      setQuizAttemptReview((current) => ({
        ...current,
        attempts: current.attempts.map((item) =>
          item.id === attempt.id ? { ...item, ...updated } : item
        ),
      }));
      setMessage(
        `Updated ${attempt.full_name}'s mark to ${updated.earned_points} / ${updated.total_points}.`
      );
    } catch (err) {
      setError(err.message || "Could not update quiz marks.");
    } finally {
      setSavingQuizAttemptId(null);
    }
  };

  const openQuizTest = async (test) => {
    setError("");
    setQuizResult(null);
    try {
      const quiz = await apiClient.get(`/quiz-tests/tests/${test.id}`);
      setActiveQuiz(quiz);
      setQuizMissing([]);
      setQuizRemaining(Number(quiz.duration_seconds || 600));
      quizStartedAtRef.current = Date.now();
      setQuizAnswers(
        Object.fromEntries(
          (quiz.questions || [])
            .filter((question) => question.question_type === "ordering")
            .map((question) => [question.id, shuffled(question.options)])
        )
      );
    } catch (err) {
      setError(err.message || "Could not open quiz.");
    }
  };

  const findMissingQuizQuestions = () =>
    (activeQuiz?.questions || []).filter((question) => {
      const answer = quizAnswers[question.id];
      if (question.question_type === "matching") {
        return (question.options || []).some((pair) => !answer?.[pair.left]);
      }
      if (question.question_type === "multiple_choice") {
        return !Array.isArray(answer) || answer.length === 0;
      }
      if (question.question_type === "ordering") {
        return !Array.isArray(answer) || answer.length !== (question.options || []).length;
      }
      return String(answer ?? "").trim() === "";
    });

  const submitQuizTest = async (force = false) => {
    if (!activeQuiz || quizSubmitting) return;
    const missing = findMissingQuizQuestions();
    if (!force && missing.length > 0) {
      setQuizMissing(missing);
      document.getElementById(`quiz-question-${missing[0].id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }
    setError("");
    setQuizMissing([]);
    setQuizSubmitting(true);
    try {
      const elapsed = quizStartedAtRef.current
        ? Math.max(1, Math.round((Date.now() - quizStartedAtRef.current) / 1000))
        : null;
      const response = await apiClient.post(`/quiz-tests/tests/${activeQuiz.id}/attempts`, {
        answers: quizAnswers,
        duration_seconds: elapsed,
      });
      setQuizResult(response);
      setMessage("Quiz submitted. Your score has been recorded.");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not submit quiz.");
    } finally {
      setQuizSubmitting(false);
    }
  };

  quizSubmitRef.current = submitQuizTest;

  useEffect(() => {
    if (!activeQuiz || quizResult || !quizStartedAtRef.current || quizRemaining <= 0) {
      return undefined;
    }
    const timer = setInterval(() => {
      const duration = Number(activeQuiz.duration_seconds || 600);
      const elapsed = Math.floor((Date.now() - quizStartedAtRef.current) / 1000);
      const nextRemaining = Math.max(0, duration - elapsed);
      setQuizRemaining(nextRemaining);
      if (nextRemaining === 0) {
        clearInterval(timer);
        quizSubmitRef.current?.(true);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [activeQuiz, quizResult, quizRemaining]);

  const closeQuizTest = () => {
    setActiveQuiz(null);
    setQuizMissing([]);
    setQuizRemaining(0);
    quizStartedAtRef.current = null;
  };

  const exportTypingCsv = () => {
    const headers = [
      "Learner",
      "School",
      "Grade",
      "Stream",
      "Test",
      "Week",
      "Lessons",
      "Completed",
      "Final Score",
      "Status",
    ];
    const rows = reportRows.map((row) => [
      row.full_name,
      row.school_name,
      row.grade,
      row.stream,
      row.test_name,
      row.week_number,
      row.lesson_count,
      row.completed_lessons,
      row.final_score ?? "",
      row.final_score === null ? "Not attempted" : row.passed ? "Passed" : "Below threshold",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `typing-report-${syncForm.term}-${syncForm.academic_year}-week-${syncForm.week_number}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const openTypingTest = async (test) => {
    setError("");
    try {
      const response = await apiClient.get(`/typing/tests/${test.id}`);
      setActiveTest(response);
      const nextLessonIndex = response.resume?.next_lesson_index || 0;
      setActiveLessonIndex(nextLessonIndex);
      setTypedText("");
      setStartedAt(null);
      setHasStartedTyping(false);
      setRemaining(
        response.lessons?.[nextLessonIndex]?.duration_seconds || response.duration_seconds || 300
      );
      setLessonElapsedSeconds(0);
      setLessonComplete(false);
      setLessonLocked(false);
      setAdvancingLesson(false);
      setCompletionSummary(null);
    } catch (err) {
      setError(err.message || "Could not open typing test.");
    }
  };

  useEffect(() => {
    const requestedTestId = searchParams.get("test");
    if (
      !isLearner() ||
      !competitionQueryId ||
      !requestedTestId ||
      loading ||
      activeTest ||
      autoOpenedTestId === String(requestedTestId)
    ) {
      return;
    }

    const targetTest = typingTests.find((test) => String(test.id) === String(requestedTestId));
    if (!targetTest) {
      return;
    }

    setAutoOpenedTestId(String(requestedTestId));
    openTypingTest(targetTest);
  }, [
    isLearner,
    competitionQueryId,
    searchParams,
    loading,
    activeTest,
    autoOpenedTestId,
    typingTests,
  ]);

  const currentLesson = () => activeTest?.lessons?.[activeLessonIndex] || null;
  const currentLessonDuration = () =>
    currentLesson()?.duration_seconds || activeTest?.duration_seconds || 300;

  const effectiveElapsedSeconds = () => {
    if (lessonElapsedSeconds > 0) return lessonElapsedSeconds;
    if (!hasStartedTyping || !startedAt) return 1;
    return Math.max(1, currentLessonDuration() - remaining);
  };

  const submitTypingAttempt = async () => {
    const lesson = currentLesson();
    if (!lesson) return;
    try {
      setAdvancingLesson(true);
      const elapsed = effectiveElapsedSeconds();
      await apiClient.post(`/typing/lessons/${lesson.id}/attempts`, {
        typed_text: typedText,
        duration_seconds: Math.min(elapsed, currentLessonDuration()),
      });
      const nextIndex = activeLessonIndex + 1;
      if (nextIndex < activeTest.lessons.length) {
        setActiveLessonIndex(nextIndex);
        setTypedText("");
        setStartedAt(null);
        setHasStartedTyping(false);
        setRemaining(activeTest.lessons[nextIndex].duration_seconds || activeTest.duration_seconds);
        setLessonElapsedSeconds(0);
        setLessonComplete(false);
        setLessonLocked(false);
        setAdvancingLesson(false);
      } else {
        setMessage("Typing assessment completed. Your weekly typing score has been recorded.");
        setCompletionSummary({ netWpm: typingStats().netWpm });
        setAdvancingLesson(false);
        await loadData();
        setTimeout(() => {
          setActiveTest(null);
          setHasStartedTyping(false);
          setLessonElapsedSeconds(0);
          setLessonComplete(false);
          setLessonLocked(false);
          setCompletionSummary(null);
        }, 1600);
      }
    } catch (err) {
      setAdvancingLesson(false);
      setError(err.message || "Could not submit typing attempt.");
    }
  };

  const typingStats = () => {
    const passage = currentLesson()?.passage || "";
    const effectiveTypedText = typedText.slice(0, passage.length || undefined);
    const tokenizeWords = (value) =>
      String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    const elapsed = effectiveElapsedSeconds();
    const minutes = elapsed / 60;
    const grossWpm = effectiveTypedText.length / 5 / minutes;

    const expectedWords = tokenizeWords(passage);
    const typedWords = tokenizeWords(effectiveTypedText);
    const totalWords = Math.max(typedWords.length, 1);
    let mistakes = 0;
    for (let index = 0; index < typedWords.length; index += 1) {
      if ((typedWords[index] || "") !== (expectedWords[index] || "")) {
        mistakes += 1;
      }
    }
    const accuracy = Math.max(0, ((totalWords - mistakes) / totalWords) * 100);
    const errorsPerMinute = mistakes / minutes;
    return {
      rawWpm: grossWpm.toFixed(1),
      netWpm: Math.max(0, grossWpm - errorsPerMinute).toFixed(1),
      accuracy: accuracy.toFixed(1),
      mistakes,
      progress: passage.length
        ? Math.min(100, (effectiveTypedText.length / passage.length) * 100)
        : 0,
    };
  };

  const onTypingKeyDown = (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      ["v", "x", "c", "a"].includes(event.key.toLowerCase())
    ) {
      event.preventDefault();
    }
  };

  const onTypingChange = (event) => {
    const passage = currentLesson()?.passage || "";
    const nextText = String(event.target.value || "").slice(0, passage.length || undefined);
    if (!hasStartedTyping && nextText.length > 0) {
      setStartedAt(Date.now());
      setHasStartedTyping(true);
    }
    setTypedText(nextText);

    if (passage && nextText.length >= passage.length) {
      const elapsed = Math.max(1, currentLessonDuration() - remaining);
      setLessonElapsedSeconds(Math.min(elapsed, currentLessonDuration()));
      setLessonComplete(true);
      setLessonLocked(true);
      setHasStartedTyping(false);
      setStartedAt(null);
      return;
    }

    setLessonComplete(false);
  };

  const reportRows = typingReport.filter((row) => {
    if (typingReportFilters.attempt_status === "attempted" && row.final_score === null) {
      return false;
    }
    if (typingReportFilters.attempt_status === "not_attempted" && row.final_score !== null) {
      return false;
    }
    return true;
  });
  const attemptedCount = reportRows.filter((row) => row.final_score !== null).length;
  const notAttemptedCount = reportRows.filter((row) => row.final_score === null).length;
  const totalTypingRows = reportRows.length || 1;
  const reportGrades = [...new Set(typingReport.map((row) => row.grade).filter(Boolean))].sort();
  const reportStreams = [...new Set(typingReport.map((row) => row.stream).filter(Boolean))].sort();
  const quizReportRows = quizReport.filter((row) => row.final_score !== null);

  const bulkAllocate = async () => {
    setMessage("");
    setError("");
    try {
      const response = await apiClient.post("/allocations/bulk", bulkForm);
      setMessage(response.message);
      await loadData();
    } catch (err) {
      setError(err.message || "Could not allocate typing/quizzes.");
    }
  };

  const syncResults = async () => {
    setMessage("");
    setError("");
    try {
      const response = await apiClient.post("/weekly-learning/sync-results", syncForm);
      setMessage(response.message);
    } catch (err) {
      setError(err.message || "Could not sync typing/quizzes results.");
    }
  };

  const learnerRows =
    category === "weekly_quiz"
      ? quizTests
      : allocations.map((item) => ({
          id: item.course_id,
          allocation_id: item.id,
          name: item.course_name,
          course_category: item.course_category,
          term: item.term,
          academic_year: item.academic_year,
        }));

  const rows = category === "weekly_quiz" ? quizTests : isLearner() ? learnerRows : courses;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3}>
          <DashboardIdentity
            user={user}
            title="Typing / Quizzes"
            subtitle="Native eduClub typing assessments and lightweight weekly learning records."
          />
        </MDBox>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDBox display="flex" gap={1} flexWrap="wrap" mb={2}>
                  {categories.map(([value, label]) => (
                    <MDButton
                      key={value}
                      variant={category === value ? "gradient" : "outlined"}
                      color={category === value ? "info" : "secondary"}
                      onClick={() => setCategory(value)}
                    >
                      {label}
                    </MDButton>
                  ))}
                </MDBox>

                {error && (
                  <MDTypography variant="caption" color="error" display="block" mb={1}>
                    {error}
                  </MDTypography>
                )}
                {message && (
                  <MDTypography variant="caption" color="success" display="block" mb={1}>
                    {message}
                  </MDTypography>
                )}

                {category === "weekly_typing" && isSystemAdmin() && (
                  <Grid container spacing={2} mb={3}>
                    <Grid item xs={12}>
                      <MDTypography variant="h6" fontWeight="bold">
                        {editingTypingId ? "Edit Typing Setup" : "New Typing Setup"}
                      </MDTypography>
                      <MDTypography variant="caption" color="text">
                        Weekly typing writes to report cards. Typing competitions appear in the
                        learner Competition tab after enrolment and payment.
                      </MDTypography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <MDInput
                        label="Assessment Name"
                        fullWidth
                        value={typingForm.name}
                        onChange={(event) =>
                          setTypingForm({ ...typingForm, name: event.target.value })
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <MDInput
                        select
                        label="Type"
                        fullWidth
                        value={typingForm.test_type}
                        onChange={(event) =>
                          setTypingForm({ ...typingForm, test_type: event.target.value })
                        }
                        SelectProps={{ native: true }}
                      >
                        <option value="weekly">Weekly</option>
                        <option value="competition">Competition</option>
                      </MDInput>
                    </Grid>
                    {typingForm.test_type === "competition" ? (
                      <Grid item xs={12} md={4}>
                        <MDInput
                          select
                          label="Typing Competition"
                          fullWidth
                          value={typingForm.competition_id}
                          onChange={(event) =>
                            setTypingForm({ ...typingForm, competition_id: event.target.value })
                          }
                          SelectProps={{ native: true }}
                        >
                          <option value="">Select competition</option>
                          {typingCompetitions.map((competition) => (
                            <option key={competition.id} value={competition.id}>
                              {competition.name}
                            </option>
                          ))}
                        </MDInput>
                      </Grid>
                    ) : (
                      <>
                        <Grid item xs={12} md={4}>
                          <MDInput
                            select
                            label="Academic Year"
                            fullWidth
                            value={typingForm.academic_year}
                            onChange={(event) => {
                              const nextYear = event.target.value;
                              const firstTerm = termOptions.find(
                                (term) =>
                                  String(term.academic_year || "") === String(nextYear || "")
                              );
                              setTypingForm({
                                ...typingForm,
                                academic_year: nextYear,
                                term: firstTerm?.name || "",
                                week_number: 1,
                              });
                            }}
                            SelectProps={{ native: true }}
                          >
                            {[...new Set(termOptions.map((term) => term.academic_year))]
                              .filter(Boolean)
                              .map((year) => (
                                <option key={year} value={year}>
                                  {year}
                                </option>
                              ))}
                          </MDInput>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <MDInput
                            select
                            label="Term"
                            fullWidth
                            value={typingForm.term}
                            onChange={(event) =>
                              setTypingForm({
                                ...typingForm,
                                term: event.target.value,
                                week_number: 1,
                              })
                            }
                            SelectProps={{ native: true }}
                          >
                            {typingTerms.map((term) => (
                              <option key={term.id} value={term.name}>
                                {term.name}
                              </option>
                            ))}
                          </MDInput>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <MDInput
                            select
                            label="Week"
                            fullWidth
                            value={typingForm.week_number}
                            disabled={!selectedTerm || weekOptions.length === 0}
                            onChange={(event) =>
                              setTypingForm({ ...typingForm, week_number: event.target.value })
                            }
                            SelectProps={{ native: true }}
                          >
                            {weekOptions.length === 0 && <option value="">No seeded weeks</option>}
                            {weekOptions.map((week) => {
                              const weekNumber = typeof week === "object" ? week.week_number : week;
                              return (
                                <option key={weekNumber} value={weekNumber}>
                                  Week {weekNumber}
                                  {typeof week === "object"
                                    ? ` (${formatWeekDate(week.start_date)} - ${formatWeekDate(
                                        week.end_date
                                      )})`
                                    : ""}
                                </option>
                              );
                            })}
                          </MDInput>
                        </Grid>
                      </>
                    )}
                    <Grid item xs={12}>
                      <MDTypography variant="caption" color="text" display="block" mb={0.5}>
                        Eligible grades
                      </MDTypography>
                      <MDBox display="flex" flexWrap="wrap" gap={0.5}>
                        {gradeOptions.map((grade) => (
                          <MDButton
                            key={grade}
                            variant={
                              typingForm.eligible_grades.includes(grade) ? "gradient" : "outlined"
                            }
                            color="info"
                            size="small"
                            onClick={() => toggleTypingGrade(grade)}
                          >
                            {grade.replace("Grade ", "G")}
                          </MDButton>
                        ))}
                      </MDBox>
                      <MDTypography variant="caption" color="text">
                        Leave all unselected to make the typing setup visible to every grade.
                      </MDTypography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <MDInput
                        label="Pass Threshold"
                        type="number"
                        fullWidth
                        value={typingForm.pass_threshold}
                        onChange={(event) =>
                          setTypingForm({ ...typingForm, pass_threshold: event.target.value })
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <MDInput
                        label="Max Attempts"
                        type="number"
                        fullWidth
                        value={typingForm.max_attempts}
                        onChange={(event) =>
                          setTypingForm({ ...typingForm, max_attempts: event.target.value })
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <MDInput
                        label="Duration Seconds"
                        type="number"
                        fullWidth
                        value={typingForm.duration_seconds}
                        onChange={(event) =>
                          setTypingForm({ ...typingForm, duration_seconds: event.target.value })
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <MDInput
                        select
                        label="Published"
                        fullWidth
                        value={typingForm.is_published ? "yes" : "no"}
                        onChange={(event) =>
                          setTypingForm({
                            ...typingForm,
                            is_published: event.target.value === "yes",
                          })
                        }
                        SelectProps={{ native: true }}
                      >
                        <option value="no">Draft</option>
                        <option value="yes">Published</option>
                      </MDInput>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <MDInput
                        select
                        label="Open"
                        fullWidth
                        value={typingForm.is_open ? "yes" : "no"}
                        onChange={(event) =>
                          setTypingForm({
                            ...typingForm,
                            is_open: event.target.value === "yes",
                          })
                        }
                        SelectProps={{ native: true }}
                      >
                        <option value="no">Closed</option>
                        <option value="yes">Open</option>
                      </MDInput>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <MDInput
                        select
                        label="Reattempts"
                        fullWidth
                        value={typingForm.allow_reattempts ? "yes" : "no"}
                        onChange={(event) =>
                          setTypingForm({
                            ...typingForm,
                            allow_reattempts: event.target.value === "yes",
                          })
                        }
                        SelectProps={{ native: true }}
                      >
                        <option value="yes">Allowed</option>
                        <option value="no">Disabled</option>
                      </MDInput>
                    </Grid>
                    <Grid item xs={12}>
                      <MDInput
                        label="Description"
                        fullWidth
                        multiline
                        rows={2}
                        value={typingForm.description}
                        onChange={(event) =>
                          setTypingForm({ ...typingForm, description: event.target.value })
                        }
                      />
                    </Grid>
                    {typingForm.lessons.map((lesson, index) => (
                      <Grid item xs={12} md={4} key={lesson.title}>
                        <MDInput
                          label={`${lesson.title} Passage`}
                          fullWidth
                          multiline
                          rows={5}
                          value={lesson.passage}
                          onChange={(event) => {
                            const lessons = [...typingForm.lessons];
                            lessons[index] = { ...lessons[index], passage: event.target.value };
                            setTypingForm({ ...typingForm, lessons });
                          }}
                        />
                      </Grid>
                    ))}
                    <Grid item xs={12}>
                      <MDButton
                        variant="gradient"
                        color="info"
                        onClick={saveTypingTest}
                        disabled={
                          !typingForm.name ||
                          (typingForm.test_type === "competition" && !typingForm.competition_id)
                        }
                      >
                        {editingTypingId ? "Update Typing Setup" : "Save Typing Assessment"}
                      </MDButton>
                      {editingTypingId && (
                        <MDButton variant="text" color="dark" onClick={cancelTypingEdit}>
                          Cancel Edit
                        </MDButton>
                      )}
                    </Grid>
                  </Grid>
                )}

                {category === "weekly_quiz" && isSystemAdmin() && (
                  <Grid container spacing={2} mb={3}>
                    <Grid item xs={12}>
                      <MDTypography variant="h6" fontWeight="bold">
                        {editingQuizId ? "Edit Quiz Setup" : "New Quiz Setup"}
                      </MDTypography>
                      <MDTypography variant="caption" color="text">
                        Weekly quizzes write to report cards. Competition quizzes support quiz,
                        maths, science, and STEM challenges.
                      </MDTypography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <MDInput
                        label="Quiz Name"
                        fullWidth
                        value={quizForm.name}
                        onChange={(event) => setQuizForm({ ...quizForm, name: event.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <MDInput
                        select
                        label="Type"
                        fullWidth
                        value={quizForm.quiz_type}
                        onChange={(event) =>
                          setQuizForm({ ...quizForm, quiz_type: event.target.value })
                        }
                        SelectProps={{ native: true }}
                      >
                        <option value="weekly">Weekly</option>
                        <option value="competition">Competition</option>
                      </MDInput>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <MDInput
                        select
                        label="Category"
                        fullWidth
                        value={quizForm.quiz_category}
                        onChange={(event) =>
                          setQuizForm({ ...quizForm, quiz_category: event.target.value })
                        }
                        SelectProps={{ native: true }}
                      >
                        <option value="quiz">General Quiz</option>
                        <option value="maths">Maths</option>
                        <option value="science">Science</option>
                        <option value="stem">STEM</option>
                      </MDInput>
                    </Grid>
                    {quizForm.quiz_type === "competition" ? (
                      <Grid item xs={12} md={4}>
                        <MDInput
                          select
                          label="Competition"
                          fullWidth
                          value={quizForm.competition_id}
                          onChange={(event) =>
                            setQuizForm({ ...quizForm, competition_id: event.target.value })
                          }
                          SelectProps={{ native: true }}
                        >
                          <option value="">Select competition</option>
                          {quizCompetitions.map((competition) => (
                            <option key={competition.id} value={competition.id}>
                              {competition.name}
                            </option>
                          ))}
                        </MDInput>
                      </Grid>
                    ) : (
                      <>
                        <Grid item xs={12} md={4}>
                          <MDInput
                            select
                            label="Academic Year"
                            fullWidth
                            value={quizForm.academic_year}
                            onChange={(event) => {
                              const nextYear = event.target.value;
                              const firstTerm = termOptions.find(
                                (term) =>
                                  String(term.academic_year || "") === String(nextYear || "")
                              );
                              setQuizForm({
                                ...quizForm,
                                academic_year: nextYear,
                                term: firstTerm?.name || "",
                                week_number: 1,
                              });
                            }}
                            SelectProps={{ native: true }}
                          >
                            {[...new Set(termOptions.map((term) => term.academic_year))]
                              .filter(Boolean)
                              .map((year) => (
                                <option key={year} value={year}>
                                  {year}
                                </option>
                              ))}
                          </MDInput>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <MDInput
                            select
                            label="Term"
                            fullWidth
                            value={quizForm.term}
                            onChange={(event) =>
                              setQuizForm({ ...quizForm, term: event.target.value, week_number: 1 })
                            }
                            SelectProps={{ native: true }}
                          >
                            {quizTerms.map((term) => (
                              <option key={term.id} value={term.name}>
                                {term.name}
                              </option>
                            ))}
                          </MDInput>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <MDInput
                            select
                            label="Week"
                            fullWidth
                            value={quizForm.week_number}
                            disabled={!selectedQuizTerm || quizWeekOptions.length === 0}
                            onChange={(event) =>
                              setQuizForm({ ...quizForm, week_number: event.target.value })
                            }
                            SelectProps={{ native: true }}
                          >
                            {quizWeekOptions.length === 0 && (
                              <option value="">No seeded weeks</option>
                            )}
                            {quizWeekOptions.map((week) => {
                              const weekNumber = typeof week === "object" ? week.week_number : week;
                              return (
                                <option key={weekNumber} value={weekNumber}>
                                  Week {weekNumber}
                                  {typeof week === "object"
                                    ? ` (${formatWeekDate(week.start_date)} - ${formatWeekDate(
                                        week.end_date
                                      )})`
                                    : ""}
                                </option>
                              );
                            })}
                          </MDInput>
                        </Grid>
                      </>
                    )}
                    <Grid item xs={12}>
                      <MDTypography variant="caption" color="text" display="block" mb={0.5}>
                        Eligible grades
                      </MDTypography>
                      <MDBox display="flex" flexWrap="wrap" gap={0.5}>
                        {gradeOptions.map((grade) => (
                          <MDButton
                            key={grade}
                            variant={
                              quizForm.eligible_grades.includes(grade) ? "gradient" : "outlined"
                            }
                            color="info"
                            size="small"
                            onClick={() => toggleQuizGrade(grade)}
                          >
                            {grade.replace("Grade ", "G")}
                          </MDButton>
                        ))}
                      </MDBox>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <MDInput
                        label="Pass Score"
                        type="number"
                        fullWidth
                        value={quizForm.pass_score}
                        onChange={(event) =>
                          setQuizForm({ ...quizForm, pass_score: event.target.value })
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <MDInput
                        label="Max Attempts"
                        type="number"
                        fullWidth
                        value={quizForm.max_attempts}
                        onChange={(event) =>
                          setQuizForm({ ...quizForm, max_attempts: event.target.value })
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <MDInput
                        label="Duration Seconds"
                        type="number"
                        fullWidth
                        value={quizForm.duration_seconds}
                        onChange={(event) =>
                          setQuizForm({ ...quizForm, duration_seconds: event.target.value })
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <MDInput
                        label="Total Marks"
                        type="number"
                        fullWidth
                        value={quizForm.total_points}
                        onChange={(event) =>
                          setQuizForm({ ...quizForm, total_points: event.target.value })
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <MDInput
                        select
                        label="Status"
                        fullWidth
                        value={`${quizForm.is_published ? "published" : "draft"}-${
                          quizForm.is_open ? "open" : "closed"
                        }`}
                        onChange={(event) => {
                          const [published, open] = event.target.value.split("-");
                          setQuizForm({
                            ...quizForm,
                            is_published: published === "published",
                            is_open: open === "open",
                          });
                        }}
                        SelectProps={{ native: true }}
                      >
                        <option value="draft-closed">Draft</option>
                        <option value="published-closed">Published, closed</option>
                        <option value="published-open">Published, open</option>
                      </MDInput>
                    </Grid>
                    <Grid item xs={12}>
                      <MDInput
                        label="Description"
                        fullWidth
                        multiline
                        rows={2}
                        value={quizForm.description}
                        onChange={(event) =>
                          setQuizForm({ ...quizForm, description: event.target.value })
                        }
                      />
                    </Grid>
                    {quizForm.questions.map((question, index) => (
                      <Grid item xs={12} key={`question-${index + 1}`}>
                        <Card variant="outlined">
                          <MDBox p={2}>
                            <Grid container spacing={1.5}>
                              <Grid item xs={12} md={6}>
                                <MDInput
                                  label={`Question ${index + 1}`}
                                  fullWidth
                                  value={question.prompt}
                                  onChange={(event) =>
                                    updateQuizQuestion(index, { prompt: event.target.value })
                                  }
                                />
                              </Grid>
                              <Grid item xs={12} md={3}>
                                <MDInput
                                  select
                                  label="Answer type"
                                  fullWidth
                                  value={question.question_type}
                                  onChange={(event) => {
                                    const questionType = event.target.value;
                                    updateQuizQuestion(index, {
                                      question_type: questionType,
                                      options:
                                        questionType === "true_false"
                                          ? ["True", "False"]
                                          : questionType === "matching"
                                          ? [{ left: "", right: "" }]
                                          : question.options?.some(
                                              (option) => typeof option === "object"
                                            )
                                          ? ["", "", "", ""]
                                          : question.options,
                                      correct_answer:
                                        questionType === "true_false"
                                          ? "True"
                                          : questionType === "multiple_choice"
                                          ? []
                                          : questionType === "short_answer"
                                          ? [""]
                                          : "",
                                    });
                                  }}
                                  SelectProps={{ native: true }}
                                >
                                  <option value="single_choice">Single choice</option>
                                  <option value="multiple_choice">Multiple choice</option>
                                  <option value="true_false">True or false</option>
                                  <option value="short_answer">Short answer</option>
                                  <option value="matching">Matching pairs</option>
                                  <option value="ordering">Arrange in order</option>
                                </MDInput>
                              </Grid>
                              <Grid item xs={12} md={3}>
                                <MDInput
                                  label="Marks"
                                  type="number"
                                  fullWidth
                                  value={question.points}
                                  onChange={(event) =>
                                    updateQuizQuestion(index, { points: event.target.value })
                                  }
                                />
                              </Grid>
                              <Grid item xs={12} display="flex" justifyContent="flex-end">
                                <MDButton
                                  variant="text"
                                  color="error"
                                  size="small"
                                  onClick={() => removeQuizQuestion(index)}
                                >
                                  <Icon>delete</Icon>&nbsp; Remove Question
                                </MDButton>
                              </Grid>
                              <Grid item xs={12}>
                                <MDBox display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                  <MDButton
                                    component="label"
                                    variant="outlined"
                                    color="info"
                                    size="small"
                                  >
                                    {question.image_url ? "Replace Image" : "Add Image"}
                                    <input
                                      hidden
                                      type="file"
                                      accept="image/png,image/jpeg,image/gif,image/webp"
                                      onChange={(event) =>
                                        uploadQuizQuestionImage(index, event.target.files?.[0])
                                      }
                                    />
                                  </MDButton>
                                  {question.image_url && (
                                    <>
                                      <MDBox
                                        component="img"
                                        src={question.image_url}
                                        alt=""
                                        sx={{
                                          width: 120,
                                          maxHeight: 90,
                                          objectFit: "contain",
                                          borderRadius: "6px",
                                        }}
                                      />
                                      <MDButton
                                        variant="text"
                                        color="error"
                                        size="small"
                                        onClick={() => updateQuizQuestion(index, { image_url: "" })}
                                      >
                                        Remove
                                      </MDButton>
                                    </>
                                  )}
                                </MDBox>
                              </Grid>
                              {question.question_type === "matching" ? (
                                <Grid item xs={12}>
                                  <MDBox display="flex" flexDirection="column" gap={1}>
                                    {(question.options || []).map((pair, pairIndex) => (
                                      <Grid container spacing={1} key={`pair-${pairIndex + 1}`}>
                                        <Grid item xs={5}>
                                          <MDInput
                                            label="Item"
                                            fullWidth
                                            value={pair.left || ""}
                                            onChange={(event) => {
                                              const options = [...question.options];
                                              options[pairIndex] = {
                                                ...pair,
                                                left: event.target.value,
                                              };
                                              updateQuizQuestion(index, { options });
                                            }}
                                          />
                                        </Grid>
                                        <Grid item xs={2}>
                                          <MDTypography textAlign="center">matches</MDTypography>
                                        </Grid>
                                        <Grid item xs={5}>
                                          <MDInput
                                            label="Match"
                                            fullWidth
                                            value={pair.right || ""}
                                            onChange={(event) => {
                                              const options = [...question.options];
                                              options[pairIndex] = {
                                                ...pair,
                                                right: event.target.value,
                                              };
                                              updateQuizQuestion(index, { options });
                                            }}
                                          />
                                        </Grid>
                                        <Grid item xs={12} display="flex" justifyContent="flex-end">
                                          <MDButton
                                            variant="text"
                                            color="error"
                                            size="small"
                                            onClick={() => removeQuizOption(index, pairIndex)}
                                          >
                                            Remove Pair
                                          </MDButton>
                                        </Grid>
                                      </Grid>
                                    ))}
                                    <MDButton
                                      variant="outlined"
                                      color="info"
                                      size="small"
                                      onClick={() =>
                                        updateQuizQuestion(index, {
                                          options: [
                                            ...(question.options || []),
                                            { left: "", right: "" },
                                          ],
                                        })
                                      }
                                    >
                                      Add Pair
                                    </MDButton>
                                  </MDBox>
                                </Grid>
                              ) : (
                                <Grid item xs={12}>
                                  {question.question_type === "short_answer" ? (
                                    <MDBox display="flex" flexDirection="column" gap={1}>
                                      {normalizeAcceptableAnswers(question.correct_answer).map(
                                        (answer, answerIndex) => (
                                          <MDBox
                                            key={`answer-${index}-${answerIndex}`}
                                            display="flex"
                                            gap={1}
                                            alignItems="center"
                                          >
                                            <MDInput
                                              label={
                                                answerIndex === 0
                                                  ? "Correct answer"
                                                  : `Also accept ${answerIndex + 1}`
                                              }
                                              fullWidth
                                              value={answer}
                                              onChange={(event) =>
                                                updateQuizQuestion(index, {
                                                  correct_answer: updateAcceptableAnswer(
                                                    question.correct_answer,
                                                    answerIndex,
                                                    event.target.value
                                                  ),
                                                })
                                              }
                                            />
                                            <IconButton
                                              color="error"
                                              title="Remove accepted answer"
                                              onClick={() =>
                                                updateQuizQuestion(index, {
                                                  correct_answer: removeAcceptableAnswer(
                                                    question.correct_answer,
                                                    answerIndex
                                                  ),
                                                })
                                              }
                                            >
                                              <Icon>close</Icon>
                                            </IconButton>
                                          </MDBox>
                                        )
                                      )}
                                      <MDButton
                                        variant="outlined"
                                        color="info"
                                        size="small"
                                        onClick={() =>
                                          updateQuizQuestion(index, {
                                            correct_answer: addAcceptableAnswer(
                                              question.correct_answer
                                            ),
                                          })
                                        }
                                      >
                                        Add Accepted Answer
                                      </MDButton>
                                    </MDBox>
                                  ) : (
                                    <MDBox display="flex" flexDirection="column" gap={1}>
                                      {(question.options || []).map((option, optionIndex) => {
                                        const checked =
                                          question.question_type === "multiple_choice"
                                            ? (question.correct_answer || []).includes(option)
                                            : question.question_type === "ordering"
                                            ? true
                                            : Boolean(option) && question.correct_answer === option;
                                        return (
                                          <MDBox
                                            key={`quiz-${index}-option-${optionIndex}`}
                                            display="flex"
                                            alignItems="center"
                                            gap={1}
                                            p={1}
                                            border="1px solid #e5e7eb"
                                            borderRadius="md"
                                            sx={{ bgcolor: "#ffffff" }}
                                          >
                                            <MDTypography variant="button" fontWeight="bold">
                                              {question.question_type === "ordering"
                                                ? optionIndex + 1
                                                : optionLabel(optionIndex)}
                                            </MDTypography>
                                            {question.question_type === "multiple_choice" && (
                                              <Checkbox
                                                checked={checked}
                                                onChange={() =>
                                                  toggleQuizCorrectOption(index, option)
                                                }
                                              />
                                            )}
                                            {question.question_type === "single_choice" && (
                                              <Radio
                                                checked={checked}
                                                onChange={() =>
                                                  toggleQuizCorrectOption(index, option)
                                                }
                                              />
                                            )}
                                            <MDInput
                                              label={
                                                question.question_type === "ordering"
                                                  ? `Item ${optionIndex + 1}`
                                                  : `Option ${optionLabel(optionIndex)}`
                                              }
                                              fullWidth
                                              value={option}
                                              onChange={(event) => {
                                                const options = [...question.options];
                                                const oldOption = options[optionIndex];
                                                options[optionIndex] = event.target.value;
                                                let correctAnswer = question.correct_answer;
                                                if (question.question_type === "ordering") {
                                                  correctAnswer = options;
                                                } else if (Array.isArray(correctAnswer)) {
                                                  correctAnswer = correctAnswer.map((answer) =>
                                                    answer === oldOption
                                                      ? event.target.value
                                                      : answer
                                                  );
                                                } else if (correctAnswer === oldOption) {
                                                  correctAnswer = event.target.value;
                                                }
                                                updateQuizQuestion(index, {
                                                  options,
                                                  correct_answer: correctAnswer,
                                                });
                                              }}
                                            />
                                            <IconButton
                                              color="error"
                                              title="Remove option"
                                              onClick={() => removeQuizOption(index, optionIndex)}
                                            >
                                              <Icon>close</Icon>
                                            </IconButton>
                                          </MDBox>
                                        );
                                      })}
                                      <MDButton
                                        variant="outlined"
                                        color="info"
                                        size="small"
                                        onClick={() => addQuizOption(index)}
                                      >
                                        Add{" "}
                                        {question.question_type === "ordering"
                                          ? "Ordered Item"
                                          : "Option"}
                                      </MDButton>
                                      {question.question_type === "ordering" && (
                                        <MDTypography variant="caption" color="text">
                                          Arrange the items above in the correct answer order.
                                        </MDTypography>
                                      )}
                                    </MDBox>
                                  )}
                                </Grid>
                              )}
                            </Grid>
                          </MDBox>
                        </Card>
                      </Grid>
                    ))}
                    <Grid item xs={12}>
                      <MDTypography variant="caption" color="text">
                        Allocated marks:{" "}
                        {quizForm.questions.reduce(
                          (sum, question) => sum + Number(question.points ?? 0),
                          0
                        )}{" "}
                        / {Number(quizForm.total_points || 0)}
                      </MDTypography>
                    </Grid>
                    <Grid item xs={12}>
                      <MDButton variant="outlined" color="dark" onClick={addQuizQuestion}>
                        Add Question
                      </MDButton>
                      <MDButton
                        variant="gradient"
                        color="info"
                        onClick={saveQuizTest}
                        disabled={
                          !quizForm.name ||
                          quizForm.questions.some((question) => !question.prompt) ||
                          (quizForm.quiz_type === "competition" && !quizForm.competition_id)
                        }
                      >
                        {editingQuizId ? "Update Quiz" : "Save Quiz"}
                      </MDButton>
                    </Grid>
                  </Grid>
                )}

                {category === "weekly_quiz" && isSchoolAdmin() && (
                  <Grid container spacing={2} mb={3}>
                    <Grid item xs={12} md={3}>
                      <MDInput
                        select
                        label="Grade"
                        fullWidth
                        value={bulkForm.grade}
                        onChange={(event) =>
                          setBulkForm({ ...bulkForm, grade: event.target.value })
                        }
                        SelectProps={{ native: true }}
                      >
                        <option value="" />
                        {grades.map((grade) => (
                          <option key={grade} value={grade}>
                            {grade}
                          </option>
                        ))}
                      </MDInput>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <MDInput
                        select
                        label="Stream"
                        fullWidth
                        value={bulkForm.stream}
                        onChange={(event) =>
                          setBulkForm({ ...bulkForm, stream: event.target.value })
                        }
                        SelectProps={{ native: true }}
                      >
                        <option value="">All streams</option>
                        {streams.map((stream) => (
                          <option key={stream} value={stream}>
                            {stream}
                          </option>
                        ))}
                      </MDInput>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <MDInput
                        select
                        label="Activity"
                        fullWidth
                        value={bulkForm.course_id}
                        onChange={(event) =>
                          setBulkForm({ ...bulkForm, course_id: event.target.value })
                        }
                        SelectProps={{ native: true }}
                      >
                        <option value="" />
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.name}
                          </option>
                        ))}
                      </MDInput>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <MDInput
                        select
                        label="Term"
                        fullWidth
                        value={bulkForm.term}
                        onChange={(event) => setBulkForm({ ...bulkForm, term: event.target.value })}
                        SelectProps={{ native: true }}
                      >
                        {terms.map((term) => (
                          <option key={term} value={term}>
                            {term}
                          </option>
                        ))}
                      </MDInput>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <MDInput
                        select
                        label="Academic Year"
                        fullWidth
                        value={bulkForm.academic_year}
                        onChange={(event) =>
                          setBulkForm({ ...bulkForm, academic_year: event.target.value })
                        }
                        SelectProps={{ native: true }}
                      >
                        {academicYears.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </MDInput>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <MDButton
                        variant="gradient"
                        color="info"
                        fullWidth
                        onClick={bulkAllocate}
                        disabled={!bulkForm.grade || !bulkForm.course_id}
                      >
                        Allocate
                      </MDButton>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <MDInput
                        select
                        label="Sync Term"
                        fullWidth
                        value={syncForm.term}
                        onChange={(event) => setSyncForm({ ...syncForm, term: event.target.value })}
                        SelectProps={{ native: true }}
                      >
                        {terms.map((term) => (
                          <option key={term} value={term}>
                            {term}
                          </option>
                        ))}
                      </MDInput>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <MDInput
                        select
                        label="Sync Year"
                        fullWidth
                        value={syncForm.academic_year}
                        onChange={(event) =>
                          setSyncForm({ ...syncForm, academic_year: event.target.value })
                        }
                        SelectProps={{ native: true }}
                      >
                        {academicYears.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </MDInput>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <MDInput
                        label="Week"
                        type="number"
                        fullWidth
                        value={syncForm.week_number}
                        onChange={(event) =>
                          setSyncForm({ ...syncForm, week_number: event.target.value })
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <MDButton variant="outlined" color="success" fullWidth onClick={syncResults}>
                        Sync Results
                      </MDButton>
                    </Grid>
                  </Grid>
                )}

                {category === "weekly_typing" ? (
                  loading ? (
                    <MDTypography variant="body2" color="text">
                      Loading typing assessments...
                    </MDTypography>
                  ) : typingTests.length === 0 ? (
                    <MDTypography variant="body2" color="text">
                      No native typing assessments available.
                    </MDTypography>
                  ) : (
                    <TableContainer>
                      <Table>
                        <TableHead sx={{ display: "table-header-group" }}>
                          <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Week</TableCell>
                            <TableCell>Lessons</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="center">Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {typingTests.map((test) => (
                            <TableRow key={test.id}>
                              <TableCell>{test.name}</TableCell>
                              <TableCell>
                                <Chip
                                  label={
                                    test.test_type === "competition" ? "Competition" : "Weekly"
                                  }
                                  color={test.test_type === "competition" ? "warning" : "info"}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>Week {test.week_number || "-"}</TableCell>
                              <TableCell>{test.lesson_count || 0}</TableCell>
                              <TableCell>
                                <Chip
                                  label={test.effective_is_open ? "Open" : "Closed"}
                                  color={test.effective_is_open ? "success" : "default"}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="center">
                                {isLearner() ? (
                                  <MDButton
                                    variant="gradient"
                                    color="info"
                                    size="small"
                                    onClick={() => openTypingTest(test)}
                                  >
                                    Start
                                  </MDButton>
                                ) : isSystemAdmin() ? (
                                  <MDBox display="flex" gap={0.5} justifyContent="center">
                                    <MDButton
                                      variant="text"
                                      color="info"
                                      size="small"
                                      onClick={() => editTypingTest(test)}
                                    >
                                      Edit
                                    </MDButton>
                                    <MDButton
                                      variant="text"
                                      color="success"
                                      size="small"
                                      onClick={() => duplicateTypingTest(test)}
                                    >
                                      Duplicate
                                    </MDButton>
                                    <MDButton
                                      variant="text"
                                      color="error"
                                      size="small"
                                      onClick={() => deleteTypingTest(test)}
                                    >
                                      Delete
                                    </MDButton>
                                  </MDBox>
                                ) : (
                                  <MDTypography variant="caption" color="text">
                                    Native
                                  </MDTypography>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )
                ) : loading ? (
                  <MDTypography variant="body2" color="text">
                    Loading typing/quizzes...
                  </MDTypography>
                ) : rows.length === 0 ? (
                  <MDTypography variant="body2" color="text">
                    No typing/quizzes available yet.
                  </MDTypography>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead sx={{ display: "table-header-group" }}>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Week</TableCell>
                          <TableCell>Status</TableCell>
                          {isLearner() && <TableCell>Term</TableCell>}
                          <TableCell align="center">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={`${row.id}-${row.allocation_id || "course"}`}>
                            <TableCell>{row.name}</TableCell>
                            <TableCell>
                              <Chip
                                label={row.quiz_category || "quiz"}
                                color={row.quiz_type === "competition" ? "warning" : "info"}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {row.quiz_type === "competition" ? "Competition" : "Weekly"}
                            </TableCell>
                            <TableCell>Week {row.week_number || "-"}</TableCell>
                            <TableCell>
                              <Chip
                                label={row.effective_is_open ? "Open" : "Closed"}
                                color={row.effective_is_open ? "success" : "default"}
                                size="small"
                              />
                            </TableCell>
                            {isLearner() && (
                              <TableCell>
                                {row.term} | {row.academic_year}
                              </TableCell>
                            )}
                            <TableCell align="center">
                              {isLearner() ? (
                                <MDButton
                                  variant="gradient"
                                  color="info"
                                  size="small"
                                  onClick={() => openQuizTest(row)}
                                >
                                  Start
                                </MDButton>
                              ) : isSystemAdmin() ? (
                                <MDBox display="flex" gap={0.5} justifyContent="center">
                                  <MDButton
                                    variant="text"
                                    color="dark"
                                    size="small"
                                    onClick={() => openQuizAttemptReview(row)}
                                  >
                                    Review
                                  </MDButton>
                                  <MDButton
                                    variant="text"
                                    color="info"
                                    size="small"
                                    onClick={() => editQuizTest(row)}
                                  >
                                    Edit
                                  </MDButton>
                                  <MDButton
                                    variant="text"
                                    color="success"
                                    size="small"
                                    onClick={() => duplicateQuizTest(row)}
                                  >
                                    Duplicate
                                  </MDButton>
                                  <MDButton
                                    variant="text"
                                    color="error"
                                    size="small"
                                    onClick={() => deleteQuizTest(row)}
                                  >
                                    Delete
                                  </MDButton>
                                </MDBox>
                              ) : (
                                <MDButton
                                  variant="text"
                                  color="info"
                                  size="small"
                                  onClick={() => openQuizAttemptReview(row)}
                                >
                                  Review
                                </MDButton>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                {category === "weekly_typing" && !isLearner() && (
                  <MDBox mt={3}>
                    <Grid container spacing={2} mb={2}>
                      <Grid item xs={12} md={2}>
                        <MDInput
                          select
                          label="Term"
                          fullWidth
                          value={typingReportFilters.term}
                          onChange={(event) =>
                            setTypingReportFilters({
                              ...typingReportFilters,
                              term: event.target.value,
                            })
                          }
                          SelectProps={{ native: true }}
                        >
                          <option value="">All terms</option>
                          {terms.map((term) => (
                            <option key={term} value={term}>
                              {term}
                            </option>
                          ))}
                        </MDInput>
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <MDInput
                          select
                          label="Year"
                          fullWidth
                          value={typingReportFilters.academic_year}
                          onChange={(event) =>
                            setTypingReportFilters({
                              ...typingReportFilters,
                              academic_year: event.target.value,
                            })
                          }
                          SelectProps={{ native: true }}
                        >
                          <option value="">All years</option>
                          {[...new Set(termOptions.map((term) => term.academic_year))]
                            .filter(Boolean)
                            .map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                        </MDInput>
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <MDInput
                          select
                          label="Week"
                          fullWidth
                          value={typingReportFilters.week_number}
                          onChange={(event) =>
                            setTypingReportFilters({
                              ...typingReportFilters,
                              week_number: event.target.value,
                            })
                          }
                          SelectProps={{ native: true }}
                        >
                          <option value="">All weeks</option>
                          {reportWeekOptions.map((weekNumber) => (
                            <option key={weekNumber} value={weekNumber}>
                              Week {weekNumber}
                            </option>
                          ))}
                        </MDInput>
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <MDInput
                          select
                          label="Grade"
                          fullWidth
                          value={typingReportFilters.grade}
                          onChange={(event) =>
                            setTypingReportFilters({
                              ...typingReportFilters,
                              grade: event.target.value,
                            })
                          }
                          SelectProps={{ native: true }}
                        >
                          <option value="">All grades</option>
                          {reportGrades.map((grade) => (
                            <option key={grade} value={grade}>
                              {grade}
                            </option>
                          ))}
                        </MDInput>
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <MDInput
                          select
                          label="Stream"
                          fullWidth
                          value={typingReportFilters.stream}
                          onChange={(event) =>
                            setTypingReportFilters({
                              ...typingReportFilters,
                              stream: event.target.value,
                            })
                          }
                          SelectProps={{ native: true }}
                        >
                          <option value="">All streams</option>
                          {reportStreams.map((streamOption) => (
                            <option key={streamOption} value={streamOption}>
                              {streamOption}
                            </option>
                          ))}
                        </MDInput>
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <MDInput
                          select
                          label="Attempt"
                          fullWidth
                          value={typingReportFilters.attempt_status}
                          onChange={(event) =>
                            setTypingReportFilters({
                              ...typingReportFilters,
                              attempt_status: event.target.value,
                            })
                          }
                          SelectProps={{ native: true }}
                        >
                          <option value="">All learners</option>
                          <option value="attempted">Attempted</option>
                          <option value="not_attempted">Not attempted</option>
                        </MDInput>
                      </Grid>
                    </Grid>
                    <Grid container spacing={2} mb={2}>
                      <Grid item xs={12} md={6}>
                        <Card variant="outlined">
                          <MDBox p={2}>
                            <MDTypography variant="button" fontWeight="bold">
                              Attempted
                            </MDTypography>
                            <MDTypography variant="h4">{attemptedCount}</MDTypography>
                            <MDProgress
                              variant="gradient"
                              color="success"
                              value={(attemptedCount / totalTypingRows) * 100}
                            />
                          </MDBox>
                        </Card>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Card variant="outlined">
                          <MDBox p={2}>
                            <MDTypography variant="button" fontWeight="bold">
                              Not Attempted
                            </MDTypography>
                            <MDTypography variant="h4">{notAttemptedCount}</MDTypography>
                            <MDProgress
                              variant="gradient"
                              color="warning"
                              value={(notAttemptedCount / totalTypingRows) * 100}
                            />
                          </MDBox>
                        </Card>
                      </Grid>
                    </Grid>
                    <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <MDTypography variant="h6" fontWeight="bold">
                        Typing Performance
                      </MDTypography>
                      <MDButton
                        variant="outlined"
                        color="info"
                        size="small"
                        onClick={exportTypingCsv}
                        disabled={typingReport.length === 0}
                      >
                        Export CSV
                      </MDButton>
                    </MDBox>
                    <TableContainer>
                      <Table>
                        <TableHead sx={{ display: "table-header-group" }}>
                          <TableRow>
                            <TableCell>Learner</TableCell>
                            <TableCell>Week</TableCell>
                            <TableCell>Grade</TableCell>
                            <TableCell>Class</TableCell>
                            <TableCell>Test</TableCell>
                            <TableCell>Progress</TableCell>
                            <TableCell>Adjusted WPM</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {reportRows.map((row) => (
                            <TableRow key={`${row.learner_id}-${row.test_id}`}>
                              <TableCell>{row.full_name}</TableCell>
                              <TableCell>{row.week_number || "-"}</TableCell>
                              <TableCell>{row.grade || "-"}</TableCell>
                              <TableCell>{row.stream || "-"}</TableCell>
                              <TableCell>{row.test_name}</TableCell>
                              <TableCell>
                                {row.completed_lessons}/{row.lesson_count}
                              </TableCell>
                              <TableCell>{row.final_score ?? "-"}</TableCell>
                              <TableCell>
                                <Chip
                                  label={
                                    row.final_score === null
                                      ? "Not attempted"
                                      : row.passed
                                      ? "Passed"
                                      : "Below threshold"
                                  }
                                  color={
                                    row.final_score === null
                                      ? "default"
                                      : row.passed
                                      ? "success"
                                      : "warning"
                                  }
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </MDBox>
                )}
                {category === "weekly_quiz" && !isLearner() && (
                  <MDBox mt={3}>
                    <MDTypography variant="h6" fontWeight="bold" mb={1}>
                      Quiz Performance
                    </MDTypography>
                    {quizReportRows.length === 0 ? (
                      <MDTypography variant="body2" color="text">
                        No quiz attempts recorded for the selected period yet.
                      </MDTypography>
                    ) : (
                      <TableContainer>
                        <Table>
                          <TableHead sx={{ display: "table-header-group" }}>
                            <TableRow>
                              <TableCell>Learner</TableCell>
                              <TableCell>Week</TableCell>
                              <TableCell>Grade</TableCell>
                              <TableCell>Quiz</TableCell>
                              <TableCell>Score</TableCell>
                              <TableCell>Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {quizReportRows.map((row) => (
                              <TableRow key={`${row.learner_id}-${row.test_id}`}>
                                <TableCell>{row.full_name}</TableCell>
                                <TableCell>{row.week_number || "-"}</TableCell>
                                <TableCell>{row.grade || "-"}</TableCell>
                                <TableCell>{row.test_name}</TableCell>
                                <TableCell>{row.final_score}%</TableCell>
                                <TableCell>
                                  <Chip
                                    label={
                                      Number(row.final_score) >= Number(row.pass_score || 0)
                                        ? "Passed"
                                        : "Below pass score"
                                    }
                                    color={
                                      Number(row.final_score) >= Number(row.pass_score || 0)
                                        ? "success"
                                        : "warning"
                                    }
                                    size="small"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </MDBox>
                )}
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
      <Dialog
        open={Boolean(quizAttemptReview)}
        onClose={() => setQuizAttemptReview(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent sx={{ bgcolor: "#f8fafc" }}>
          <MDBox display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <MDBox>
              <MDTypography variant="h5" fontWeight="bold">
                Quiz Submissions
              </MDTypography>
              <MDTypography variant="body2" color="text">
                {quizAttemptReview?.test?.name || "Weekly quiz"}
              </MDTypography>
            </MDBox>
            <IconButton title="Close" onClick={() => setQuizAttemptReview(null)}>
              <Icon>close</Icon>
            </IconButton>
          </MDBox>
          {quizAttemptReviewLoading ? (
            <MDTypography variant="body2" color="text">
              Loading learner answers...
            </MDTypography>
          ) : !quizAttemptReview?.attempts?.length ? (
            <MDTypography variant="body2" color="text">
              No learner attempts have been submitted yet.
            </MDTypography>
          ) : (
            <MDBox display="flex" flexDirection="column" gap={1.5}>
              <Grid container spacing={1.5}>
                <Grid item xs={12} md={4}>
                  <MDInput
                    label="Learner name"
                    fullWidth
                    value={quizReviewFilters.learnerName}
                    onChange={(event) =>
                      setQuizReviewFilters((current) => ({
                        ...current,
                        learnerName: event.target.value,
                      }))
                    }
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <MDInput
                    select
                    label="Grade"
                    fullWidth
                    SelectProps={{ native: true }}
                    value={quizReviewFilters.grade}
                    onChange={(event) =>
                      setQuizReviewFilters((current) => ({
                        ...current,
                        grade: event.target.value,
                      }))
                    }
                  >
                    <option value="">All grades</option>
                    {quizReviewOptions.grades.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </MDInput>
                </Grid>
                <Grid item xs={12} md={4}>
                  <MDInput
                    select
                    label="Stream"
                    fullWidth
                    SelectProps={{ native: true }}
                    value={quizReviewFilters.stream}
                    onChange={(event) =>
                      setQuizReviewFilters((current) => ({
                        ...current,
                        stream: event.target.value,
                      }))
                    }
                  >
                    <option value="">All streams</option>
                    {quizReviewOptions.streams.map((stream) => (
                      <option key={stream} value={stream}>
                        {stream}
                      </option>
                    ))}
                  </MDInput>
                </Grid>
              </Grid>
              {!filteredQuizAttempts.length && (
                <MDTypography variant="body2" color="text">
                  No learner attempts match these filters.
                </MDTypography>
              )}
              {filteredQuizAttempts.map((attempt) => (
                <Card key={attempt.id} variant="outlined">
                  <MDBox p={2}>
                    <MDBox
                      display="flex"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      gap={2}
                      flexWrap="wrap"
                      mb={1.5}
                    >
                      <MDBox>
                        <MDTypography variant="button" fontWeight="bold">
                          {attempt.full_name}
                        </MDTypography>
                        <MDTypography variant="caption" color="text" display="block">
                          {attempt.grade || "Grade not set"}
                          {attempt.stream ? ` | ${attempt.stream}` : ""} | Attempt{" "}
                          {attempt.attempt_number}
                        </MDTypography>
                      </MDBox>
                      <MDBox display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <MDInput
                          type="number"
                          label={`Mark / ${attempt.total_points}`}
                          value={quizMarkDrafts[attempt.id] ?? attempt.earned_points}
                          inputProps={{
                            min: 0,
                            max: attempt.total_points,
                            step: "any",
                          }}
                          onChange={(event) =>
                            setQuizMarkDrafts((current) => ({
                              ...current,
                              [attempt.id]: event.target.value,
                            }))
                          }
                          sx={{ width: 120 }}
                        />
                        <MDButton
                          variant="gradient"
                          color="info"
                          size="small"
                          disabled={savingQuizAttemptId === attempt.id}
                          onClick={() => saveQuizAttemptMarks(attempt)}
                        >
                          {savingQuizAttemptId === attempt.id ? "Saving..." : "Save Mark"}
                        </MDButton>
                        <Chip
                          label={`${attempt.earned_points} / ${attempt.total_points} (${attempt.score}%)`}
                          color={
                            Number(attempt.score) >= Number(quizAttemptReview.test?.pass_score || 0)
                              ? "success"
                              : "warning"
                          }
                          size="small"
                        />
                      </MDBox>
                    </MDBox>
                    <MDBox display="flex" flexDirection="column" gap={1}>
                      {(quizAttemptReview.test?.questions || []).map((question, questionIndex) => {
                        const answer =
                          attempt.answers?.[question.id] ??
                          attempt.answers?.[question.position] ??
                          attempt.answers?.[String(question.position)];
                        const result =
                          attempt.feedback?.[question.id] ??
                          attempt.feedback?.[String(question.id)] ??
                          {};
                        return (
                          <MDBox
                            key={question.id}
                            p={1.25}
                            borderRadius="md"
                            sx={{
                              bgcolor: result.correct ? "#ecfdf5" : "#fff7ed",
                              border: `1px solid ${result.correct ? "#a7f3d0" : "#fed7aa"}`,
                            }}
                          >
                            <MDTypography variant="caption" fontWeight="bold">
                              {questionIndex + 1}. {question.prompt}
                            </MDTypography>
                            <MDTypography variant="caption" display="block" color="text">
                              Learner answer: {formatReviewAnswer(answer)}
                            </MDTypography>
                            <MDTypography variant="caption" display="block" color="text">
                              Accepted answer: {formatReviewAnswer(question.correct_answer)}
                            </MDTypography>
                            <MDTypography
                              variant="caption"
                              display="block"
                              color={result.correct ? "success" : "warning"}
                            >
                              Awarded: {Number(result.points || 0)} / {Number(question.points || 0)}
                            </MDTypography>
                          </MDBox>
                        );
                      })}
                    </MDBox>
                  </MDBox>
                </Card>
              ))}
            </MDBox>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(activeTest)} onClose={() => null} maxWidth="lg" fullWidth>
        <DialogContent>
          {activeTest && currentLesson() && (
            <MDBox>
              {completionSummary ? (
                <MDBox py={6} textAlign="center">
                  <MDTypography variant="h4" fontWeight="bold" mb={1}>
                    Congratulations
                  </MDTypography>
                  <MDTypography variant="h6" color="text">
                    You achieved {completionSummary.netWpm} speed.
                  </MDTypography>
                </MDBox>
              ) : (
                <>
                  <MDTypography variant="h4" fontWeight="bold">
                    {activeTest.name} - {currentLesson().title}
                  </MDTypography>
                  <MDBox display="flex" gap={2} flexWrap="wrap" my={2}>
                    <Chip label={`${remaining}s`} color="warning" />
                    <Chip label={`${typingStats().netWpm} Net WPM`} color="info" />
                    <Chip label={`${typingStats().rawWpm} Gross WPM`} color="default" />
                    <Chip label={`${typingStats().accuracy}% Accuracy`} color="success" />
                    <Chip label={`${typingStats().mistakes} Errors`} color="error" />
                  </MDBox>
                  <MDBox
                    p={2}
                    borderRadius="md"
                    sx={{ backgroundColor: "#f8fafc", lineHeight: 1.9, fontSize: 18 }}
                  >
                    {(currentLesson().passage || "").split("").map((char, index) => {
                      const typed = typedText[index];
                      const color =
                        typed === undefined ? "#344767" : typed === char ? "#16a34a" : "#dc2626";
                      return (
                        <span key={`${char}-${index}`} style={{ color }}>
                          {char}
                        </span>
                      );
                    })}
                  </MDBox>
                  <MDInput
                    fullWidth
                    multiline
                    rows={8}
                    value={typedText}
                    onChange={onTypingChange}
                    onKeyDown={onTypingKeyDown}
                    onPaste={(event) => event.preventDefault()}
                    onDrop={(event) => event.preventDefault()}
                    onContextMenu={(event) => event.preventDefault()}
                    disabled={lessonLocked || advancingLesson}
                    sx={{ mt: 2 }}
                  />
                  <MDBox display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                    <MDBox>
                      <MDTypography variant="caption" color="text">
                        Lesson {activeLessonIndex + 1} of {activeTest.lessons.length}
                      </MDTypography>
                      <MDTypography variant="caption" color="text" display="block">
                        {lessonComplete
                          ? "Lesson complete. Continue when you are ready."
                          : "Finish the passage to unlock the next lesson."}
                      </MDTypography>
                    </MDBox>
                    <MDButton
                      variant="gradient"
                      color="info"
                      onClick={submitTypingAttempt}
                      disabled={!lessonComplete || advancingLesson}
                    >
                      {advancingLesson
                        ? "Opening..."
                        : activeLessonIndex + 1 < activeTest.lessons.length
                        ? "Next Lesson"
                        : "Finish Test"}
                    </MDButton>
                  </MDBox>
                </>
              )}
            </MDBox>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(activeQuiz)}
        onClose={quizSubmitting ? undefined : closeQuizTest}
        maxWidth="md"
        fullWidth
      >
        <DialogContent>
          {activeQuiz && (
            <MDBox>
              <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <MDBox>
                  <MDTypography variant="h4" fontWeight="bold">
                    {activeQuiz.name}
                  </MDTypography>
                  <MDTypography variant="body2" color="text">
                    {activeQuiz.description || "Answer all questions before submitting."}
                  </MDTypography>
                </MDBox>
                <MDBox display="flex" alignItems="center" gap={1}>
                  {!quizResult && (
                    <Chip
                      label={`${Math.floor(quizRemaining / 60)}:${String(
                        quizRemaining % 60
                      ).padStart(2, "0")}`}
                      color={quizRemaining <= 60 ? "error" : "warning"}
                    />
                  )}
                  <MDButton variant="outlined" color="dark" onClick={closeQuizTest}>
                    Close
                  </MDButton>
                </MDBox>
              </MDBox>
              {quizResult ? (
                <MDBox py={4} textAlign="center">
                  <MDTypography variant="h4" fontWeight="bold">
                    Score: {quizResult.score}%
                  </MDTypography>
                  <MDTypography variant="body2" color="text">
                    {quizResult.earned_points}/{quizResult.total_points} marks recorded.
                  </MDTypography>
                </MDBox>
              ) : (
                <>
                  {quizMissing.length > 0 && (
                    <MDBox mb={2} p={1.5} borderRadius="md" sx={{ bgcolor: "#fff7ed" }}>
                      <MDTypography variant="body2" color="warning" fontWeight="bold">
                        Please answer {quizMissing.length} missing question
                        {quizMissing.length === 1 ? "" : "s"} before submitting.
                      </MDTypography>
                      <MDBox display="flex" gap={0.5} flexWrap="wrap" mt={1}>
                        {quizMissing.map((question) => {
                          const questionIndex = activeQuiz.questions.findIndex(
                            (item) => item.id === question.id
                          );
                          return (
                            <Chip
                              key={question.id}
                              label={`Go to Question ${questionIndex + 1}`}
                              color="warning"
                              onClick={() =>
                                document
                                  .getElementById(`quiz-question-${question.id}`)
                                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
                              }
                            />
                          );
                        })}
                      </MDBox>
                    </MDBox>
                  )}
                  <MDBox display="flex" flexDirection="column" gap={1.5}>
                    {(activeQuiz.questions || []).map((question, index) => (
                      <Card
                        id={`quiz-question-${question.id}`}
                        key={question.id || index}
                        variant="outlined"
                        sx={{
                          bgcolor: ["#eff6ff", "#f0fdf4", "#fff7ed", "#faf5ff", "#fef2f2"][
                            index % 5
                          ],
                          borderColor: ["#bfdbfe", "#bbf7d0", "#fed7aa", "#e9d5ff", "#fecaca"][
                            index % 5
                          ],
                        }}
                      >
                        <MDBox p={2}>
                          <MDTypography variant="button" fontWeight="bold">
                            {index + 1}. {question.prompt}
                          </MDTypography>
                          {question.image_url && (
                            <MDBox
                              component="img"
                              src={question.image_url}
                              alt=""
                              onClick={() => setPreviewImage(question.image_url)}
                              sx={{
                                display: "block",
                                width: "min(100%, 360px)",
                                maxHeight: 240,
                                objectFit: "contain",
                                mt: 1,
                                borderRadius: "6px",
                                cursor: "zoom-in",
                              }}
                            />
                          )}
                          {question.question_type === "short_answer" ? (
                            <MDInput
                              fullWidth
                              label="Answer"
                              value={quizAnswers[question.id] || ""}
                              onChange={(event) =>
                                setQuizAnswers({
                                  ...quizAnswers,
                                  [question.id]: event.target.value,
                                })
                              }
                              sx={{ mt: 1 }}
                            />
                          ) : question.question_type === "matching" ? (
                            <MDBox display="flex" flexDirection="column" gap={1} mt={1}>
                              {(question.options || []).map((pair) => (
                                <Grid container spacing={1} key={pair.left}>
                                  <Grid item xs={12} sm={5}>
                                    <MDTypography variant="body2" fontWeight="bold">
                                      {pair.left}
                                    </MDTypography>
                                  </Grid>
                                  <Grid item xs={12} sm={7}>
                                    <MDInput
                                      select
                                      fullWidth
                                      value={quizAnswers[question.id]?.[pair.left] || ""}
                                      onChange={(event) =>
                                        setQuizAnswers({
                                          ...quizAnswers,
                                          [question.id]: {
                                            ...(quizAnswers[question.id] || {}),
                                            [pair.left]: event.target.value,
                                          },
                                        })
                                      }
                                      SelectProps={{ native: true }}
                                    >
                                      <option value="">Choose match</option>
                                      {(question.options || []).map((choice) => (
                                        <option key={choice.right} value={choice.right}>
                                          {choice.right}
                                        </option>
                                      ))}
                                    </MDInput>
                                  </Grid>
                                </Grid>
                              ))}
                            </MDBox>
                          ) : question.question_type === "ordering" ? (
                            <MDBox display="flex" flexDirection="column" gap={1} mt={1}>
                              {(quizAnswers[question.id] || question.options || []).map(
                                (option, optionIndex) => (
                                  <MDBox
                                    key={`${option}-${optionIndex}`}
                                    display="flex"
                                    alignItems="center"
                                    gap={1}
                                  >
                                    <MDTypography variant="button">{optionIndex + 1}.</MDTypography>
                                    <MDInput
                                      select
                                      fullWidth
                                      value={option}
                                      onChange={(event) => {
                                        const ordered = [
                                          ...(quizAnswers[question.id] || question.options || []),
                                        ];
                                        const swapIndex = ordered.indexOf(event.target.value);
                                        [ordered[optionIndex], ordered[swapIndex]] = [
                                          ordered[swapIndex],
                                          ordered[optionIndex],
                                        ];
                                        setQuizAnswers({
                                          ...quizAnswers,
                                          [question.id]: ordered,
                                        });
                                      }}
                                      SelectProps={{ native: true }}
                                    >
                                      {(question.options || []).map((choice) => (
                                        <option key={choice} value={choice}>
                                          {choice}
                                        </option>
                                      ))}
                                    </MDInput>
                                  </MDBox>
                                )
                              )}
                            </MDBox>
                          ) : (
                            <MDBox display="flex" flexDirection="column" gap={1} mt={1}>
                              {(question.options || []).map((option) => {
                                const selected = quizAnswers[question.id];
                                const isMulti = question.question_type === "multiple_choice";
                                const selectedList = Array.isArray(selected) ? selected : [];
                                const active = isMulti
                                  ? selectedList.includes(option)
                                  : selected === option;
                                return (
                                  <MDButton
                                    key={option}
                                    variant={active ? "gradient" : "outlined"}
                                    color={active ? "info" : "dark"}
                                    onClick={() => {
                                      if (isMulti) {
                                        setQuizAnswers({
                                          ...quizAnswers,
                                          [question.id]: active
                                            ? selectedList.filter((item) => item !== option)
                                            : [...selectedList, option],
                                        });
                                      } else {
                                        setQuizAnswers({ ...quizAnswers, [question.id]: option });
                                      }
                                    }}
                                  >
                                    {option}
                                  </MDButton>
                                );
                              })}
                            </MDBox>
                          )}
                        </MDBox>
                      </Card>
                    ))}
                  </MDBox>
                  <MDBox mt={2} display="flex" justifyContent="flex-end">
                    <MDButton
                      variant="gradient"
                      color="success"
                      disabled={quizSubmitting}
                      onClick={() => submitQuizTest(false)}
                    >
                      {quizSubmitting ? "Submitting..." : "Submit Quiz"}
                    </MDButton>
                  </MDBox>
                </>
              )}
            </MDBox>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(previewImage)} onClose={() => setPreviewImage("")} maxWidth="md">
        <DialogContent>
          <MDBox
            component="img"
            src={previewImage}
            alt=""
            sx={{ display: "block", maxWidth: "100%", maxHeight: "75vh", objectFit: "contain" }}
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

export default WeeklyLearning;
