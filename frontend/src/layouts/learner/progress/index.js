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

function formatTypingScore(value) {
  if (value === null || value === undefined || value === "") return "-";
  return `${Number(value).toFixed(2)} WPM`;
}

function LearnerProgress() {
  const { user, isLearner } = useAuth();
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

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="My Progress"
        subtitle="Weekly quiz, typing, and course progress from eduClub tracking."
      />
      <MDBox py={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <MDInput
              select
              label="Term"
              fullWidth
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
          <Grid item xs={12} md={3}>
            <MDInput
              label="Academic Year"
              type="number"
              fullWidth
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <Card>
              <MDBox p={2}>
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
                  <MDBox display="flex" flexDirection="column" gap={2}>
                    <Card variant="outlined">
                      <MDBox
                        p={2}
                        sx={{ cursor: "pointer" }}
                        onClick={() => toggleSection("quizzes")}
                      >
                        <MDBox
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <MDTypography variant="h6" fontWeight="bold">
                            Weekly Quizzes
                          </MDTypography>
                          <Icon fontSize="small">
                            {expandedSections.quizzes ? "expand_less" : "expand_more"}
                          </Icon>
                        </MDBox>
                        <MDTypography variant="caption" color="text" display="block">
                          Your quiz performance across the selected term.
                        </MDTypography>
                        {expandedSections.quizzes && (
                          <TableContainer sx={{ mt: 1.5 }}>
                            <Table size="small">
                              <TableHead sx={{ display: "table-header-group" }}>
                                <TableRow>
                                  <TableCell>Week</TableCell>
                                  <TableCell>Score</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {summary.map((week) => (
                                  <TableRow key={`quiz-${week.week_number || week.week}`}>
                                    <TableCell>{week.week_number || week.week}</TableCell>
                                    <TableCell>{week.quiz_score ?? "-"}%</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                      </MDBox>
                    </Card>

                    <Card variant="outlined">
                      <MDBox
                        p={2}
                        sx={{ cursor: "pointer" }}
                        onClick={() => toggleSection("typing")}
                      >
                        <MDBox
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <MDTypography variant="h6" fontWeight="bold">
                            Weekly Typing
                          </MDTypography>
                          <Icon fontSize="small">
                            {expandedSections.typing ? "expand_less" : "expand_more"}
                          </Icon>
                        </MDBox>
                        <MDTypography variant="caption" color="text" display="block">
                          Adjusted WPM combines speed with accuracy.
                        </MDTypography>
                        {expandedSections.typing && (
                          <TableContainer sx={{ mt: 1.5 }}>
                            <Table size="small">
                              <TableHead sx={{ display: "table-header-group" }}>
                                <TableRow>
                                  <TableCell>Week</TableCell>
                                  <TableCell>Typing</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {summary.map((week) => (
                                  <TableRow key={`typing-${week.week_number || week.week}`}>
                                    <TableCell>{week.week_number || week.week}</TableCell>
                                    <TableCell>{formatTypingScore(week.typing_score)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                      </MDBox>
                    </Card>

                    {courseProgress.length === 0 ? (
                      <Card variant="outlined">
                        <MDBox p={2}>
                          <MDTypography variant="h6" fontWeight="bold">
                            Active Course
                          </MDTypography>
                          <MDTypography variant="caption" color="text">
                            No active course progress recorded yet.
                          </MDTypography>
                        </MDBox>
                      </Card>
                    ) : (
                      courseProgress.map((course) => (
                        <Card variant="outlined" key={course.course_id}>
                          <MDBox p={2}>
                            <MDBox
                              display="flex"
                              justifyContent="space-between"
                              alignItems="center"
                              mb={1}
                              gap={2}
                              flexWrap="wrap"
                            >
                              <MDBox>
                                <MDTypography variant="h6" fontWeight="bold">
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
                            <MDBox display="flex" flexDirection="column" gap={2} mt={2}>
                              {course.modules.map((module) => (
                                <Card
                                  variant="outlined"
                                  key={`${course.course_id}-${module.module_number}`}
                                  sx={{ cursor: "pointer" }}
                                  onClick={() => {
                                    const key = `${course.course_id}-${module.module_number}`;
                                    setExpandedModule(expandedModule === key ? "" : key);
                                  }}
                                >
                                  <MDBox p={2}>
                                    <MDBox display="flex" justifyContent="space-between" gap={1}>
                                      <MDTypography variant="button" fontWeight="bold">
                                        <MDBox
                                          component="span"
                                          color="info.main"
                                          sx={{
                                            textDecoration: "underline",
                                            textUnderlineOffset: "3px",
                                          }}
                                        >
                                          {module.module_number}. {module.name}
                                        </MDBox>
                                      </MDTypography>
                                      <MDTypography variant="caption" color="text">
                                        {module.progress_percent}%
                                      </MDTypography>
                                    </MDBox>
                                    <MDProgress
                                      variant="gradient"
                                      color={progressColor(module.progress_percent)}
                                      value={module.progress_percent}
                                    />
                                    <MDBox display="flex" justifyContent="space-between" mt={1}>
                                      <MDTypography variant="caption" color="text">
                                        {module.completed_activities}/{module.total_activities}{" "}
                                        activities
                                      </MDTypography>
                                      <MDTypography variant="caption" color="text">
                                        Mark: {module.score_percent ?? "-"}% | {module.grade_label}
                                      </MDTypography>
                                    </MDBox>
                                    {expandedModule ===
                                      `${course.course_id}-${module.module_number}` && (
                                      <MDBox mt={2}>
                                        <MDTypography
                                          variant="caption"
                                          color="text"
                                          fontWeight="bold"
                                        >
                                          Activity performance
                                        </MDTypography>
                                        <TableContainer sx={{ mt: 1 }}>
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
                                </Card>
                              ))}
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
                        </Card>
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
