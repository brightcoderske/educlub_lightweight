import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Chip from "@mui/material/Chip";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { apiClient } from "lib/api";
import { useAuth } from "context/AuthContext";
import { normalizeAcceptableAnswers } from "./quizAnswerUtils";
import {
  canAuthorAssessments as viewerCanAuthor,
  canManageAssessment as viewerCanManage,
} from "./assessmentAccess";
import AssessmentLibrary from "./AssessmentLibrary";
import AssessmentTermTools from "./AssessmentTermTools";

import {
  defaultLessons,
  emptyTypingForm,
  defaultQuestions,
  emptyQuizForm,
  readFileAsDataUrl,
  shuffled,
  formatReviewAnswer,
  gradeOptions,
} from "./weeklyLearningUtils";

const TypingStudioForm = lazy(() => import("./TypingStudioForm"));
const QuizStudioForm = lazy(() => import("./QuizStudioForm"));
const WeeklyMatrix = lazy(() => import("components/WeeklyMatrix"));
const MyWeeklyProgress = lazy(() => import("components/MyWeeklyProgress"));

function WeeklyLearning() {
  const { user, isSystemAdmin, isSchoolAdmin, isLearner } = useAuth();
  // Weekly typing and quizzes belong to the school that runs them: its own
  // staff author, publish, review and delete them for their own learners. The
  // system console keeps the two genuinely cross-school things - competitions
  // and the global library published to every school - and is read-only over
  // anything a school wrote for itself.
  const viewer = {
    isSystemAdmin: isSystemAdmin(),
    isSchoolStaff: isSchoolAdmin(),
    schoolId: user?.schoolId,
  };
  const canAuthorAssessments = viewerCanAuthor(viewer);
  const canManageAssessment = (assessment) => viewerCanManage(assessment, viewer);
  // The assessment list is a working tool, not a report: learners start tests
  // from it and staff edit/review/duplicate/delete there.
  const showAssessmentList = isLearner() || canAuthorAssessments;
  const [searchParams, setSearchParams] = useSearchParams();
  const competitionQueryId = searchParams.get("competition_id") || searchParams.get("competition");
  const quizQueryId = searchParams.get("quiz");
  const [courses, setCourses] = useState([]);
  const [typingTests, setTypingTests] = useState([]);
  const [quizTests, setQuizTests] = useState([]);
  const [learners, setLearners] = useState([]);
  const [school, setSchool] = useState(null);
  const [academicTerms, setAcademicTerms] = useState([]);
  const [activeAcademicTerm, setActiveAcademicTerm] = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [authoringPanel, setAuthoringPanel] = useState(canAuthorAssessments ? "weekly_quiz" : null);
  const [performancePanel, setPerformancePanel] = useState(null);
  const [authoringScrollRequest, setAuthoringScrollRequest] = useState(0);
  const authoringRef = useRef(null);

  useEffect(() => {
    if (!authoringScrollRequest || !authoringPanel) return;
    const frame = requestAnimationFrame(() => {
      authoringRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [authoringScrollRequest, authoringPanel]);
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
  const [quizMatchingChoices, setQuizMatchingChoices] = useState({});
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
  const typingSubmitRef = useRef(null);
  const typingAttemptSubmittingRef = useRef(false);
  const [bulkForm, setBulkForm] = useState({
    grade: "",
    stream: "",
    course_id: "",
    term: "",
    academic_year: "",
  });
  const [syncForm, setSyncForm] = useState({
    term: "",
    academic_year: "",
    week_number: 1,
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

  const loadData = async (background = false) => {
    const hasVisibleData = typingTests.length > 0 || quizTests.length > 0;
    setLoading(!background && !hasVisibleData);
    setError("");
    try {
      const requestedCategory =
        searchParams.get("category") === "weekly_quiz" ? "weekly_quiz" : "weekly_typing";
      const typingParams = new URLSearchParams();
      typingParams.set(
        "test_type",
        competitionQueryId && requestedCategory === "weekly_typing" ? "competition" : "weekly"
      );
      if (searchParams.get("test")) typingParams.set("id", searchParams.get("test"));

      const quizParams = new URLSearchParams();
      quizParams.set(
        "quiz_type",
        competitionQueryId && requestedCategory === "weekly_quiz" ? "competition" : "weekly"
      );
      if (quizQueryId) quizParams.set("id", quizQueryId);
      if (competitionQueryId && requestedCategory === "weekly_quiz") {
        quizParams.set("competition_id", competitionQueryId);
      }
      const requestedTerm = !isLearner() && searchParams.get("term");
      const requestedYear = !isLearner() && searchParams.get("academic_year");
      if (requestedTerm && requestedYear) {
        for (const params of [typingParams, quizParams]) {
          params.set("term", requestedTerm);
          params.set("academic_year", requestedYear);
        }
      }

      const assessmentRequest = Promise.all([
        apiClient.get(`/typing/tests?${typingParams.toString()}`),
        apiClient.get(`/quiz-tests/tests?${quizParams.toString()}`),
      ]);
      const staffMetadataRequest = isLearner()
        ? Promise.resolve([[], []])
        : Promise.all([
            apiClient.get("/academic/terms").catch(() => []),
            apiClient.get("/competitions").catch(() => []),
          ]);
      const schoolContextRequest =
        !isLearner() && isSchoolAdmin()
          ? Promise.all([
              apiClient.get(`/learners?school_id=${user?.schoolId}`),
              apiClient.get(`/schools/${user?.schoolId}`).catch(() => null),
            ])
          : Promise.resolve([[], null]);

      const [
        currentTerm,
        [typingRows, quizRows],
        [termRows, competitionRows],
        [learnerRows, schoolRes],
      ] = await Promise.all([
        apiClient.get("/academic/terms/current").catch(() => null),
        assessmentRequest,
        staffMetadataRequest,
        schoolContextRequest,
      ]);
      const currentAcademicYear = currentTerm?.name
        ? currentTerm.academic_year || new Date(currentTerm.start_date).getFullYear()
        : null;
      const currentPeriod =
        currentTerm?.name && currentAcademicYear
          ? { ...currentTerm, academic_year: currentAcademicYear }
          : null;
      setActiveAcademicTerm(currentPeriod);

      if (!currentPeriod && isLearner()) {
        setTypingTests([]);
        setQuizTests([]);
      } else {
        const currentTypingRows = Array.isArray(typingRows) ? typingRows : [];
        const currentQuizRows = Array.isArray(quizRows) ? quizRows : [];
        setTypingTests(
          searchParams.get("test")
            ? currentTypingRows.filter((test) => String(test.id) === searchParams.get("test"))
            : currentTypingRows
        );
        setQuizTests(
          quizQueryId
            ? currentQuizRows.filter((test) => String(test.id) === String(quizQueryId))
            : currentQuizRows
        );
      }
      setCourses([]);

      if (!isLearner()) {
        setAcademicTerms(Array.isArray(termRows) ? termRows : []);
        if (isSystemAdmin()) {
          setCompetitions(Array.isArray(competitionRows) ? competitionRows : []);
        }
        const authoringPeriod =
          requestedTerm && requestedYear
            ? termRows.find(
                (item) =>
                  item.name === requestedTerm && String(item.academic_year) === requestedYear
              )
            : currentPeriod;
        if (authoringPeriod) {
          setTypingForm((current) =>
            !current.term || !current.academic_year
              ? {
                  ...current,
                  term: authoringPeriod.name,
                  academic_year: authoringPeriod.academic_year,
                  week_number: 1,
                }
              : current
          );
          setQuizForm((current) =>
            !current.term || !current.academic_year
              ? {
                  ...current,
                  term: authoringPeriod.name,
                  academic_year: authoringPeriod.academic_year,
                  week_number: 1,
                }
              : current
          );
        }
        if (currentPeriod) {
          setBulkForm((current) => ({
            ...current,
            term: currentPeriod.name,
            academic_year: currentPeriod.academic_year,
          }));
          setSyncForm((current) => ({
            ...current,
            term: currentPeriod.name,
            academic_year: currentPeriod.academic_year,
          }));
        }
      }

      if (isSchoolAdmin()) {
        setLearners(learnerRows);
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
  }, [user?.schoolId, searchParams, competitionQueryId, quizQueryId]);

  useEffect(() => {
    if (searchParams.get("category") === "weekly_quiz") setAuthoringPanel("weekly_quiz");
  }, [searchParams]);

  useEffect(() => {
    if (!competitionQueryId || !isSystemAdmin()) return;
    if (searchParams.get("category") === "weekly_quiz") {
      setAuthoringPanel("weekly_quiz");
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
    setAuthoringPanel("weekly_typing");
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
        setTimeout(() => typingSubmitRef.current?.(), 0);
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
  const viewedTerm =
    !isLearner() && searchParams.get("term")
      ? termOptions.find(
          (item) =>
            item.name === searchParams.get("term") &&
            String(item.academic_year) === searchParams.get("academic_year")
        )
      : activeAcademicTerm;
  const assessmentPeriodQuery = (test) =>
    !isLearner() && test?.term && test?.academic_year
      ? new URLSearchParams({ term: test.term, academic_year: test.academic_year }).toString()
      : "";
  const viewAssessmentPeriod = (period) => {
    const params = new URLSearchParams(searchParams);
    params.delete("quiz");
    params.delete("test");
    if (period) {
      params.set("term", period.term || period.name);
      params.set("academic_year", period.academic_year);
    } else {
      params.delete("term");
      params.delete("academic_year");
    }
    if (params.toString() === searchParams.toString()) loadData(true);
    else setSearchParams(params);
  };
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
  const typingCompetitions = competitions.filter(
    (competition) => competition.competition_type === "typing"
  );
  const quizCompetitions = competitions.filter((competition) =>
    ["quiz", "maths", "science", "stem"].includes(competition.competition_type)
  );

  const saveTypingTest = async (overrides = {}) => {
    setMessage("");
    setError("");
    try {
      const effectiveForm = { ...typingForm, ...overrides };
      const payload = {
        ...effectiveForm,
        competition_id:
          effectiveForm.test_type === "competition" ? effectiveForm.competition_id : "",
        eligible_grades: effectiveForm.eligible_grades,
        eligible_streams: [],
      };
      const response = editingTypingId
        ? await apiClient.put(`/typing/tests/${editingTypingId}`, payload)
        : await apiClient.post("/typing/tests", payload);
      setMessage(`${editingTypingId ? "Updated" : "Saved"} ${response.name}`);
      setEditingTypingId(null);
      setTypingForm(emptyTypingForm());
      setAuthoringPanel(null);
      viewAssessmentPeriod(response);
    } catch (err) {
      setError(err.message || "Could not save typing test.");
    }
  };

  const editTypingTest = async (test) => {
    setMessage("");
    setError("");
    setAuthoringPanel("weekly_typing");
    setPerformancePanel(null);
    try {
      const response = await apiClient.get(
        `/typing/tests/${test.id}?${assessmentPeriodQuery(test)}`
      );
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
        setAuthoringPanel(null);
      }
      await loadData();
    } catch (err) {
      setError(err.message || "Could not delete typing setup.");
    }
  };

  const cancelTypingEdit = () => {
    setEditingTypingId(null);
    setTypingForm(emptyTypingForm());
    setAuthoringPanel(null);
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

  const saveQuizTest = async (overrides = {}) => {
    setMessage("");
    setError("");
    try {
      const effectiveForm = { ...quizForm, ...overrides };
      const allocated = effectiveForm.questions.reduce(
        (sum, question) => sum + Number(question.points ?? 0),
        0
      );
      if (allocated > Number(effectiveForm.total_points ?? 0)) {
        setError(
          `Question marks total ${allocated}, which exceeds the quiz total of ${effectiveForm.total_points}.`
        );
        return;
      }
      const payload = {
        ...effectiveForm,
        competition_id:
          effectiveForm.quiz_type === "competition" ? effectiveForm.competition_id : "",
        questions: effectiveForm.questions.map((question, index) => ({
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
      setAuthoringPanel(null);
      viewAssessmentPeriod(response);
    } catch (err) {
      setError(err.message || "Could not save quiz.");
    }
  };

  const editQuizTest = async (test) => {
    setMessage("");
    setError("");
    setAuthoringPanel("weekly_quiz");
    setPerformancePanel(null);
    try {
      const response = await apiClient.get(
        `/quiz-tests/tests/${test.id}?${assessmentPeriodQuery(test)}`
      );
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
        setAuthoringPanel(null);
      }
      await loadData();
    } catch (err) {
      setError(err.message || "Could not delete quiz.");
    }
  };

  const cancelQuizEdit = () => {
    setEditingQuizId(null);
    setQuizForm(emptyQuizForm());
    setAuthoringPanel(null);
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

  const openQuizAttemptReview = async (test, learnerName = "") => {
    setError("");
    setQuizAttemptReviewLoading(true);
    setQuizReviewFilters({ grade: "", stream: "", learnerName });
    setQuizAttemptReview({ test, attempts: [] });
    try {
      const review = await apiClient.get(
        `/quiz-tests/tests/${test.id}/attempts?${assessmentPeriodQuery(test)}`
      );
      setQuizAttemptReview(review);
      setQuizMarkDrafts(
        Object.fromEntries(
          (review.attempts || []).map((attempt) => [
            attempt.id,
            Object.fromEntries(
              (review.test?.questions || []).map((question) => [
                question.id,
                Number(
                  attempt.feedback?.[question.id]?.points ??
                    attempt.feedback?.[String(question.id)]?.points ??
                    0
                ),
              ])
            ),
          ])
        )
      );
    } catch (err) {
      setQuizAttemptReview(null);
      setError(err.message || "Could not load quiz attempts.");
    } finally {
      setQuizAttemptReviewLoading(false);
    }
  };

  // A score in the weekly matrix links to the work behind it: find the weekly
  // quiz for that week and open the attempt review filtered to that learner,
  // which is also where per-question marking happens.
  const openWeekQuizReview = (learner, weekNumber) => {
    const test = quizTests.find(
      (item) => Number(item.week_number) === Number(weekNumber) && item.quiz_type !== "competition"
    );

    if (!test) {
      setError(`No weekly quiz found for week ${weekNumber}.`);
      return;
    }

    openQuizAttemptReview(test, learner.full_name || "");
  };

  const saveQuizAttemptMarks = async (attempt) => {
    setError("");
    setMessage("");
    setSavingQuizAttemptId(attempt.id);
    try {
      const updated = await apiClient.put(
        `/quiz-tests/attempts/${attempt.id}/marks?${assessmentPeriodQuery(
          quizAttemptReview?.test
        )}`,
        {
          question_marks: quizMarkDrafts[attempt.id],
        }
      );
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

  const reviewedQuestionResult = (attempt, question) => {
    const maxPoints = Number(question.points || 0);
    const savedResult =
      attempt.feedback?.[question.id] ?? attempt.feedback?.[String(question.id)] ?? {};
    const points = Number(
      quizMarkDrafts[attempt.id]?.[question.id] ??
        quizMarkDrafts[attempt.id]?.[String(question.id)] ??
        savedResult.points ??
        0
    );
    if (points >= maxPoints) return { points, status: "Right", color: "success" };
    if (points > 0) return { points, status: "Partly right", color: "warning" };
    return { points: 0, status: "Wrong", color: "error" };
  };

  const reviewedAttemptTotal = (attempt) =>
    (quizAttemptReview?.test?.questions || []).reduce(
      (sum, question) => sum + reviewedQuestionResult(attempt, question).points,
      0
    );

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
      setQuizMatchingChoices(
        Object.fromEntries(
          (quiz.questions || [])
            .filter((question) => question.question_type === "matching")
            .map((question) => [
              question.id,
              shuffled((question.options || []).map((pair) => pair.right).filter(Boolean)),
            ])
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
    setQuizMatchingChoices({});
    setQuizRemaining(0);
    quizStartedAtRef.current = null;
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
    if (typingAttemptSubmittingRef.current) return;
    typingAttemptSubmittingRef.current = true;
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
        typingAttemptSubmittingRef.current = false;
      } else {
        setMessage("Typing assessment completed. Your weekly typing score has been recorded.");
        setCompletionSummary({ netWpm: typingStats().netWpm });
        setAdvancingLesson(false);
        typingAttemptSubmittingRef.current = false;
        if (!isLearner()) {
          loadData(true);
        }
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
      typingAttemptSubmittingRef.current = false;
      setError(err.message || "Could not submit typing attempt.");
    }
  };

  typingSubmitRef.current = submitTypingAttempt;

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

  const openAuthoring = (panel) => {
    setPerformancePanel(null);
    setAuthoringPanel(panel);
    setAuthoringScrollRequest((request) => request + 1);
  };

  const showPerformance = (panel) => {
    setAuthoringPanel(null);
    setPerformancePanel((current) => (current === panel ? null : panel));
  };

  const closeAuthoring = () => {
    if (authoringPanel === "weekly_quiz") {
      cancelQuizEdit();
      return;
    }
    cancelTypingEdit();
  };

  const activeTermLabel = activeAcademicTerm
    ? activeAcademicTerm.name + " · " + activeAcademicTerm.academic_year
    : "Not configured for today";

  return (
    <DashboardLayout>
      <DashboardNavbar title="Typing & Quizzes" />
      <MDBox py={2} display="flex" flexDirection="column" gap={2}>
        {!isLearner() && termOptions.length > 0 && (
          <MDInput
            select
            label="Assessment term"
            value={viewedTerm && searchParams.get("term") ? String(viewedTerm.id) : "current"}
            SelectProps={{ native: true }}
            onChange={(event) =>
              viewAssessmentPeriod(
                termOptions.find((item) => String(item.id) === event.target.value)
              )
            }
          >
            <option value="current">Current term · {activeTermLabel}</option>
            {termOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.academic_year} · {item.name}
              </option>
            ))}
          </MDInput>
        )}

        {(error || message) && (
          <Card
            sx={{
              border: "1px solid",
              borderColor: error ? "#fbc8c4" : "#cdebd0",
              borderRadius: "12px",
              boxShadow: "none",
              bgcolor: error ? "#fff7f6" : "#f6fff7",
            }}
          >
            <MDBox px={2} py={1.5} display="flex" alignItems="center" gap={1}>
              <Icon color={error ? "error" : "success"}>
                {error ? "error_outline" : "check_circle"}
              </Icon>
              <MDTypography variant="body2" color={error ? "error" : "success"}>
                {error || message}
              </MDTypography>
            </MDBox>
          </Card>
        )}

        {!loading && !activeAcademicTerm && (
          <Card
            sx={{
              border: "1px solid #ffd7a3",
              borderRadius: "14px",
              boxShadow: "none",
              bgcolor: "#fffaf3",
            }}
          >
            <MDBox p={2} display="flex" alignItems="flex-start" gap={1.25}>
              <Icon color="warning">event_busy</Icon>
              <MDBox>
                <MDTypography variant="button" color="dark" fontWeight="bold" display="block">
                  No current academic term
                </MDTypography>
                <MDTypography variant="body2" color="text">
                  {isLearner()
                    ? "Weekly quizzes and typing tests open during their scheduled term."
                    : "Choose a configured term to create or review assessments. Past-term assessments remain closed to new learner attempts."}
                </MDTypography>
              </MDBox>
            </MDBox>
          </Card>
        )}

        {authoringPanel && canAuthorAssessments && termOptions.length > 0 && (
          <MDBox id="assessment-authoring-studio" ref={authoringRef} sx={{ scrollMarginTop: 96 }}>
            <MDBox
              mb={0.75}
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
            >
              <MDTypography variant="caption" color="text">
                Assessments&nbsp; / &nbsp;
                {authoringPanel === "weekly_quiz" ? "Create Quiz" : "Create Typing Test"}
                &nbsp; / &nbsp;{activeTermLabel}
              </MDTypography>
              <MDButton variant="text" color="dark" size="small" onClick={closeAuthoring}>
                <Icon>close</Icon>&nbsp; Close
              </MDButton>
            </MDBox>
            <Suspense
              fallback={
                <MDTypography variant="caption" color="text">
                  Opening editor...
                </MDTypography>
              }
            >
              {authoringPanel === "weekly_typing" ? (
                <TypingStudioForm
                  typingForm={typingForm}
                  setTypingForm={setTypingForm}
                  editingTypingId={editingTypingId}
                  saveTypingTest={saveTypingTest}
                  cancelTypingEdit={cancelTypingEdit}
                  toggleTypingGrade={toggleTypingGrade}
                  typingTerms={typingTerms}
                  typingCompetitions={typingCompetitions}
                  termOptions={termOptions}
                  selectedTerm={selectedTerm}
                  weekOptions={weekOptions}
                  isSystemAdmin={isSystemAdmin}
                />
              ) : (
                <QuizStudioForm
                  quizForm={quizForm}
                  setQuizForm={setQuizForm}
                  editingQuizId={editingQuizId}
                  saveQuizTest={saveQuizTest}
                  toggleQuizGrade={toggleQuizGrade}
                  toggleQuizCorrectOption={toggleQuizCorrectOption}
                  addQuizQuestion={addQuizQuestion}
                  removeQuizQuestion={removeQuizQuestion}
                  updateQuizQuestion={updateQuizQuestion}
                  addQuizOption={addQuizOption}
                  removeQuizOption={removeQuizOption}
                  uploadQuizQuestionImage={uploadQuizQuestionImage}
                  quizTerms={quizTerms}
                  quizCompetitions={quizCompetitions}
                  termOptions={termOptions}
                  selectedQuizTerm={selectedQuizTerm}
                  quizWeekOptions={quizWeekOptions}
                  isSystemAdmin={isSystemAdmin}
                  termTools={
                    isSchoolAdmin() ? (
                      <AssessmentTermTools
                        grades={grades}
                        streams={streams}
                        courses={courses}
                        terms={terms}
                        academicYears={academicYears}
                        bulkForm={bulkForm}
                        setBulkForm={setBulkForm}
                        syncForm={syncForm}
                        setSyncForm={setSyncForm}
                        bulkAllocate={bulkAllocate}
                        syncResults={syncResults}
                      />
                    ) : null
                  }
                />
              )}
            </Suspense>
          </MDBox>
        )}

        {showAssessmentList && (
          <AssessmentLibrary
            activeAcademicTerm={viewedTerm}
            canCreate={canAuthorAssessments && termOptions.length > 0}
            loading={loading}
            quizTests={quizTests}
            typingTests={typingTests}
            isLearner={isLearner()}
            canManageAssessment={canManageAssessment}
            onCreateQuiz={() => openAuthoring("weekly_quiz")}
            onCreateTyping={() => openAuthoring("weekly_typing")}
            onOpenQuiz={openQuizTest}
            onOpenQuizPerformance={openQuizAttemptReview}
            onEditQuiz={editQuizTest}
            onDuplicateQuiz={duplicateQuizTest}
            onDeleteQuiz={deleteQuizTest}
            onOpenTyping={openTypingTest}
            onEditTyping={editTypingTest}
            onDuplicateTyping={duplicateTypingTest}
            onDeleteTyping={deleteTypingTest}
            onShowQuizMatrix={() => showPerformance("weekly_quiz")}
            onShowTypingMatrix={() => showPerformance("weekly_typing")}
          />
        )}

        {performancePanel && !isLearner() && (
          <Card
            sx={{
              border: "1px solid #e4eaf2",
              borderRadius: "16px",
              boxShadow: "0 10px 28px rgba(52, 71, 103, 0.05)",
              overflow: "hidden",
            }}
          >
            <MDBox
              px={2.5}
              py={1.75}
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              sx={{ borderBottom: "1px solid #edf1f6", bgcolor: "#fbfcfe" }}
            >
              <MDBox>
                <MDTypography variant="h6" color="dark" fontWeight="bold">
                  {performancePanel === "weekly_quiz"
                    ? "Quiz performance matrix"
                    : "Typing performance matrix"}
                </MDTypography>
                <MDTypography variant="caption" color="text">
                  Loaded on demand to keep the assessment page fast.
                </MDTypography>
              </MDBox>
              <MDButton
                variant="text"
                color="dark"
                size="small"
                onClick={() => setPerformancePanel(null)}
              >
                <Icon>close</Icon>&nbsp; Close
              </MDButton>
            </MDBox>
            <MDBox p={{ xs: 1, md: 2 }}>
              <Suspense
                fallback={
                  <MDTypography variant="body2" color="text" p={2}>
                    Loading performance...
                  </MDTypography>
                }
              >
                <WeeklyMatrix
                  key={`${viewedTerm?.id || "current"}:${performancePanel}`}
                  assessmentTerm={viewedTerm?.name}
                  assessmentYear={viewedTerm?.academic_year}
                  defaultMetric={performancePanel === "weekly_quiz" ? "quiz_score" : "typing_score"}
                  title={
                    performancePanel === "weekly_quiz"
                      ? "Weekly quiz matrix"
                      : "Weekly typing matrix"
                  }
                  onScoreClick={openWeekQuizReview}
                />
              </Suspense>
            </MDBox>
          </Card>
        )}

        {isLearner() && (
          <Suspense
            fallback={
              <MDTypography variant="body2" color="text">
                Loading your weekly progress...
              </MDTypography>
            }
          >
            <MyWeeklyProgress />
          </Suspense>
        )}
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
                        <MDButton
                          variant="gradient"
                          color="info"
                          size="small"
                          disabled={savingQuizAttemptId === attempt.id}
                          onClick={() => saveQuizAttemptMarks(attempt)}
                        >
                          {savingQuizAttemptId === attempt.id ? "Saving..." : "Save Reviewed Marks"}
                        </MDButton>
                        <Chip
                          label={`${reviewedAttemptTotal(attempt)} / ${attempt.total_points}`}
                          color={
                            attempt.total_points &&
                            (reviewedAttemptTotal(attempt) / attempt.total_points) * 100 >=
                              Number(quizAttemptReview.test?.pass_score || 0)
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
                        const reviewed = reviewedQuestionResult(attempt, question);
                        return (
                          <MDBox
                            key={question.id}
                            p={1.25}
                            borderRadius="md"
                            sx={{
                              bgcolor:
                                reviewed.color === "success"
                                  ? "#ecfdf5"
                                  : reviewed.color === "warning"
                                  ? "#fff7ed"
                                  : "#fef2f2",
                              border: `1px solid ${
                                reviewed.color === "success"
                                  ? "#a7f3d0"
                                  : reviewed.color === "warning"
                                  ? "#fed7aa"
                                  : "#fecaca"
                              }`,
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
                            <MDBox
                              display="flex"
                              alignItems="center"
                              gap={1}
                              mt={1}
                              flexWrap="wrap"
                            >
                              <MDInput
                                type="number"
                                label={`Mark / ${Number(question.points || 0)}`}
                                value={reviewed.points}
                                inputProps={{
                                  min: 0,
                                  max: Number(question.points || 0),
                                  step: "any",
                                }}
                                onFocus={(event) => event.target.select()}
                                onChange={(event) =>
                                  setQuizMarkDrafts((current) => ({
                                    ...current,
                                    [attempt.id]: {
                                      ...(current[attempt.id] || {}),
                                      [question.id]: event.target.value,
                                    },
                                  }))
                                }
                                sx={{ width: 125 }}
                              />
                              <Chip label={reviewed.status} color={reviewed.color} size="small" />
                            </MDBox>
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
                                      {(quizMatchingChoices[question.id] || []).map((choice) => (
                                        <option key={choice} value={choice}>
                                          {choice}
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
