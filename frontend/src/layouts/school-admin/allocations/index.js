import { Fragment, useEffect, useMemo, useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Autocomplete from "@mui/material/Autocomplete";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import NotInTermNotice from "components/NotInTermNotice";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import { getCachedPage, setCachedPage } from "lib/pageCache";

const learnerLabel = (learner) =>
  `${learner.full_name} - ${learner.grade || "No grade"}${
    learner.stream ? ` (${learner.stream})` : ""
  }`;

const periodKey = (academicYear, term) => `${academicYear || ""}|${term || ""}`;

function SchoolAdminAllocations() {
  const { user, isSchoolAdmin, isTeacher } = useAuth();
  const [learners, setLearners] = useState([]);
  const [courses, setCourses] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [school, setSchool] = useState(null);
  const [currentTerm, setCurrentTerm] = useState(null);
  const [allocationSearch, setAllocationSearch] = useState("");
  // "current" follows the active term once it has loaded; earlier terms are
  // one choice away instead of mixed into the list.
  const [periodFilter, setPeriodFilter] = useState("current");
  const [expandedGroup, setExpandedGroup] = useState("");
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
  const [notInTerm, setNotInTerm] = useState([]);
  const cacheKey = `school-admin:${user?.schoolId}:allocations`;

  const activeTermName = currentTerm?.name || "Term 1";
  const activeAcademicYear =
    currentTerm?.academic_year || new Date(currentTerm?.start_date || Date.now()).getFullYear();

  const applyActiveTerm = (term) => {
    if (!term?.name) return;
    const year = term.academic_year || new Date(term.start_date || Date.now()).getFullYear();
    setForm((current) => ({ ...current, term: term.name, academic_year: year }));
    setBulkForm((current) => ({ ...current, term: term.name, academic_year: year }));
  };

  const loadData = async (background = false) => {
    const cached = getCachedPage(cacheKey)?.value;
    if (cached && !background) {
      setLearners(cached.learners || []);
      setCourses(cached.courses || []);
      setAllocations(cached.allocations || []);
      setSchool(cached.school || null);
      setCurrentTerm(cached.currentTerm || null);
      applyActiveTerm(cached.currentTerm);
    }
    setLoading(!cached && !background);
    setError("");
    try {
      const [learnersRes, coursesRes, allocationsRes, currentTermRes] = await Promise.all([
        apiClient
          .get(
            `/learners?school_id=${user?.schoolId}${
              user?.role === "teacher" ? "&scope=allocation_picker" : ""
            }`
          )
          .catch((err) => {
            throw new Error(`Learners: ${err.message}`);
          }),
        apiClient.get("/courses?category=standard").catch((err) => {
          throw new Error(`Courses: ${err.message}`);
        }),
        apiClient.get(`/allocations?school_id=${user?.schoolId}`).catch((err) => {
          throw new Error(`Allocations: ${err.message}`);
        }),
        apiClient.get("/academic/terms/current").catch(() => null),
      ]);
      const schoolRes = user?.schoolId
        ? await apiClient.get(`/schools/${user.schoolId}`).catch(() => null)
        : null;
      setLearners(learnersRes);
      setCourses(coursesRes);
      setAllocations(allocationsRes);
      setSchool(schoolRes);
      setCurrentTerm(currentTermRes);
      applyActiveTerm(currentTermRes);
      setCachedPage(cacheKey, {
        learners: learnersRes,
        courses: coursesRes,
        allocations: allocationsRes,
        school: schoolRes,
        currentTerm: currentTermRes,
      });
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
      await apiClient.post("/allocations", {
        ...form,
        term: activeTermName,
        academic_year: activeAcademicYear,
      });
      setMessage("Learner allocated to the course.");
      await loadData(true);
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
      const result = await apiClient.post("/allocations/bulk", {
        ...bulkForm,
        term: activeTermName,
        academic_year: activeAcademicYear,
      });
      setMessage(result.message);
      setNotInTerm(result.notInTerm || []);
      await loadData(true);
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
      setAllocations((current) => current.filter((item) => item.id !== allocation.id));
      setMessage("Allocation removed.");
      loadData(true);
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
  const periods = useMemo(() => {
    const seen = new Map();
    allocations.forEach((allocation) => {
      const key = periodKey(allocation.academic_year, allocation.term);
      if (!seen.has(key)) {
        seen.set(key, {
          key,
          label: `${allocation.term || "No term"} ${allocation.academic_year || ""}`.trim(),
          academic_year: Number(allocation.academic_year) || 0,
          term: allocation.term || "",
        });
      }
    });
    return [...seen.values()].sort(
      (a, b) => b.academic_year - a.academic_year || b.term.localeCompare(a.term)
    );
  }, [allocations]);
  // Between terms there is no active term, so the default falls back to the
  // latest term that has allocations rather than to every term at once.
  const latestPeriod = periods.find((period) => period.academic_year) || periods[0];
  const currentPeriod = currentTerm?.name
    ? periodKey(activeAcademicYear, activeTermName)
    : latestPeriod?.key || "";
  const currentPeriodLabel = currentTerm?.name
    ? `This term (${activeTermName} ${activeAcademicYear})`
    : `Latest term (${latestPeriod?.label || ""})`;
  const selectedPeriod = periodFilter === "current" ? currentPeriod : periodFilter;

  const groupedAllocations = useMemo(() => {
    const groups = new Map();
    allocations
      .filter(
        (allocation) =>
          !selectedPeriod || periodKey(allocation.academic_year, allocation.term) === selectedPeriod
      )
      .forEach((allocation) => {
        const key = [
          allocation.course_id,
          allocation.academic_year || "",
          allocation.term || "",
        ].join("|");
        const current = groups.get(key) || {
          key,
          course_id: allocation.course_id,
          course_name: allocation.course_name,
          term: allocation.term,
          academic_year: allocation.academic_year,
          learners: [],
          active: 0,
          completed: 0,
        };
        current.learners.push(allocation);
        if (allocation.status === "completed") current.completed += 1;
        if (allocation.status !== "completed") current.active += 1;
        groups.set(key, current);
      });
    const search = allocationSearch.trim().toLowerCase();
    return [...groups.values()]
      .filter((group) => {
        if (!search) return true;
        return `${group.course_name} ${group.term} ${group.academic_year}`
          .toLowerCase()
          .includes(search);
      })
      .sort((a, b) =>
        `${a.course_name} ${a.academic_year} ${a.term}`.localeCompare(
          `${b.course_name} ${b.academic_year} ${b.term}`
        )
      );
  }, [allocationSearch, allocations, selectedPeriod]);

  const learnerOptions = learners.filter((learner) => {
    const gradeMatches = !form.grade || learner.grade === form.grade;
    const streamMatches = !form.stream || learner.stream === form.stream;
    return gradeMatches && streamMatches;
  });

  if (!isSchoolAdmin()) {
    return <MDBox p={2}>Access denied. School Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="Course Allocation"
        subtitle="Allocate connected courses to individual learners, grades, or classes."
      />
      <MDBox py={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Card>
              <MDBox p={2}>
                <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
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
                    <Autocomplete
                      options={learnerOptions}
                      getOptionLabel={learnerLabel}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      value={
                        learnerOptions.find(
                          (learner) => String(learner.id) === String(form.learner_id)
                        ) || null
                      }
                      onChange={(_, learner) =>
                        setForm({ ...form, learner_id: learner ? learner.id : "" })
                      }
                      noOptionsText="No learner matches that name"
                      renderInput={(params) => (
                        <MDInput
                          {...params}
                          label="Learner"
                          placeholder="Type a name to search"
                          InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
                        />
                      )}
                    />
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
                      <option value="">Choose a course</option>
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
                      disabled
                      SelectProps={{ native: true }}
                    >
                      <option value={activeTermName}>{activeTermName}</option>
                    </MDInput>
                  </Grid>
                  <Grid item xs={6}>
                    <MDInput
                      select
                      label="Academic Year"
                      fullWidth
                      value={form.academic_year}
                      disabled
                      SelectProps={{ native: true }}
                    >
                      <option value={activeAcademicYear}>{activeAcademicYear}</option>
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
              <MDBox p={2}>
                <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
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
                      <option value="">Choose a grade</option>
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
                      <option value="">Choose a course</option>
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
                      disabled
                      SelectProps={{ native: true }}
                    >
                      <option value={activeTermName}>{activeTermName}</option>
                    </MDInput>
                  </Grid>
                  <Grid item xs={6}>
                    <MDInput
                      select
                      label="Academic Year"
                      fullWidth
                      value={bulkForm.academic_year}
                      disabled
                      SelectProps={{ native: true }}
                    >
                      <option value={activeAcademicYear}>{activeAcademicYear}</option>
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
                <NotInTermNotice
                  learners={notInTerm}
                  term={activeTermName}
                  academicYear={activeAcademicYear}
                  canPromote={!isTeacher()}
                  onPromoted={bulkAllocate}
                />
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <MDBox p={2}>
                <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
                  Current Allocations
                </MDTypography>
                <Grid container spacing={2} mb={2}>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      select
                      label="Term"
                      fullWidth
                      value={periodFilter}
                      onChange={(event) => setPeriodFilter(event.target.value)}
                      SelectProps={{ native: true }}
                    >
                      {currentPeriod && <option value="current">{currentPeriodLabel}</option>}
                      <option value="">All terms</option>
                      {periods
                        .filter((period) => period.key !== currentPeriod)
                        .map((period) => (
                          <option key={period.key} value={period.key}>
                            {period.label}
                          </option>
                        ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <MDInput
                      label="Search course"
                      fullWidth
                      value={allocationSearch}
                      onChange={(event) => setAllocationSearch(event.target.value)}
                    />
                  </Grid>
                </Grid>
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
                ) : groupedAllocations.length === 0 ? (
                  <MDTypography variant="body2" color="text">
                    {selectedPeriod && allocations.length
                      ? "No allocations for this term. Choose All terms to see earlier ones."
                      : "No allocations yet."}
                  </MDTypography>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead sx={{ display: "table-header-group" }}>
                        <TableRow>
                          <TableCell>Course</TableCell>
                          <TableCell>Year</TableCell>
                          <TableCell>Term</TableCell>
                          <TableCell>Learners</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="center">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {groupedAllocations.map((group) => (
                          <Fragment key={group.key}>
                            <TableRow>
                              <TableCell>{group.course_name}</TableCell>
                              <TableCell>{group.academic_year || "-"}</TableCell>
                              <TableCell>{group.term || "-"}</TableCell>
                              <TableCell>{group.learners.length}</TableCell>
                              <TableCell>
                                <Chip
                                  label={`${group.active} active, ${group.completed} done`}
                                  color={group.active ? "info" : "success"}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="center">
                                <MDButton
                                  variant="text"
                                  color="info"
                                  size="small"
                                  onClick={() =>
                                    setExpandedGroup(expandedGroup === group.key ? "" : group.key)
                                  }
                                >
                                  {expandedGroup === group.key ? "Hide learners" : "View learners"}
                                </MDButton>
                              </TableCell>
                            </TableRow>
                            {expandedGroup === group.key &&
                              group.learners.map((allocation) => (
                                <TableRow key={allocation.id}>
                                  <TableCell sx={{ pl: 4 }}>
                                    {allocation.learner_name}
                                    <MDTypography variant="caption" color="text" display="block">
                                      {allocation.grade || "No grade"}{" "}
                                      {allocation.stream ? `(${allocation.stream})` : ""}
                                    </MDTypography>
                                  </TableCell>
                                  <TableCell>{allocation.academic_year || "-"}</TableCell>
                                  <TableCell>{allocation.term || "-"}</TableCell>
                                  <TableCell>1</TableCell>
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
                          </Fragment>
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
