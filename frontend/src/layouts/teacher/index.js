import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import { getCachedPage, setCachedPage } from "lib/pageCache";
import { useAppPalette } from "lib/appTheme";
import PopulationTrend from "components/PopulationTrend";

const CACHE_KEY = "teacher-dashboard";

function TeacherDashboard() {
  const { user, isTeacher } = useAuth();
  const navigate = useNavigate();
  const palette = useAppPalette();
  const [data, setData] = useState({
    summary: {},
    courses: [],
    recentSubmissions: [],
    currentSchedule: [],
    population: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = getCachedPage(CACHE_KEY)?.value;
    if (cached) {
      setData(cached);
      setLoading(false);
    }

    apiClient
      .get("/teacher-dashboard")
      .then((response) => {
        setData(response);
        setCachedPage(CACHE_KEY, response);
      })
      .catch((error) => console.error("Teacher dashboard:", error))
      .finally(() => setLoading(false));
  }, []);

  if (!isTeacher()) return <MDBox>Access denied. Teacher only.</MDBox>;

  const summary = data.summary || {};
  return (
    <DashboardLayout>
      <DashboardNavbar
        title="Teacher Dashboard"
        subtitle={`${
          user?.schoolName || "Your school"
        } · Courses, learners, reviews and teaching work`}
      />
      <MDBox py={2}>
        <MDBox
          display="grid"
          gridTemplateColumns={{ xs: "repeat(3, minmax(0, 1fr))" }}
          gap={1.25}
          mb={1.5}
        >
          {[
            ["Assigned courses", summary.course_count || 0, "menu_book", "#6944d2", "#efe9ff"],
            ["My learners", summary.learner_count || 0, "groups", "#12855b", "#e4f7ee"],
            [
              "Awaiting review",
              summary.pending_submissions || 0,
              "rate_review",
              "#bb7115",
              "#fff3dc",
            ],
          ].map(([label, value, icon, color, tint]) => (
            <Card key={label}>
              <MDBox p={1.25} display="flex" alignItems="center" gap={1.25}>
                <Icon
                  fontSize="small"
                  sx={{
                    color: palette.dark ? palette.accentText : color,
                    bgcolor: palette.dark ? palette.accentSoft : tint,
                    p: 0.75,
                    width: 32,
                    height: 32,
                    borderRadius: "9px",
                    flexShrink: 0,
                  }}
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

        <Grid container spacing={1.5}>
          <Grid item xs={12} md={5} lg={4}>
            <PopulationTrend population={data.population} loading={loading} />
          </Grid>

          <Grid item xs={12} md={7} lg={8}>
            <Card sx={{ height: "100%" }}>
              <MDBox p={1.75}>
                <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <MDTypography variant="h6" fontWeight="bold">
                    My Courses
                  </MDTypography>
                  <MDButton
                    size="small"
                    color="info"
                    onClick={() => navigate("/school-admin/courses")}
                  >
                    Open Courses
                  </MDButton>
                </MDBox>
                {loading ? (
                  <MDTypography variant="caption" color="text">
                    Loading your courses…
                  </MDTypography>
                ) : data.courses.length === 0 ? (
                  <MDTypography variant="caption" color="text">
                    No course has been assigned to you yet.
                  </MDTypography>
                ) : (
                  <TableContainer sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead sx={{ display: "table-header-group" }}>
                        <TableRow>
                          <TableCell>Course</TableCell>
                          <TableCell align="right">Learners</TableCell>
                          <TableCell align="right">Version</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.courses.map((course) => (
                          <TableRow key={course.id}>
                            <TableCell sx={{ maxWidth: 220 }}>
                              <MDTypography variant="caption" fontWeight="bold" display="block">
                                {course.name}
                              </MDTypography>
                              {course.update_available && (
                                <Chip
                                  size="small"
                                  color="warning"
                                  label="Update available"
                                  sx={{ mt: 0.5, height: 18, fontSize: ".6rem" }}
                                />
                              )}
                            </TableCell>
                            <TableCell align="right">{course.learner_count}</TableCell>
                            <TableCell align="right">v{course.school_version || 1}</TableCell>
                            <TableCell align="right">
                              <MDBox
                                display="flex"
                                gap={0.5}
                                justifyContent="flex-end"
                                flexWrap="nowrap"
                              >
                                <MDButton
                                  size="small"
                                  variant="text"
                                  color="success"
                                  title="View as Learner"
                                  onClick={() =>
                                    navigate(`/school-admin/courses/${course.id}/preview`)
                                  }
                                >
                                  Preview
                                </MDButton>
                                <MDButton
                                  size="small"
                                  variant="text"
                                  color="info"
                                  onClick={() =>
                                    navigate(`/school-admin/courses/${course.id}/builder`)
                                  }
                                >
                                  Manage
                                </MDButton>
                              </MDBox>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: "100%" }}>
              <MDBox p={1.75}>
                <MDTypography variant="h6" fontWeight="bold" mb={1}>
                  Opened Modules
                </MDTypography>
                {data.currentSchedule.length === 0 ? (
                  <MDTypography variant="body2" color="text">
                    No scheduled modules are open yet.
                  </MDTypography>
                ) : (
                  data.currentSchedule.map((item) => (
                    <MDBox
                      key={`${item.course_id}-${item.module_id}`}
                      display="flex"
                      alignItems="center"
                      py={0.85}
                    >
                      <Icon fontSize="small" sx={{ mr: 1, color: palette.accentText }}>
                        event_available
                      </Icon>
                      <MDBox minWidth={0}>
                        <MDTypography variant="caption" fontWeight="bold" display="block">
                          {item.module_title}
                        </MDTypography>
                        <MDTypography variant="caption" color="text" display="block">
                          {item.course_name} · Week {item.week_number}
                        </MDTypography>
                      </MDBox>
                    </MDBox>
                  ))
                )}
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: "100%" }}>
              <MDBox p={1.75}>
                <MDTypography variant="h6" fontWeight="bold" mb={1}>
                  Recent Submissions
                </MDTypography>
                {data.recentSubmissions.length === 0 ? (
                  <MDTypography variant="caption" color="text">
                    No learner submissions yet.
                  </MDTypography>
                ) : (
                  // Capped at four: this is a nudge towards the review queue,
                  // not the queue itself.
                  data.recentSubmissions.slice(0, 4).map((submission) => (
                    <MDBox
                      key={submission.id}
                      py={0.85}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      gap={1}
                      sx={{ borderBottom: `1px solid ${palette.borderSoft}` }}
                    >
                      <MDBox minWidth={0}>
                        <MDTypography variant="caption" fontWeight="bold" display="block">
                          {submission.learner_name}
                        </MDTypography>
                        <MDTypography variant="caption" color="text" display="block" noWrap>
                          {submission.activity_title} · {submission.course_name}
                        </MDTypography>
                      </MDBox>
                      <MDButton
                        size="small"
                        variant="text"
                        color="success"
                        onClick={() =>
                          navigate(`/school-admin/courses/${submission.course_id}/builder?review=1`)
                        }
                      >
                        Review
                      </MDButton>
                    </MDBox>
                  ))
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

export default TeacherDashboard;
