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
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import { getCachedPage, setCachedPage } from "lib/pageCache";

function Courses() {
  const { user, isSchoolAdmin } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assignmentCourse, setAssignmentCourse] = useState(null);
  const [teacherUserId, setTeacherUserId] = useState("");
  const cacheKey = `school-admin:${user?.schoolId || user?.userId}:courses`;

  useEffect(() => {
    fetchCourses();
  }, [cacheKey]);

  const fetchCourses = async (background = false) => {
    const cached = getCachedPage(cacheKey)?.value;
    if (cached && !background) {
      setCourses(cached.courses || []);
      setTemplates(cached.templates || []);
      setTeachers(cached.teachers || []);
      setAssignments(cached.assignments || []);
    }
    setLoading(!cached && !background);
    setError("");
    try {
      const response = await apiClient.get("/courses");
      setCourses(response);
      if (user?.role === "school_admin") {
        const templateResponse = await apiClient
          .get("/course-templates?category=general")
          .catch((err) => {
            throw new Error(`Templates: ${err.message}`);
          });
        const teacherResponse = await apiClient.get("/users?role=teacher").catch((err) => {
          throw new Error(`Teachers: ${err.message}`);
        });
        const assignmentResponse = await apiClient.get("/teacher-assignments").catch((err) => {
          throw new Error(`Teacher assignments: ${err.message}`);
        });
        setTemplates(templateResponse);
        setTeachers(teacherResponse);
        setAssignments(assignmentResponse);
        setCachedPage(cacheKey, {
          courses: response,
          templates: templateResponse,
          teachers: teacherResponse,
          assignments: assignmentResponse,
        });
      } else {
        setTemplates([]);
        setCachedPage(cacheKey, {
          courses: response,
          templates: [],
          teachers: [],
          assignments: [],
        });
      }
    } catch (err) {
      setError(err.message || "Failed to fetch courses");
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
      await fetchCourses(true);
      navigate(`/school-admin/courses/${course.id}/builder`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const assignTeacher = async () => {
    try {
      await apiClient.post("/teacher-assignments", {
        course_id: assignmentCourse.id,
        teacher_user_id: teacherUserId,
      });
      setAssignmentCourse(null);
      setTeacherUserId("");
      await fetchCourses(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const deallocateTeacher = async (assignmentId) => {
    try {
      await apiClient.delete(`/teacher-assignments/${assignmentId}`);
      setAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId));
      fetchCourses(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const requestUpdate = async (courseId) => {
    try {
      await apiClient.post(`/teacher-assignments/courses/${courseId}/update-requests`, {});
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="Courses"
        subtitle="Adopt templates into your school, then customize your own course version."
        actions={
          <>
            {" "}
            <MDButton variant="gradient" color="info" onClick={fetchCourses}>
              Refresh
            </MDButton>{" "}
          </>
        }
      />
      <MDBox py={2}>
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
              <MDBox p={2}>
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
                                  variant="outlined"
                                  color="info"
                                  size="small"
                                  onClick={() =>
                                    navigate(`/school-admin/courses/${course.id}/preview`)
                                  }
                                >
                                  Preview as Learner
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
                                <MDButton
                                  variant="outlined"
                                  color="dark"
                                  size="small"
                                  onClick={() =>
                                    navigate(`/school-admin/courses/${course.id}/reviews`)
                                  }
                                >
                                  Reviews
                                </MDButton>
                                {user?.role === "school_admin" && (
                                  <MDButton
                                    variant="outlined"
                                    color="warning"
                                    size="small"
                                    onClick={() => setAssignmentCourse(course)}
                                  >
                                    Teachers
                                  </MDButton>
                                )}
                                {user?.role === "teacher" && course.update_available && (
                                  <MDButton
                                    variant="outlined"
                                    color="warning"
                                    size="small"
                                    onClick={() => requestUpdate(course.id)}
                                  >
                                    Request Update
                                  </MDButton>
                                )}
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
          {user?.role === "school_admin" && (
            <Grid item xs={12}>
              <Card>
                <MDBox p={2}>
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
                                        navigate(
                                          `/school-admin/courses/${adoptedCourse.id}/builder`
                                        );
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
          )}
        </Grid>
      </MDBox>
      <Footer />
      <Dialog
        open={Boolean(assignmentCourse)}
        onClose={() => setAssignmentCourse(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Teachers for {assignmentCourse?.name}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel id="course-teacher-label">Teacher</InputLabel>
            <Select
              labelId="course-teacher-label"
              label="Teacher"
              value={teacherUserId}
              onChange={(event) => setTeacherUserId(event.target.value)}
            >
              {teachers
                .filter((teacher) => teacher.is_active)
                .map((teacher) => (
                  <MenuItem key={teacher.id} value={teacher.id}>
                    {teacher.full_name} ({teacher.email})
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          {assignments
            .filter(
              (assignment) =>
                Number(assignment.course_id) === Number(assignmentCourse?.id) &&
                assignment.is_active
            )
            .map((assignment) => (
              <MDBox
                key={assignment.id}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                py={1}
              >
                <MDTypography variant="body2">
                  {assignment.teacher_name} ({assignment.teacher_email})
                </MDTypography>
                <MDButton
                  size="small"
                  color="warning"
                  variant="text"
                  onClick={() => deallocateTeacher(assignment.id)}
                >
                  Deallocate
                </MDButton>
              </MDBox>
            ))}
        </DialogContent>
        <DialogActions>
          <MDButton color="dark" variant="text" onClick={() => setAssignmentCourse(null)}>
            Close
          </MDButton>
          <MDButton color="info" disabled={!teacherUserId} onClick={assignTeacher}>
            Assign Teacher
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

export default Courses;
