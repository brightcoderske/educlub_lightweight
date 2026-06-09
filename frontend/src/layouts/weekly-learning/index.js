import { useEffect, useState } from "react";
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
import Icon from "@mui/material/Icon";

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

const gradeOptions = Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`);

function WeeklyLearning() {
  const { user, isSystemAdmin, isSchoolAdmin, isLearner } = useAuth();
  const [searchParams] = useSearchParams();
  const competitionQueryId = searchParams.get("competition_id") || searchParams.get("competition");
  const [courses, setCourses] = useState([]);
  const [typingTests, setTypingTests] = useState([]);
  const [typingReport, setTypingReport] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [learners, setLearners] = useState([]);
  const [school, setSchool] = useState(null);
  const [academicTerms, setAcademicTerms] = useState([]);
  const [termWeeks, setTermWeeks] = useState([]);
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
        const weeklyCourses = await apiClient.get(`/weekly-learning?category=${category}`);
        setCourses(weeklyCourses);
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
  }, [category, user?.schoolId, searchParams, typingReportFilters, competitionQueryId]);

  useEffect(() => {
    if (!competitionQueryId || !isSystemAdmin()) return;
    setCategory("weekly_typing");
    setTypingForm((current) => ({
      ...current,
      test_type: "competition",
      competition_id: competitionQueryId,
      name: current.name || "Typing Competition Assessment",
    }));
  }, [competitionQueryId, isSystemAdmin]);

  useEffect(() => {
    const selectedTerm = academicTerms.find(
      (term) =>
        term.name === typingForm.term &&
        String(term.academic_year || "") === String(typingForm.academic_year || "")
    );
    if (!selectedTerm?.id) {
      setTermWeeks([]);
      return;
    }
    apiClient
      .get(`/academic/terms/${selectedTerm.id}/weeks`)
      .then((weeks) => setTermWeeks(Array.isArray(weeks) ? weeks : []))
      .catch(() => setTermWeeks([]));
  }, [academicTerms, typingForm.term, typingForm.academic_year]);

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
  const termOptions = academicTerms.length
    ? academicTerms
    : ["Term 1", "Term 2", "Term 3"].map((name) => ({
        id: name,
        name,
        academic_year: new Date().getFullYear(),
        total_weeks: 13,
      }));
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
  const weekOptions = termWeeks.length
    ? termWeeks.map((week) => week.week_number)
    : Array.from({ length: Number(selectedTerm?.total_weeks || 13) }, (_, index) => index + 1);
  const reportWeekOptions =
    typingReportFilters.term && selectedReportTerm?.total_weeks
      ? Array.from(
          { length: Number(selectedReportTerm.total_weeks || 13) },
          (_, index) => index + 1
        )
      : weekOptions;
  const typingCompetitions = competitions.filter(
    (competition) => competition.competition_type === "typing"
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
    category === "weekly_quiz" && allocations.length === 0
      ? courses.map((course) => ({
          id: course.id,
          name: course.name,
          course_category: course.course_category,
          term: syncForm.term,
          academic_year: syncForm.academic_year,
        }))
      : allocations.map((item) => ({
          id: item.course_id,
          allocation_id: item.id,
          name: item.course_name,
          course_category: item.course_category,
          term: item.term,
          academic_year: item.academic_year,
        }));

  const rows = isLearner() ? learnerRows : courses;

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
                            onChange={(event) =>
                              setTypingForm({
                                ...typingForm,
                                academic_year: event.target.value,
                                week_number: 1,
                              })
                            }
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
                            {terms.map((term) => (
                              <option key={term} value={term}>
                                {term}
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
                            onChange={(event) =>
                              setTypingForm({ ...typingForm, week_number: event.target.value })
                            }
                            SelectProps={{ native: true }}
                          >
                            {weekOptions.map((weekNumber) => (
                              <option key={weekNumber} value={weekNumber}>
                                Week {weekNumber}
                              </option>
                            ))}
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
                          <TableCell>Type</TableCell>
                          <TableCell>Source</TableCell>
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
                                label={row.course_category === "weekly_typing" ? "Typing" : "Quiz"}
                                color={row.course_category === "weekly_typing" ? "success" : "info"}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>Native</TableCell>
                            {isLearner() && (
                              <TableCell>
                                {row.term} | {row.academic_year}
                              </TableCell>
                            )}
                            <TableCell align="center">
                              <MDTypography variant="caption" color="text">
                                {row.course_category === "weekly_typing"
                                  ? "Open a typing test below"
                                  : "Native quiz builder pending"}
                              </MDTypography>
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
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
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
    </DashboardLayout>
  );
}

export default WeeklyLearning;
