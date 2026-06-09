import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";

import DashboardIdentity from "components/DashboardIdentity";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDProgress from "components/MDProgress";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

function statusColor(status) {
  if (["completed", "graded"].includes(status)) return "success";
  if (["started", "in_progress", "submitted"].includes(status)) return "warning";
  return "default";
}

function statusLabel(status) {
  if (["completed", "graded"].includes(status)) return "Done";
  if (["started", "in_progress", "submitted"].includes(status)) return "In progress";
  return "Not done";
}

function progressColor(value) {
  if (Number(value) >= 85) return "success";
  if (Number(value) >= 45) return "info";
  return "warning";
}

function CourseOverview() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [openModules, setOpenModules] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get(`/courses/${courseId}/learning-overview`);
      setOverview(response);
      const firstOpen = response.modules?.[0]?.id;
      setOpenModules(firstOpen ? { [firstOpen]: true } : {});
    } catch (err) {
      setError(err.message || "Failed to load course");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [courseId]);

  const toggleModule = (moduleId) => {
    setOpenModules((current) => ({ ...current, [moduleId]: !current[moduleId] }));
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3} display="flex" justifyContent="space-between" alignItems="center" gap={2}>
          <DashboardIdentity
            user={user}
            title={overview?.course?.name || "Course"}
            subtitle={overview?.course?.description || "Your modules and activities"}
          />
          <MDButton variant="outlined" color="dark" onClick={() => navigate("/learner")}>
            Back
          </MDButton>
        </MDBox>

        {loading ? (
          <Card>
            <MDBox p={4}>
              <MDTypography variant="body2" color="text">
                Loading course...
              </MDTypography>
            </MDBox>
          </Card>
        ) : error ? (
          <Card>
            <MDBox p={4}>
              <MDTypography variant="body2" color="error" fontWeight="medium">
                {error}
              </MDTypography>
            </MDBox>
          </Card>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <MDBox display="flex" flexDirection="column" gap={2}>
                {overview.modules.map((courseModule, index) => (
                  <Card key={courseModule.id}>
                    <MDBox p={2.5}>
                      <MDBox
                        display="flex"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        gap={2}
                      >
                        <MDBox flex={1} minWidth={0}>
                          <MDBox display="flex" alignItems="center" gap={1} mb={0.5}>
                            <Chip
                              size="small"
                              label={`Module ${index + 1}`}
                              color={courseModule.is_done ? "success" : "info"}
                            />
                            {courseModule.is_done && (
                              <Chip size="small" label="Complete" color="success" />
                            )}
                          </MDBox>
                          <MDTypography variant="h6" fontWeight="bold">
                            {courseModule.title}
                          </MDTypography>
                          <MDTypography variant="body2" color="text">
                            {courseModule.description || "Activities for this module."}
                          </MDTypography>
                        </MDBox>
                        <MDBox width={{ xs: 96, sm: 150 }} textAlign="right">
                          <MDTypography variant="button" color="text" fontWeight="medium">
                            {courseModule.completed_activities}/{courseModule.total_activities} done
                          </MDTypography>
                          <MDProgress
                            value={courseModule.progress_percent}
                            color={progressColor(courseModule.progress_percent)}
                            sx={{ mt: 0.75 }}
                          />
                          <MDTypography variant="caption" color="text">
                            {courseModule.score_percent}% marks
                          </MDTypography>
                        </MDBox>
                        <IconButton
                          size="small"
                          aria-label="Toggle activities"
                          onClick={() => toggleModule(courseModule.id)}
                        >
                          <Icon>
                            {openModules[courseModule.id] ? "expand_less" : "expand_more"}
                          </Icon>
                        </IconButton>
                      </MDBox>

                      <Collapse in={Boolean(openModules[courseModule.id])}>
                        <MDBox mt={2} borderTop="1px solid #e5e7eb" pt={1.5}>
                          {courseModule.activities.length === 0 ? (
                            <MDTypography variant="caption" color="text">
                              No activities have been added yet.
                            </MDTypography>
                          ) : (
                            courseModule.activities.map((activity) => (
                              <MDBox
                                key={activity.id}
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                py={1}
                                sx={{ borderBottom: "1px solid #f1f3f4" }}
                              >
                                <MDBox display="flex" alignItems="center" gap={1.25} minWidth={0}>
                                  <Icon fontSize="small" color="action">
                                    {activity.status === "completed"
                                      ? "check_circle"
                                      : "radio_button_unchecked"}
                                  </Icon>
                                  <MDBox minWidth={0}>
                                    <MDTypography variant="button" fontWeight="medium">
                                      {activity.title}
                                    </MDTypography>
                                    <MDTypography variant="caption" color="text" display="block">
                                      {activity.activity_type} | {activity.points || 0} marks
                                    </MDTypography>
                                  </MDBox>
                                </MDBox>
                                <Chip
                                  size="small"
                                  label={statusLabel(activity.status)}
                                  color={statusColor(activity.status)}
                                />
                              </MDBox>
                            ))
                          )}
                          <MDBox display="flex" justifyContent="flex-end" mt={2}>
                            <MDButton
                              variant="gradient"
                              color="success"
                              startIcon={<Icon fontSize="small">open_in_new</Icon>}
                              onClick={() =>
                                navigate(
                                  `/learner/courses/${overview.course.id}/modules/${courseModule.id}/learn`
                                )
                              }
                            >
                              Open Module
                            </MDButton>
                          </MDBox>
                        </MDBox>
                      </Collapse>
                    </MDBox>
                  </Card>
                ))}
              </MDBox>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Card>
                <MDBox p={3}>
                  <MDTypography variant="h6" fontWeight="bold">
                    Course Progress
                  </MDTypography>
                  <MDBox my={2}>
                    <MDProgress
                      value={overview.summary.progress_percent}
                      color={progressColor(overview.summary.progress_percent)}
                      label
                    />
                  </MDBox>
                  <MDTypography variant="body2" color="text">
                    {overview.summary.completed_activities} of {overview.summary.total_activities}{" "}
                    activities complete.
                  </MDTypography>
                  <MDBox display="grid" gridTemplateColumns="1fr 1fr" gap={1.5} mt={2}>
                    <MDBox p={1.5} border="1px solid #e5e7eb" borderRadius="md">
                      <MDTypography variant="caption" color="text">
                        Modules
                      </MDTypography>
                      <MDTypography variant="h5" fontWeight="bold">
                        {overview.summary.completed_modules}/{overview.summary.total_modules}
                      </MDTypography>
                    </MDBox>
                    <MDBox p={1.5} border="1px solid #e5e7eb" borderRadius="md">
                      <MDTypography variant="caption" color="text">
                        Marks
                      </MDTypography>
                      <MDTypography variant="h5" fontWeight="bold">
                        {overview.summary.score_percent}%
                      </MDTypography>
                    </MDBox>
                  </MDBox>
                  {overview.summary.is_done && (
                    <MDBox mt={2} p={2} bgColor="success" borderRadius="md">
                      <MDTypography variant="button" color="white" fontWeight="bold">
                        Course complete
                      </MDTypography>
                    </MDBox>
                  )}
                </MDBox>
              </Card>
            </Grid>
          </Grid>
        )}
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default CourseOverview;
