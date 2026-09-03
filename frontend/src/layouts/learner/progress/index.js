import { useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Icon from "@mui/material/Icon";

import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDProgress from "components/MDProgress";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { LearnerHero } from "components/DashboardIdentity";
import { useAppPalette } from "lib/appTheme";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

function progressColor(value) {
  if (Number(value) <= 50) return "warning";
  if (Number(value) <= 80) return "info";
  return "success";
}

function completionLabel(activity) {
  if (activity.completed === true) return "Yes";
  if (activity.completed === false) return "No";
  return activity.completion_enabled ? "Pending sync" : "Not tracked";
}

// One flat surface for every group on this page. The page already sits on a
// card, so these are outlines rather than further raised boxes - nesting real
// Cards three deep is what made the old layout read as a stack of big panels.
function sectionStyles(palette) {
  return {
    panel: {
      border: `1px solid ${palette.border}`,
      borderRadius: "11px",
      overflow: "hidden",
      bgcolor: palette.surface,
    },
    toggle: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 1,
      px: 1.5,
      py: 1.1,
      border: 0,
      bgcolor: palette.surfaceMuted,
      color: palette.text,
      font: "inherit",
      textAlign: "left",
      cursor: "pointer",
      "&:hover": { bgcolor: palette.surfaceSunken },
    },
    moduleRow: {
      border: `1px solid ${palette.borderSoft}`,
      borderRadius: "9px",
      overflow: "hidden",
    },
    moduleToggle: {
      width: "100%",
      border: 0,
      bgcolor: "transparent",
      color: palette.text,
      font: "inherit",
      textAlign: "left",
      cursor: "pointer",
      px: 1.5,
      py: 1,
      "&:hover": { bgcolor: palette.surfaceMuted },
    },
  };
}

function formatTypingScore(value) {
  if (value === null || value === undefined || value === "") return "-";
  return `${Number(value).toFixed(2)} WPM`;
}

