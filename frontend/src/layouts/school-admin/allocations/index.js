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

import DashboardIdentity from "components/DashboardIdentity";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

function SchoolAdminAllocations() {
  const { user, isSchoolAdmin } = useAuth();
  const [learners, setLearners] = useState([]);
  const [courses, setCourses] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [school, setSchool] = useState(null);
  const [form, setForm] = useState({
    learner_id: "",
    grade: "",
    stream: "",
    course_id: "",
    term: "Term 1",
    academic_year: new Date().getFullYear(),
  });
  const [bulkForm, setBulkForm] = useState({
    grade: "",
    stream: "",
    course_id: "",
    term: "Term 1",
    academic_year: new Date().getFullYear(),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [learnersRes, coursesRes, allocationsRes] = await Promise.all([
        apiClient.get(
          `/learners?school_id=${user?.schoolId}${
            user?.role === "teacher" ? "&scope=allocation_picker" : ""
          }`
        ),
        apiClient.get("/courses?category=general"),
        apiClient.get(`/allocations?school_id=${user?.schoolId}`),
      ]);
      const schoolRes = user?.schoolId
        ? await apiClient.get(`/schools/${user.schoolId}`).catch(() => null)
        : null;
      setLearners(learnersRes);
      setCourses(coursesRes);
      setAllocations(allocationsRes);
      setSchool(schoolRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSchoolAdmin() && user?.schoolId) {
      loadData();
    }
  }, [user?.schoolId]);

  const createAllocation = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiClient.post("/allocations", form);
      setMessage("Learner allocated to the course.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const bulkAllocate = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await apiClient.post("/allocations/bulk", bulkForm);
      setMessage(result.message);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deallocate = async (allocation) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiClient.delete(`/allocations/${allocation.id}`);
      setMessage("Allocation removed.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const learnerStreams = Array.from(
    new Set(learners.map((learner) => learner.stream).filter(Boolean))
  );
  const grades = school?.grades_config?.length
    ? school.grades_config
    : Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`);
  const streams = school?.streams_config?.length ? school.streams_config : learnerStreams;
  const terms = ["Term 1", "Term 2", "Term 3"];
  const academicYears = Array.from({ length: 5 }, (_, index) => new Date().getFullYear() + index);
  const learnerOptions = learners.filter((learner) => {
    const gradeMatches = !form.grade || learner.grade === form.grade;
    const streamMatches = !form.stream || learner.stream === form.stream;
    return gradeMatches && streamMatches;
  });

  if (!isSchoolAdmin()) {
    return <MDBox p={3}>Access denied. School Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3}>
          <DashboardIdentity
            user={user}
            title="Course Allocation"
            subtitle="Allocate connected courses to individual learners, grades, or classes."
          />
        </MDBox>

        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" mb={2}>
                  Single Learner
                </MDTypography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Grade"
                      fullWidth
                      value={form.grade}
                      onChange={(event) =>
                        setForm({ ...form, grade: event.target.value, learner_id: "" })
                      }
                      SelectProps={{ native: true }}
                    >
                      <option value="">All grades</option>
                      {grades.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Class / Stream"
                      fullWidth
                      value={form.stream}
                      onChange={(event) =>
                        setForm({ ...form, stream: event.target.value, learner_id: "" })
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
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Learner"
                      fullWidth
                      value={form.learner_id}
                      onChange={(event) => setForm({ ...form, learner_id: event.target.value })}
                      SelectProps={{ native: true }}
                    >
                      <option value="" />
                      {learnerOptions.map((learner) => (
                        <option value={learner.id} key={learner.id}>
                          {learner.full_name} - {learner.grade || "No grade"}{" "}
                          {learner.stream ? `(${learner.stream})` : ""}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Course"
                      fullWidth
                      value={form.course_id}
                      onChange={(event) => setForm({ ...form, course_id: event.target.value })}
                      SelectProps={{ native: true }}
                    >
                      <option value="" />
                      {courses.map((course) => (
                        <option value={course.id} key={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={6}>
                    <MDInput
                      select
                      label="Term"
                      fullWidth
                      value={form.term}
                      onChange={(event) => setForm({ ...form, term: event.target.value })}
                      SelectProps={{ native: true }}
                    >
                      {terms.map((term) => (
                        <option key={term} value={term}>
                          {term}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={6}>
                    <MDInput
                      select
                      label="Academic Year"
                      fullWidth
                      value={form.academic_year}
                      onChange={(event) => setForm({ ...form, academic_year: event.target.value })}
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
                <MDBox mt={3}>
                  <MDButton
                    variant="gradient"
                    color="info"
                    fullWidth
                    disabled={saving || !form.learner_id || !form.course_id}
                    onClick={createAllocation}
                  >
                    Allocate Learner
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" mb={2}>
                  Bulk Allocation
                </MDTypography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <MDInput
                      select
                      label="Grade"
                      fullWidth
                      value={bulkForm.grade}
                      onChange={(event) => setBulkForm({ ...bulkForm, grade: event.target.value })}
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
                  <Grid item xs={6}>
                    <MDInput
                      select
                      label="Class / Stream"
                      fullWidth
                      value={bulkForm.stream}
                      onChange={(event) => setBulkForm({ ...bulkForm, stream: event.target.value })}
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
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Course"
                      fullWidth
                      value={bulkForm.course_id}
                      onChange={(event) =>
                        setBulkForm({ ...bulkForm, course_id: event.target.value })
                      }
                      SelectProps={{ native: true }}
                    >
                      <option value="" />
                      {courses.map((course) => (
                        <option value={course.id} key={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={6}>
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
                  <Grid item xs={6}>
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
                </Grid>
                <MDBox mt={3}>
                  <MDButton
                    variant="gradient"
                    color="success"
                    fullWidth
                    disabled={saving || !bulkForm.grade || !bulkForm.course_id}
                    onClick={bulkAllocate}
                  >
                    Allocate Grade / Class
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" mb={2}>
                  Current Allocations
                </MDTypography>
                {error && (
                  <MDTypography variant="caption" color="error" display="block" mb={2}>
                    {error}
                  </MDTypography>
                )}
                {message && (
                  <MDTypography variant="caption" color="success" display="block" mb={2}>
                    {message}
                  </MDTypography>
                )}
                {loading ? (
                  <MDTypography variant="body2">Loading allocations...</MDTypography>
                ) : allocations.length === 0 ? (
                  <MDTypography variant="body2" color="text">
                    No allocations yet.
                  </MDTypography>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead sx={{ display: "table-header-group" }}>
                        <TableRow>
                          <TableCell>Learner</TableCell>
                          <TableCell>Grade</TableCell>
                          <TableCell>Course</TableCell>
                          <TableCell>Term</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="center">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {allocations.map((allocation) => (
                          <TableRow key={allocation.id}>
                            <TableCell>{allocation.learner_name}</TableCell>
                            <TableCell>{allocation.grade || "-"}</TableCell>
                            <TableCell>{allocation.course_name}</TableCell>
                            <TableCell>{allocation.term || "-"}</TableCell>
                            <TableCell>
                              <Chip label={allocation.status} color="info" size="small" />
                            </TableCell>
                            <TableCell align="center">
                              <MDButton
                                variant="text"
                                color="error"
                                size="small"
                                disabled={saving}
                                onClick={() => deallocate(allocation)}
                              >
                                Deallocate
                              </MDButton>
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
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default SchoolAdminAllocations;
