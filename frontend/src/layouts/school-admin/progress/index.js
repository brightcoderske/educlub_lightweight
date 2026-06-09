import { Fragment, useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import DashboardIdentity from "components/DashboardIdentity";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDProgress from "components/MDProgress";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

function performanceColor(score) {
  if (Number(score) <= 50) return "warning";
  if (Number(score) <= 80) return "info";
  return "success";
}

function completionLabel(activity) {
  if (activity.completed === true) return "Yes";
  if (activity.completed === false) return "No";
  return activity.completion_enabled ? "Pending sync" : "Not tracked";
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function SchoolAdminProgress() {
  const { user, isSchoolAdmin } = useAuth();
  const [courses, setCourses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [term, setTerm] = useState("Term 1");
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [grade, setGrade] = useState("");
  const [stream, setStream] = useState("");
  const [moduleNumber, setModuleNumber] = useState("all");
  const [performance, setPerformance] = useState("");
  const [rows, setRows] = useState([]);
  const [expandedRow, setExpandedRow] = useState("");
  const [selectedModules, setSelectedModules] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const modules = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      row.modules?.forEach((module) => map.set(module.module_number, module.name));
    });
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [rows]);

  const grades = useMemo(
    () => [...new Set(rows.map((row) => row.grade).filter(Boolean))].sort(),
    [rows]
  );
  const streams = useMemo(
    () => [...new Set(rows.map((row) => row.stream).filter(Boolean))].sort(),
    [rows]
  );

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [courseRes, termsRes, currentTerm] = await Promise.all([
          apiClient.get("/courses"),
          apiClient.get("/academic/terms").catch(() => []),
          apiClient.get("/academic/terms/current").catch(() => null),
        ]);
        const activeCourses = Array.isArray(courseRes)
          ? courseRes.filter((course) => course.is_active)
          : [];
        setCourses(activeCourses);
        setTerms(Array.isArray(termsRes) ? termsRes : []);
        if (activeCourses[0]) setCourseId(String(activeCourses[0].id));
        if (currentTerm?.name) {
          setTerm(currentTerm.name);
          setAcademicYear(
            currentTerm.academic_year || new Date(currentTerm.start_date).getFullYear()
          );
        }
      } catch (err) {
        setError(err.message);
      }
    };

    if (isSchoolAdmin()) loadOptions();
  }, []);

  const fetchProgress = async ({ silent = false } = {}) => {
    if (!courseId) return;

    if (!silent) setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        courseId,
        term,
        academicYear: String(academicYear),
      });
      if (grade) params.set("grade", grade);
      if (stream) params.set("stream", stream);
      if (moduleNumber) params.set("moduleNumber", moduleNumber);
      if (performance) params.set("performance", performance);
      setRows(await apiClient.get(`/leaderboard/school-course-progress?${params.toString()}`));
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [courseId, term, academicYear, grade, stream, moduleNumber, performance]);

  useEffect(() => {
    if (!courseId) return undefined;

    const interval = setInterval(() => {
      fetchProgress({ silent: true });
    }, 30000);

    return () => clearInterval(interval);
  }, [courseId, term, academicYear, grade, stream, moduleNumber, performance]);

  const exportCsv = () => {
    const header = [
      "Learner",
      "Grade",
      "Stream",
      "Course",
      "Course Completion",
      "Course Mark",
      "Course Rubric",
      "Module",
      "Module Completion",
      "Module Mark",
      "Module Rubric",
    ];
    const body = rows.map((row) => [
      row.full_name,
      row.grade,
      row.stream,
      row.course_name,
      `${row.completion_percent}%`,
      `${row.score_percent}%`,
      row.grade_label,
      row.selected_module?.name || "-",
      row.selected_module ? `${row.selected_module.progress_percent}%` : "-",
      row.selected_module?.score_percent ?? "-",
      row.selected_module?.grade_label || "-",
    ]);
    const csv = [header, ...body].map((line) => line.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `learner-progress-${courseId}-${academicYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isSchoolAdmin()) {
    return <MDBox>Access denied. School Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3}>
          <DashboardIdentity
            user={user}
            title="Learner Progress"
            subtitle="Track learner course progress by class, stream, module, and performance band."
          />
        </MDBox>

        <Card>
          <MDBox p={3}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <MDInput
                  select
                  label="Course"
                  fullWidth
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  SelectProps={{ native: true }}
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </MDInput>
              </Grid>
              <Grid item xs={12} md={2}>
                <MDInput
                  select
                  label="Term"
                  fullWidth
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  SelectProps={{ native: true }}
                >
                  <option value={term}>{term}</option>
                  {terms.map((termItem) => (
                    <option key={termItem.id} value={termItem.name}>
                      {termItem.name}
                    </option>
                  ))}
                </MDInput>
              </Grid>
              <Grid item xs={12} md={2}>
                <MDInput
                  select
                  label="Year"
                  fullWidth
                  value={academicYear}
                  onChange={(e) => setAcademicYear(Number(e.target.value))}
                  SelectProps={{ native: true }}
                >
                  <option value={academicYear}>{academicYear}</option>
                  {[...new Set(terms.map((item) => item.academic_year).filter(Boolean))].map(
                    (year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    )
                  )}
                </MDInput>
              </Grid>
              <Grid item xs={12} md={2}>
                <MDInput
                  select
                  label="Class"
                  fullWidth
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  SelectProps={{ native: true }}
                >
                  <option value="">All</option>
                  {grades.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </MDInput>
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput
                  select
                  label="Stream"
                  fullWidth
                  value={stream}
                  onChange={(e) => setStream(e.target.value)}
                  SelectProps={{ native: true }}
                >
                  <option value="">All</option>
                  {streams.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </MDInput>
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput
                  select
                  label="Module"
                  fullWidth
                  value={moduleNumber}
                  onChange={(e) => setModuleNumber(e.target.value)}
                  SelectProps={{ native: true }}
                >
                  <option value="all">Active/First module</option>
                  {modules.map(([number, name]) => (
                    <option key={number} value={number}>
                      {number}. {name}
                    </option>
                  ))}
                </MDInput>
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput
                  select
                  label="Performance"
                  fullWidth
                  value={performance}
                  onChange={(e) => setPerformance(e.target.value)}
                  SelectProps={{ native: true }}
                >
                  <option value="">All</option>
                  <option value="approaching">0-50 Approaching</option>
                  <option value="meets">51-80 Meets</option>
                  <option value="exceeding">81-100 Exceeding</option>
                </MDInput>
              </Grid>
              <Grid item xs={12} md={6}>
                <MDBox display="flex" justifyContent="flex-end" gap={1}>
                  <MDButton variant="outlined" color="info" onClick={fetchProgress}>
                    Refresh
                  </MDButton>
                  <MDButton
                    variant="gradient"
                    color="success"
                    onClick={exportCsv}
                    disabled={rows.length === 0}
                  >
                    Export CSV
                  </MDButton>
                </MDBox>
              </Grid>
            </Grid>
          </MDBox>
        </Card>

        <Card sx={{ mt: 3 }}>
          <MDBox p={3}>
            {error && (
              <MDTypography variant="caption" color="error" display="block" mb={2}>
                {error}
              </MDTypography>
            )}
            {loading ? (
              <MDTypography variant="body2">Loading learner progress...</MDTypography>
            ) : rows.length === 0 ? (
              <MDTypography variant="body2" color="text">
                No learner progress found for the selected filters.
              </MDTypography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      <TableCell>Learner</TableCell>
                      <TableCell>Class</TableCell>
                      <TableCell>Course</TableCell>
                      <TableCell>Course Progress</TableCell>
                      <TableCell>Module</TableCell>
                      <TableCell>Module Mark</TableCell>
                      <TableCell>Rubric</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => {
                      const rowKey = `${row.learner_id}-${row.course_id}`;
                      const selectedModuleNumber =
                        selectedModules[rowKey] ||
                        row.selected_module?.module_number ||
                        row.modules?.[0]?.module_number ||
                        "";
                      const selectedModule =
                        row.modules?.find(
                          (item) => Number(item.module_number) === Number(selectedModuleNumber)
                        ) ||
                        row.selected_module ||
                        null;
                      const moduleScore = selectedModule?.score_percent ?? row.score_percent;
                      return (
                        <Fragment key={rowKey}>
                          <TableRow hover>
                            <TableCell>{row.full_name}</TableCell>
                            <TableCell>
                              {row.grade} {row.stream || ""}
                            </TableCell>
                            <TableCell>{row.course_name}</TableCell>
                            <TableCell sx={{ minWidth: 180 }}>
                              <MDTypography variant="caption" color="text">
                                {row.completion_percent}% complete
                              </MDTypography>
                              <MDProgress
                                variant="gradient"
                                color={performanceColor(row.completion_percent)}
                                value={row.completion_percent}
                              />
                            </TableCell>
                            <TableCell>
                              {row.modules?.length ? (
                                <MDBox display="flex" gap={1} alignItems="center">
                                  <MDInput
                                    select
                                    fullWidth
                                    value={selectedModuleNumber}
                                    onChange={(event) => {
                                      setSelectedModules((current) => ({
                                        ...current,
                                        [rowKey]: event.target.value,
                                      }));
                                      setExpandedRow(rowKey);
                                    }}
                                    SelectProps={{ native: true }}
                                  >
                                    {row.modules.map((module) => (
                                      <option
                                        key={`${rowKey}-${module.module_number}`}
                                        value={module.module_number}
                                      >
                                        {module.module_number}. {module.name}
                                      </option>
                                    ))}
                                  </MDInput>
                                  <MDButton
                                    variant="text"
                                    color="info"
                                    size="small"
                                    onClick={() =>
                                      setExpandedRow(expandedRow === rowKey ? "" : rowKey)
                                    }
                                  >
                                    {expandedRow === rowKey ? "Hide" : "View"}
                                  </MDButton>
                                </MDBox>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>{moduleScore ?? "-"}%</TableCell>
                            <TableCell>
                              <Chip
                                label={selectedModule?.grade_label || row.grade_label}
                                color={performanceColor(moduleScore)}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                          {expandedRow === rowKey && (
                            <TableRow key={`${rowKey}-activities`}>
                              <TableCell colSpan={7}>
                                <MDTypography variant="caption" color="text" fontWeight="bold">
                                  Activity performance
                                </MDTypography>
                                <TableContainer sx={{ mt: 1 }}>
                                  <Table size="small">
                                    <TableHead sx={{ display: "table-header-group" }}>
                                      <TableRow>
                                        <TableCell>Activity</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Completed</TableCell>
                                        <TableCell>Mark</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {(selectedModule?.activities || []).map((activity) => (
                                        <TableRow key={activity.id || activity.name}>
                                          <TableCell>{activity.name}</TableCell>
                                          <TableCell>{activity.type || "-"}</TableCell>
                                          <TableCell>{completionLabel(activity)}</TableCell>
                                          <TableCell>{activity.score_percent ?? "-"}%</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default SchoolAdminProgress;