function LearnerProgress() {
  const { user, isLearner } = useAuth();
  const palette = useAppPalette();
  const section = sectionStyles(palette);
  const [term, setTerm] = useState("Term 1");
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [terms, setTerms] = useState([]);
  const [summary, setSummary] = useState([]);
  const [courseProgress, setCourseProgress] = useState([]);
  const [expandedModule, setExpandedModule] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    activeCourses: true,
    quizzes: true,
    typing: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const toggleSection = (section) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  useEffect(() => {
    const loadProgress = async () => {
      setLoading(true);
      setError("");
      try {
        const [learners, termsRes, currentTerm] = await Promise.all([
          apiClient.get(`/learners?email=${encodeURIComponent(user?.email)}`),
          apiClient.get("/academic/terms").catch(() => []),
          apiClient.get("/academic/terms/current").catch(() => null),
        ]);
        setTerms(Array.isArray(termsRes) ? termsRes : []);
        let selectedTerm = term;
        let selectedAcademicYear = academicYear;
        if (currentTerm?.name && term === "Term 1") {
          selectedTerm = currentTerm.name;
          selectedAcademicYear =
            currentTerm.academic_year || new Date(currentTerm.start_date).getFullYear();
          setTerm(selectedTerm);
          setAcademicYear(selectedAcademicYear);
        }
        const learner = learners[0];
        if (!learner) {
          setSummary([]);
          setCourseProgress([]);
          return;
        }
        const [weeklySummary, activeCourseProgress] = await Promise.all([
          apiClient.get(
            `/leaderboard/summary/${learner.id}/${selectedTerm}/${selectedAcademicYear}`
          ),
          apiClient.get(
            `/leaderboard/course-progress/${learner.id}?term=${encodeURIComponent(
              selectedTerm
            )}&academicYear=${selectedAcademicYear}`
          ),
        ]);
        setSummary(Array.isArray(weeklySummary) ? weeklySummary : []);
        setCourseProgress(Array.isArray(activeCourseProgress) ? activeCourseProgress : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (isLearner() && user?.email) {
      loadProgress();
    }
  }, [user?.email, term, academicYear]);

  if (!isLearner()) {
    return <MDBox p={2}>Access denied. Learner only.</MDBox>;
  }

  const quizWeeks = summary.filter(
    (week) =>
      week.quiz_score !== null &&
      week.quiz_score !== undefined &&
      Number.isFinite(Number(week.quiz_score))
  );
  const typingWeeks = summary.filter(
    (week) =>
      week.typing_score !== null &&
      week.typing_score !== undefined &&
      Number.isFinite(Number(week.typing_score))
  );
  const averageQuiz = quizWeeks.length
    ? Math.round(
        quizWeeks.reduce((sum, week) => sum + Number(week.quiz_score), 0) / quizWeeks.length
      )
    : null;
  const bestTyping = typingWeeks.length
    ? Math.max(...typingWeeks.map((week) => Number(week.typing_score))).toFixed(0)
    : null;
  const completedModules = courseProgress.reduce(
    (sum, course) => sum + Number(course.completed_modules || 0),
    0
  );
  const totalModules = courseProgress.reduce(
    (sum, course) => sum + Number(course.total_modules || 0),
    0
  );
  const modulePercent = totalModules ? Math.round((completedModules / totalModules) * 100) : 0;

  // Typing a year into a box could only ever produce an empty page: the only
  // years with data are the ones the school created terms for. The current
  // selection is always included so the select cannot read as blank.
  const academicYears = [
    ...new Set(
      [...terms.map((item) => item.academic_year), academicYear]
        .filter((value) => value !== null && value !== undefined && value !== "")
        .map(Number)
        .filter(Number.isFinite)
    ),
  ].sort((a, b) => b - a);

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="My Progress"
        subtitle="Your effort is adding up. See what you’ve learned."
      />
      <MDBox py={2}>
        <LearnerHero
          eyebrow="CELEBRATE EVERY LITTLE WIN"
          title="Look at you grow!"
          description="Every lesson, every challenge, every new skill. This is the story of your learning adventure."
          art="rocket"
        />
        <MDBox
          display="grid"
          gridTemplateColumns={{ xs: "repeat(2,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" }}
          gap={1.25}
          mb={1.5}
        >
          {[
            ["Courses", courseProgress.length, "menu_book", "#6944d2", "#efe9ff"],
            ["Modules mastered", completedModules, "task_alt", "#12855b", "#e4f7ee"],
            [
              "Quiz average",
              averageQuiz === null ? "—" : `${averageQuiz}%`,
              "psychology",
              "#bb7115",
              "#fff3dc",
            ],
            [
              "Best typing",
              bestTyping === null ? "—" : `${bestTyping} WPM`,
              "keyboard",
              "#167ea2",
              "#e6f5fc",
            ],
          ].map(([label, value, icon, color, tint]) => (
            <Card key={label}>
              <MDBox p={1.25} display="flex" alignItems="center" gap={1.25}>
                <Icon
                  sx={{
                    color: palette.dark ? palette.accentText : color,
                    bgcolor: palette.dark ? palette.accentSoft : tint,
                    p: 0.75,
                    width: 32,
                    height: 32,
                    borderRadius: "9px",
                    flexShrink: 0,
                  }}
                  fontSize="small"
                >
                  {icon}
                </Icon>
                <MDBox minWidth={0}>
                  <MDTypography
                    variant="h5"
                    sx={{
                      color: palette.dark ? palette.text : color,
                      fontWeight: 800,
                      lineHeight: 1.1,
                    }}
                  >
                    {loading ? "—" : value}
                  </MDTypography>
                  <MDTypography
                    variant="caption"
                    color="text"
                    sx={{ display: "block", lineHeight: 1.3 }}
                  >
                    {label}
                  </MDTypography>
                </MDBox>
              </MDBox>
            </Card>
          ))}
        </MDBox>
        {!loading && !error && (
          <Grid container spacing={1.5} mb={1.5}>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: "100%" }}>
                <MDBox p={1.75} display="flex" alignItems="center" gap={1.75}>
                  <MDBox
                    role="img"
                    aria-label={`${modulePercent}% of modules mastered`}
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      background: `conic-gradient(#24b97b ${modulePercent}%, ${palette.track} 0)`,
                      p: "6px",
                      flexShrink: 0,
                    }}
                  >
                    <MDBox
                      sx={{
                        bgcolor: palette.surface,
                        borderRadius: "50%",
                        width: "100%",
                        height: "100%",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 800,
                        fontSize: ".9rem",
                        color: palette.text,
                      }}
                    >
                      {modulePercent}%
                    </MDBox>
                  </MDBox>
                  <MDBox minWidth={0}>
                    <MDTypography variant="h6">Keep exploring</MDTypography>
                    <MDTypography variant="caption" color="text" display="block">
                      {completedModules} of {totalModules} modules mastered.
                    </MDTypography>
                  </MDBox>
                </MDBox>
              </Card>
            </Grid>
            <Grid item xs={12} md={8}>
              <Card sx={{ height: "100%" }}>
                <MDBox p={1.75}>
                  <MDTypography variant="h6" mb={1.25}>
                    Your quiz journey
                  </MDTypography>
                  {quizWeeks.length ? (
                    <MDBox
                      display="flex"
                      alignItems="flex-end"
                      gap={1}
                      sx={{ height: 92, overflowX: "auto" }}
                    >
                      {quizWeeks.map((week) => (
                        <MDBox
                          key={week.week_number || week.week}
                          sx={{
                            minWidth: 28,
                            flex: 1,
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-end",
                            alignItems: "center",
                          }}
                        >
                          <MDTypography
                            variant="caption"
                            sx={{ color: palette.accentText, fontWeight: 700 }}
                          >
                            {week.quiz_score}%
                          </MDTypography>
                          <MDBox
                            sx={{
                              width: "min(100%, 24px)",
                              minHeight: 3,
                              // The track is 92px tall and the score sits above
                              // the bar with the week label below it, so a full
                              // 100% has 50px to grow into.
                              height: `${
                                Math.max(0, Math.min(100, Number(week.quiz_score))) * 0.5
                              }px`,
                              borderRadius: "6px 6px 2px 2px",
                              background: "linear-gradient(#b18aef,#7444d6)",
                            }}
                          />
                          <MDTypography
                            variant="caption"
                            color="text"
                            sx={{ fontSize: ".65rem", mt: 0.5 }}
                          >
                            W{week.week_number || week.week}
                          </MDTypography>
                        </MDBox>
                      ))}
                    </MDBox>
                  ) : (
                    <MDTypography variant="body2" color="text">
                      Take your first quiz to start your progress story.
                    </MDTypography>
                  )}
                </MDBox>
              </Card>
            </Grid>
          </Grid>
        )}
        <Grid container spacing={1.5} mb={1.5}>
          <Grid item xs={7} sm={4} md={3}>
            <MDInput
              select
              label="Term"
              fullWidth
              size="small"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              SelectProps={{ native: true }}
            >
              {terms.length === 0 && <option value="">No terms configured</option>}
              {terms.map((termItem) => (
                <option key={termItem.id} value={termItem.name}>
                  {termItem.name} ({termItem.academic_year || "Year not set"})
                </option>
              ))}
            </MDInput>
          </Grid>
          <Grid item xs={5} sm={3} md={2}>
            <MDInput
              select
              label="Year"
              fullWidth
              size="small"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              SelectProps={{ native: true }}
            >
              {academicYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </MDInput>
          </Grid>
        </Grid>
        <Grid container spacing={1.5}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={1.75}>
                {error && (
                  <MDTypography variant="caption" color="error" display="block" mb={2}>
                    {error}
                  </MDTypography>
                )}
                {loading ? (
                  <MDTypography variant="body2">Loading progress...</MDTypography>
                ) : courseProgress.length === 0 && summary.length === 0 ? (
                  <MDTypography variant="body2" color="text">
                    No weekly progress has been recorded yet.
                  </MDTypography>
                ) : (
                  <MDBox display="flex" flexDirection="column" gap={1.5}>
                    <Grid container spacing={1.5}>
                      {[
                        [
                          "quizzes",
                          "Weekly Quizzes",
                          "Score",
                          (week) => `${week.quiz_score ?? "-"}%`,
                        ],
                        [
                          "typing",
                          "Weekly Typing",
                          "Adjusted WPM",
                          (week) => formatTypingScore(week.typing_score),
                        ],
                      ].map(([key, heading, columnLabel, readValue]) => (
                        <Grid item xs={12} md={6} key={key}>
                          <MDBox sx={section.panel}>
                            {/* The toggle is the header alone: with the click
                                handler on the whole panel, reading a row of the
                                table collapsed the table under the cursor. */}
                            <MDBox
                              component="button"
                              type="button"
                              onClick={() => toggleSection(key)}
                              aria-expanded={expandedSections[key]}
                              sx={section.toggle}
                            >
                              <MDTypography variant="button" fontWeight="bold">
                                {heading}
                              </MDTypography>
                              <Icon fontSize="small">
                                {expandedSections[key] ? "expand_less" : "expand_more"}
                              </Icon>
                            </MDBox>
                            {expandedSections[key] && (
                              <TableContainer sx={{ maxHeight: 232, overflowX: "auto" }}>
                                <Table size="small" stickyHeader>
                                  <TableHead sx={{ display: "table-header-group" }}>
                                    <TableRow>
                                      <TableCell>Week</TableCell>
                                      <TableCell>{columnLabel}</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {summary.map((week) => (
                                      <TableRow key={`${key}-${week.week_number || week.week}`}>
                                        <TableCell>{week.week_number || week.week}</TableCell>
                                        <TableCell>{readValue(week)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            )}
                          </MDBox>
                        </Grid>
                      ))}
                    </Grid>

                    {courseProgress.length === 0 ? (
                      <MDBox sx={section.panel} p={1.5}>
                        <MDTypography variant="button" fontWeight="bold" display="block">
                          Active Course
                        </MDTypography>
                        <MDTypography variant="caption" color="text">
                          No active course progress recorded yet.
                        </MDTypography>
                      </MDBox>
                    ) : (
                      courseProgress.map((course) => (
                        <MDBox sx={section.panel} key={course.course_id}>
                          <MDBox p={1.5}>
                            <MDBox
                              display="flex"
                              justifyContent="space-between"
                              alignItems="center"
                              mb={0.75}
                              gap={1.5}
                              flexWrap="wrap"
                            >
                              <MDBox minWidth={0}>
                                <MDTypography variant="button" fontWeight="bold" display="block">
                                  {course.course_name}
                                </MDTypography>
                                <MDTypography variant="caption" color="text">
                                  {course.completed_modules}/{course.total_modules} modules complete
                                </MDTypography>
                              </MDBox>
                              <Chip
                                label={`${course.score_percent}% - ${course.grade_label}`}
                                color={progressColor(course.score_percent)}
                                size="small"
                              />
                            </MDBox>
                            <MDProgress
                              variant="gradient"
                              color={progressColor(course.completion_percent)}
                              value={course.completion_percent}
                            />
                            <MDBox display="flex" flexDirection="column" gap={0.75} mt={1.25}>
                              {course.modules.map((module) => {
                                const moduleKey = `${course.course_id}-${module.module_number}`;
                                const open = expandedModule === moduleKey;
                                return (
                                  <MDBox key={moduleKey} sx={section.moduleRow}>
                                    <MDBox
                                      component="button"
                                      type="button"
                                      aria-expanded={open}
                                      onClick={() => setExpandedModule(open ? "" : moduleKey)}
                                      sx={section.moduleToggle}
                                    >
                                      <MDBox
                                        display="flex"
                                        justifyContent="space-between"
                                        alignItems="center"
                                        gap={1}
                                        mb={0.5}
                                      >
                                        <MDTypography
                                          variant="caption"
                                          fontWeight="bold"
                                          sx={{ color: palette.accentText, minWidth: 0 }}
                                        >
                                          {module.module_number}. {module.name}
                                        </MDTypography>
                                        <MDTypography variant="caption" color="text" flexShrink={0}>
                                          {module.progress_percent}%
                                        </MDTypography>
                                      </MDBox>
                                      <MDProgress
                                        variant="gradient"
                                        color={progressColor(module.progress_percent)}
                                        value={module.progress_percent}
                                      />
                                      <MDBox
                                        display="flex"
                                        justifyContent="space-between"
                                        gap={1}
                                        mt={0.5}
                                      >
                                        <MDTypography variant="caption" color="text">
                                          {module.completed_activities}/{module.total_activities}{" "}
                                          activities
                                        </MDTypography>
                                        <MDTypography variant="caption" color="text">
                                          Mark: {module.score_percent ?? "-"}% |{" "}
                                          {module.grade_label}
                                        </MDTypography>
                                      </MDBox>
                                    </MDBox>
                                    {open && (
                                      <MDBox px={1.5} pb={1.5}>
                                        <MDTypography
                                          variant="caption"
                                          color="text"
                                          fontWeight="bold"
                                        >
                                          Activity performance
                                        </MDTypography>
                                        <TableContainer sx={{ mt: 0.75, overflowX: "auto" }}>
                                          <Table size="small">
                                            <TableHead sx={{ display: "table-header-group" }}>
                                              <TableRow>
                                                <TableCell>Activity</TableCell>
                                                <TableCell>Type</TableCell>
                                                <TableCell>Completion</TableCell>
                                                <TableCell>Mark</TableCell>
                                              </TableRow>
                                            </TableHead>
                                            <TableBody>
                                              {(module.activities || []).map((activity) => (
                                                <TableRow key={activity.id || activity.name}>
                                                  <TableCell>{activity.name}</TableCell>
                                                  <TableCell>{activity.type || "-"}</TableCell>
                                                  <TableCell>{completionLabel(activity)}</TableCell>
                                                  <TableCell>
                                                    {activity.score_percent ?? "-"}%
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </TableContainer>
                                      </MDBox>
                                    )}
                                  </MDBox>
                                );
                              })}
                            </MDBox>
                            {course.sync_warning && (
                              <MDTypography
                                variant="caption"
                                color="warning"
                                display="block"
                                mt={1}
                              >
                                Showing cached progress. Latest sync warning: {course.sync_warning}
                              </MDTypography>
                            )}
                          </MDBox>
                        </MDBox>
                      ))
                    )}
                  </MDBox>
                )}
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default LearnerProgress;
