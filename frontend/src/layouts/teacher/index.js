import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardIdentity from "components/DashboardIdentity";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

function TeacherDashboard() {
  const { user, isTeacher } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({
    summary: {},
    courses: [],
    recentSubmissions: [],
    currentSchedule: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/teacher-dashboard")
      .then(setData)
      .catch((error) => console.error("Teacher dashboard:", error))
      .finally(() => setLoading(false));
  }, []);

  if (!isTeacher()) return <MDBox>Access denied. Teacher only.</MDBox>;

  const summary = data.summary || {};
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <DashboardIdentity
          user={user}
          title="Teacher Dashboard"
          subtitle={`${
            user?.schoolName || "Your school"
          } · Courses, learners, reviews and teaching work`}
        />

        <Grid container spacing={3} mt={0.5}>
          <Grid item xs={12} sm={6} lg={4}>
            <ComplexStatisticsCard
              color="info"
              icon="menu_book"
              title="Assigned Courses"
              count={summary.course_count || 0}
              percentage={{ color: "info", amount: "", label: "Active teaching workspace" }}
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={4}>
            <ComplexStatisticsCard
              color="success"
              icon="groups"
              title="My Learners"
              count={summary.learner_count || 0}
              percentage={{ color: "success", amount: "", label: "Across assigned courses" }}
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={4}>
            <ComplexStatisticsCard
              color="warning"
              icon="rate_review"
              title="Awaiting Review"
              count={summary.pending_submissions || 0}
              percentage={{ color: "warning", amount: "", label: "Submitted activities" }}
            />
          </Grid>

          <Grid item xs={12} lg={7}>
            <Card>
              <MDBox p={3}>
                <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
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
                  <MDTypography variant="body2">Loading...</MDTypography>
                ) : data.courses.length === 0 ? (
                  <MDTypography variant="body2" color="text">
                    No course has been assigned to you yet.
                  </MDTypography>
                ) : (
                  data.courses.map((course) => (
                    <MDBox
                      key={course.id}
                      py={1.5}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      borderBottom="1px solid #edf0f5"
                      gap={2}
                    >
                      <MDBox minWidth={0}>
                        <MDTypography variant="button" fontWeight="bold">
                          {course.name}
                        </MDTypography>
                        <MDTypography variant="caption" color="text" display="block">
                          {course.learner_count} learners · School v{course.school_version || 1}
                        </MDTypography>
                      </MDBox>
                      <MDBox display="flex" gap={1} alignItems="center">
                        {course.update_available && (
                          <Chip size="small" color="warning" label="Update available" />
                        )}
                        <MDButton
                          size="small"
                          variant="outlined"
                          color="success"
                          onClick={() =>
                            navigate(`/school-admin/courses/${course.id}/preview`)
                          }
                        >
                          View as Learner
                        </MDButton>
                        <MDButton
                          size="small"
                          variant="outlined"
                          color="info"
                          onClick={() => navigate(`/school-admin/courses/${course.id}/builder`)}
                        >
                          Manage
                        </MDButton>
                      </MDBox>
                    </MDBox>
                  ))
                )}
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h6" fontWeight="bold" mb={2}>
                  Opened Modules
                </MDTypography>
                {data.currentSchedule.length === 0 ? (
                  <MDTypography variant="body2" color="text">
                    No scheduled modules are open yet.
                  </MDTypography>
                ) : (
                  data.currentSchedule.map((item) => (
                    <MDBox key={`${item.course_id}-${item.module_id}`} display="flex" py={1.2}>
                      <Icon color="info" sx={{ mr: 1.5 }}>
                        event_available
                      </Icon>
                      <MDBox>
                        <MDTypography variant="button" fontWeight="medium">
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

          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h6" fontWeight="bold" mb={2}>
                  Recent Submissions
                </MDTypography>
                {data.recentSubmissions.length === 0 ? (
                  <MDTypography variant="body2" color="text">
                    No learner submissions yet.
                  </MDTypography>
                ) : (
                  data.recentSubmissions.map((submission) => (
                    <MDBox
                      key={submission.id}
                      py={1.25}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      borderBottom="1px solid #edf0f5"
                    >
                      <MDBox>
                        <MDTypography variant="button" fontWeight="medium">
                          {submission.learner_name}
                        </MDTypography>
                        <MDTypography variant="caption" color="text" display="block">
                          {submission.activity_title} · {submission.course_name}
                        </MDTypography>
                      </MDBox>
                      <MDButton
                        size="small"
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
