import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Icon from "@mui/material/Icon";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DashboardIdentity from "components/DashboardIdentity";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

function Courses() {
  const { user, isSchoolAdmin } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get("/courses");
      const templateResponse = await apiClient.get("/course-templates?category=general");
      setCourses(response);
      setTemplates(templateResponse);
    } catch (err) {
      setError("Failed to fetch courses");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const canManageCourses = isSchoolAdmin() || user?.role === "teacher";

  if (!canManageCourses) {
    return <MDBox>Access denied. School staff only.</MDBox>;
  }

  const builderReadyCount = courses.filter((c) => c.description || c.estimated_weeks).length;
  const activeCount = courses.filter((c) => c.is_active).length;
  const updateCount = courses.filter((course) => course.update_available).length;
  const adoptedTemplateIds = new Set(courses.map((course) => Number(course.template_id)));

  const adoptTemplate = async (template) => {
    setLoading(true);
    setError("");
    try {
      const course = await apiClient.post(`/course-templates/${template.id}/adopt`, {});
      await fetchCourses();
      navigate(`/school-admin/courses/${course.id}/builder`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3} display="flex" justifyContent="space-between" alignItems="center">
          <DashboardIdentity
            user={user}
            title="Courses"
            subtitle="Adopt templates into your school, then customize your own course version."
          />
          <MDButton variant="gradient" color="info" onClick={fetchCourses}>
            Refresh
          </MDButton>
        </MDBox>

        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <MDBox p={3} display="flex" alignItems="center" justifyContent="space-between">
                <MDBox>
                  <MDTypography variant="body2" color="text" mb={0.5}>
                    Total Courses
                  </MDTypography>
                  <MDTypography variant="h4" fontWeight="bold">
                    {courses.length}
                  </MDTypography>
                </MDBox>
                <MDBox
                  width="48px"
                  height="48px"
                  borderRadius="50%"
                  bgcolor="info.main"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon fontSize="medium" color="white">
                    menu_book
                  </Icon>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <MDBox p={3} display="flex" alignItems="center" justifyContent="space-between">
                <MDBox>
                  <MDTypography variant="body2" color="text" mb={0.5}>
                    Builder Ready
                  </MDTypography>
                  <MDTypography variant="h4" fontWeight="bold">
                    {builderReadyCount}
                  </MDTypography>
                </MDBox>
                <MDBox
                  width="48px"
                  height="48px"
                  borderRadius="50%"
                  bgcolor="success.main"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon fontSize="medium" color="white">
                    view_module
                  </Icon>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <MDBox p={3} display="flex" alignItems="center" justifyContent="space-between">
                <MDBox>
                  <MDTypography variant="body2" color="text" mb={0.5}>
                    Active Courses
                  </MDTypography>
                  <MDTypography variant="h4" fontWeight="bold">
                    {activeCount}
                  </MDTypography>
                  {updateCount > 0 && (
                    <Chip
                      label={`${updateCount} update${updateCount === 1 ? "" : "s"}`}
                      color="warning"
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  )}
                </MDBox>
                <MDBox
                  width="48px"
                  height="48px"
                  borderRadius="50%"
                  bgcolor="warning.main"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon fontSize="medium" color="white">
                    check_circle
                  </Icon>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h6" fontWeight="bold" mb={2}>
                  My School Courses
                </MDTypography>

                {error && (
                  <MDBox mb={2} p={2} bgcolor="error.main" borderRadius={1}>
                    <MDTypography variant="caption" color="white">
                      {error}
                    </MDTypography>
                  </MDBox>
                )}

                {loading ? (
                  <MDBox display="flex" justifyContent="center" py={5}>
                    <MDTypography variant="body2" color="text">
                      Loading courses...
                    </MDTypography>
                  </MDBox>
                ) : courses.length === 0 ? (
                  <MDBox display="flex" flexDirection="column" alignItems="center" py={5}>
                    <Icon fontSize="large" color="text" sx={{ mb: 2 }}>
                      school
                    </Icon>
                    <MDTypography variant="body2" color="text" fontWeight="medium">
                      No courses available
                    </MDTypography>
                    <MDTypography variant="caption" color="text" mt={0.5}>
                      Create courses using the System Admin dashboard.
                    </MDTypography>
                  </MDBox>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead sx={{ display: "table-header-group" }}>
                        <TableRow>
                          <TableCell>Course Name</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Level</TableCell>
                          <TableCell>Weeks</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {courses.map((course) => (
                          <TableRow key={course.id} hover>
                            <TableCell>
                              <MDBox display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                <MDTypography
                                  component="button"
                                  variant="body2"
                                  color="info"
                                  fontWeight="medium"
                                  onClick={() =>
                                    navigate(`/school-admin/courses/${course.id}/builder`)
                                  }
                                  sx={{
                                    background: "none",
                                    border: 0,
                                    cursor: "pointer",
                                    p: 0,
                                    textAlign: "left",
                                  }}
                                >
                                  {course.name}
                                </MDTypography>
                                {course.update_available && (
                                  <Chip label="Update available" color="warning" size="small" />
                                )}
                              </MDBox>
                              {course.template_id && (
                                <MDTypography variant="caption" color="text">
                                  School v{course.school_version || 1} | Synced template v
                                  {course.template_version || 1}
                                  {course.current_template_version
                                    ? ` of ${course.current_template_version}`
                                    : ""}
                                </MDTypography>
                              )}
                            </TableCell>
                            <TableCell>
                              <MDTypography
                                variant="body2"
                                color="text"
                                sx={{
                                  maxWidth: 200,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {course.description || "N/A"}
                              </MDTypography>
                            </TableCell>
                            <TableCell>
                              <MDTypography variant="body2" color="text">
                                {course.target_level || "All levels"}
                              </MDTypography>
                            </TableCell>
                            <TableCell>
                              <MDTypography variant="body2" color="text">
                                {course.estimated_weeks || "-"}
                              </MDTypography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={course.is_active ? "Active" : "Inactive"}
                                color={course.is_active ? "success" : "default"}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <MDBox display="flex" gap={0.5} justifyContent="center">
                                <MDButton
                                  variant="outlined"
                                  color="info"
                                  size="small"
                                  onClick={() =>
                                    navigate(`/school-admin/courses/${course.id}/builder`)
                                  }
                                >
                                  Build
                                </MDButton>
                                <MDButton
                                  variant="gradient"
                                  color="success"
                                  size="small"
                                  onClick={() =>
                                    navigate(`/school-admin/courses/${course.id}/builder?review=1`)
                                  }
                                >
                                  Review Work
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
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h6" fontWeight="bold" mb={2}>
                  Available Templates
                </MDTypography>
                {templates.length === 0 ? (
                  <MDTypography variant="body2" color="text">
                    No templates are available yet.
                  </MDTypography>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead sx={{ display: "table-header-group" }}>
                        <TableRow>
                          <TableCell>Template</TableCell>
                          <TableCell>Level</TableCell>
                          <TableCell>Weeks</TableCell>
                          <TableCell>Version</TableCell>
                          <TableCell align="center">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {templates.map((template) => {
                          const adopted =
                            template.is_adopted || adoptedTemplateIds.has(Number(template.id));
                          const adoptedCourse = courses.find(
                            (course) => Number(course.template_id) === Number(template.id)
                          );
                          return (
                            <TableRow key={template.id} hover>
                              <TableCell>
                                <MDBox display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                  <MDTypography variant="body2" fontWeight="medium">
                                    {template.name}
                                  </MDTypography>
                                  {template.update_available && (
                                    <Chip label="Update available" color="warning" size="small" />
                                  )}
                                  {adopted && !template.update_available && (
                                    <Chip label="Adopted" color="success" size="small" />
                                  )}
                                </MDBox>
                                <MDTypography variant="caption" color="text">
                                  {template.description || "No description"}
                                </MDTypography>
                              </TableCell>
                              <TableCell>{template.target_level || "All levels"}</TableCell>
                              <TableCell>{template.estimated_weeks || "-"}</TableCell>
                              <TableCell>{template.version || 1}</TableCell>
                              <TableCell align="center">
                                <MDButton
                                  variant={adopted ? "outlined" : "gradient"}
                                  color={adopted ? "dark" : "success"}
                                  size="small"
                                  disabled={loading}
                                  onClick={() => {
                                    if (adoptedCourse) {
                                      navigate(`/school-admin/courses/${adoptedCourse.id}/builder`);
                                      return;
                                    }
                                    if (template.adopted_course_id) {
                                      navigate(
                                        `/school-admin/courses/${template.adopted_course_id}/builder`
                                      );
                                      return;
                                    }
                                    adoptTemplate(template);
                                  }}
                                >
                                  {template.update_available
                                    ? "Review"
                                    : adopted
                                    ? "Open"
                                    : "Adopt"}
                                </MDButton>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
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

export default Courses;
