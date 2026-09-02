import { useEffect, useMemo, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tooltip from "@mui/material/Tooltip";

import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDProgress from "components/MDProgress";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

const ROWS_PER_PAGE_OPTIONS = [8, 16, 32];

function performanceColor(score) {
  if (Number(score) <= 50) return "warning";
  if (Number(score) <= 80) return "info";
  return "success";
}

// A module with nothing attempted scores 0, which is indistinguishable from a
// genuinely poor score in the band alone. Report those separately so a teacher
// can tell "not begun" from "begun and struggling".
function moduleBand(module) {
  if (!module || !module.total_activities) {
    return { label: "Not Started", full: "Not started", color: "default" };
  }

  const started = module.completed_activities > 0 || Number(module.score_percent) > 0;
  if (!started) {
    return { label: "Not Started", full: "Not started", color: "default" };
  }

  const full = module.grade_label || "";
  return {
    label: full.split(" ")[0] || "-",
    full,
    color: performanceColor(module.score_percent),
  };
}

function matchesPerformanceBand(score, band) {
  if (!band) return true;
  const value = Number(score || 0);
  if (band === "approaching") return value <= 50;
  if (band === "meets") return value > 50 && value <= 80;
  if (band === "exceeding") return value > 80;
  return true;
}

function initials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
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
  const [performance, setPerformance] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [orderBy, setOrderBy] = useState("full_name");
  const [order, setOrder] = useState("asc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const modules = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      row.modules?.forEach((module) => map.set(module.module_number, module.name));
    });
    return [...map.entries()].sort(([left], [right]) => left - right);
  }, [rows]);

  const grades = useMemo(
    () =>
      [...new Set(rows.map((row) => row.grade).filter(Boolean))].sort(
        (left, right) =>
          (parseInt(String(left).replace(/\D/g, ""), 10) || 0) -
          (parseInt(String(right).replace(/\D/g, ""), 10) || 0)
      ),
    [rows]
  );
  const streams = useMemo(
    () => [...new Set(rows.map((row) => row.stream).filter(Boolean))].sort(),
    [rows]
  );

  // Search and band are applied here rather than server-side: the cohort is
  // already loaded, so filtering locally avoids a round trip per keystroke.
  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = rows.filter(
      (row) =>
        (!needle ||
          String(row.full_name || "")
            .toLowerCase()
            .includes(needle)) &&
        matchesPerformanceBand(row.score_percent, performance)
    );

    const direction = order === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) => {
      if (orderBy === "score_percent" || orderBy === "completion_percent") {
        return (Number(left[orderBy]) - Number(right[orderBy])) * direction;
      }
      return String(left[orderBy] || "").localeCompare(String(right[orderBy] || "")) * direction;
    });
  }, [rows, search, performance, order, orderBy]);

  const pagedRows = useMemo(
    () => visibleRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [visibleRows, page, rowsPerPage]
  );

  useEffect(() => {
    setPage(0);
  }, [search, performance, grade, stream, courseId, term, academicYear]);

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
      setRows(await apiClient.get(`/leaderboard/school-course-progress?${params.toString()}`));
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [courseId, term, academicYear, grade, stream]);

  useEffect(() => {
    if (!courseId) return undefined;

    const interval = setInterval(() => {
      fetchProgress({ silent: true });
      // Full-cohort refresh: cheap now, but still a whole-class rebuild per
      // open tab, so it runs every two minutes rather than every thirty seconds.
    }, 120000);

    return () => clearInterval(interval);
  }, [courseId, term, academicYear, grade, stream]);

  const resetFilters = () => {
    setSearch("");
    setGrade("");
    setStream("");
    setPerformance("");
  };

  const sortHandler = (field) => () => {
    if (orderBy === field) {
      setOrder(order === "asc" ? "desc" : "asc");
      return;
    }
    setOrderBy(field);
    setOrder("asc");
  };

  const exportCsv = () => {
    const header = [
      "Learner",
      "Class",
      "Stream",
      "Course",
      ...modules.flatMap(([number, name]) => [`Mod ${number} - ${name}`, `Mod ${number} Band`]),
      "Overall Completion",
      "Overall Mark",
      "Overall Rubric",
    ];
    const body = visibleRows.map((row) => {
      const byNumber = new Map((row.modules || []).map((module) => [module.module_number, module]));
      return [
        row.full_name,
        row.grade,
        row.stream,
        row.course_name,
        ...modules.flatMap(([number]) => {
          const module = byNumber.get(number);
          const band = moduleBand(module);
          return [module ? `${module.score_percent}%` : "-", band.full || band.label];
        }),
        `${row.completion_percent}%`,
        `${row.score_percent}%`,
        row.grade_label,
      ];
    });
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
      <DashboardNavbar
        title="Learner Progress"
        subtitle="Every learner against every module, with per-module performance bands."
      />
      <MDBox py={2}>
        <Card>
          <MDBox p={2}>
            {/* Every control on one wrapping toolbar row: small fields, icon
                actions, so the matrix itself gets the vertical space. */}
            <MDBox display="flex" alignItems="center" gap={1} flexWrap="wrap">
              <MDInput
                size="small"
                label="Search students"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                sx={{ width: { xs: "100%", sm: 170 } }}
              />
              <MDInput
                size="small"
                select
                label="Course"
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                InputLabelProps={{ shrink: true }}
                SelectProps={{ native: true }}
                sx={{ width: { xs: "100%", sm: 170 } }}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </MDInput>
              <MDInput
                size="small"
                select
                label="Term"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                InputLabelProps={{ shrink: true }}
                SelectProps={{ native: true }}
                sx={{ width: { xs: "100%", sm: 110 } }}
              >
                {terms.length === 0 && <option value="">No terms configured</option>}
                {terms.map((termItem) => (
                  <option key={termItem.id} value={termItem.name}>
                    {termItem.name}
                  </option>
                ))}
              </MDInput>
              <MDInput
                size="small"
                select
                label="Year"
                value={academicYear}
                onChange={(event) => setAcademicYear(Number(event.target.value))}
                InputLabelProps={{ shrink: true }}
                SelectProps={{ native: true }}
                sx={{ width: { xs: "100%", sm: 90 } }}
              >
                {[...new Set(terms.map((item) => item.academic_year).filter(Boolean))].map(
                  (year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  )
                )}
              </MDInput>
              <MDInput
                size="small"
                select
                label="Class"
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
                InputLabelProps={{ shrink: true }}
                SelectProps={{ native: true }}
                sx={{ width: { xs: "100%", sm: 110 } }}
              >
                <option value="">All</option>
                {grades.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </MDInput>
              <MDInput
                size="small"
                select
                label="Stream"
                value={stream}
                onChange={(event) => setStream(event.target.value)}
                InputLabelProps={{ shrink: true }}
                SelectProps={{ native: true }}
                sx={{ width: { xs: "100%", sm: 110 } }}
              >
                <option value="">All</option>
                {streams.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </MDInput>
              <MDInput
                size="small"
                select
                label="Performance"
                value={performance}
                onChange={(event) => setPerformance(event.target.value)}
                InputLabelProps={{ shrink: true }}
                SelectProps={{ native: true }}
                sx={{ width: { xs: "100%", sm: 140 } }}
              >
                <option value="">All</option>
                <option value="approaching">0-50 Approaching</option>
                <option value="meets">51-80 Meeting</option>
                <option value="exceeding">81-100 Exceeding</option>
              </MDInput>
              <MDBox flexGrow={1} />
              <Tooltip title="Reset filters">
                <IconButton size="small" color="secondary" onClick={resetFilters}>
                  <Icon fontSize="small">restart_alt</Icon>
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh">
                <IconButton size="small" color="info" onClick={() => fetchProgress()}>
                  <Icon fontSize="small">refresh</Icon>
                </IconButton>
              </Tooltip>
              <Tooltip title="Export CSV">
                <IconButton size="small" color="info" onClick={exportCsv}>
                  <Icon fontSize="small">download</Icon>
                </IconButton>
              </Tooltip>
            </MDBox>

            {error && (
              <MDBox mt={2}>
                <MDTypography variant="button" color="error">
                  {error}
                </MDTypography>
              </MDBox>
            )}
          </MDBox>

          <TableContainer sx={{ boxShadow: "none" }}>
            <Table size="small">
              <TableHead sx={{ display: "table-header-group" }}>
                <TableRow>
                  <TableCell sortDirection={orderBy === "full_name" ? order : false}>
                    <TableSortLabel
                      active={orderBy === "full_name"}
                      direction={orderBy === "full_name" ? order : "asc"}
                      onClick={sortHandler("full_name")}
                    >
                      Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={orderBy === "grade" ? order : false}>
                    <TableSortLabel
                      active={orderBy === "grade"}
                      direction={orderBy === "grade" ? order : "asc"}
                      onClick={sortHandler("grade")}
                    >
                      Class
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={orderBy === "stream" ? order : false}>
                    <TableSortLabel
                      active={orderBy === "stream"}
                      direction={orderBy === "stream" ? order : "asc"}
                      onClick={sortHandler("stream")}
                    >
                      Stream
                    </TableSortLabel>
                  </TableCell>
                  {modules.map(([number, name]) => (
                    <TableCell key={number} align="center">
                      <Tooltip title={name || `Module ${number}`}>
                        <span>Mod {number}</span>
                      </Tooltip>
                    </TableCell>
                  ))}
                  <TableCell sortDirection={orderBy === "score_percent" ? order : false}>
                    <TableSortLabel
                      active={orderBy === "score_percent"}
                      direction={orderBy === "score_percent" ? order : "asc"}
                      onClick={sortHandler("score_percent")}
                    >
                      Overall Progress
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedRows.map((row) => {
                  const byNumber = new Map(
                    (row.modules || []).map((module) => [module.module_number, module])
                  );

                  return (
                    <TableRow key={row.learner_id} hover>
                      <TableCell>
                        <MDBox display="flex" alignItems="center" gap={1}>
                          <Avatar sx={{ width: 26, height: 26, fontSize: "0.7rem" }}>
                            {initials(row.full_name)}
                          </Avatar>
                          <MDTypography variant="button" fontWeight="medium">
                            {row.full_name}
                          </MDTypography>
                        </MDBox>
                      </TableCell>
                      <TableCell>
                        <Chip label={row.grade || "-"} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip label={row.stream || "-"} size="small" />
                      </TableCell>
                      {modules.map(([number]) => {
                        const module = byNumber.get(number);
                        const band = moduleBand(module);
                        return (
                          <TableCell key={number} align="center" sx={{ minWidth: 110 }}>
                            <Tooltip title={band.full || band.label}>
                              <Chip
                                label={band.label}
                                size="small"
                                color={band.color}
                                variant={band.color === "default" ? "outlined" : "filled"}
                              />
                            </Tooltip>
                            <MDBox mt={0.5}>
                              <MDProgress
                                value={Number(module?.score_percent || 0)}
                                color={
                                  module ? performanceColor(module.score_percent) : "secondary"
                                }
                                variant="gradient"
                                sx={{ height: 4 }}
                              />
                              <MDTypography
                                variant="caption"
                                color="text"
                                sx={{ fontSize: "0.65rem" }}
                              >
                                {module ? `${module.score_percent}%` : "-"}
                              </MDTypography>
                            </MDBox>
                          </TableCell>
                        );
                      })}
                      <TableCell sx={{ minWidth: 140 }}>
                        <MDTypography variant="button" fontWeight="medium">
                          {row.score_percent}%
                        </MDTypography>
                        <MDProgress
                          value={Number(row.score_percent || 0)}
                          color={performanceColor(row.score_percent)}
                          variant="gradient"
                          sx={{ height: 4 }}
                        />
                        <MDTypography variant="caption" color="text" sx={{ fontSize: "0.65rem" }}>
                          {row.completed_modules}/{row.total_modules} modules complete
                        </MDTypography>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!pagedRows.length && (
                  <TableRow>
                    <TableCell colSpan={modules.length + 4} align="center">
                      <MDBox py={3}>
                        <MDTypography variant="button" color="text">
                          {loading
                            ? "Loading learner progress..."
                            : "No learners match these filters."}
                        </MDTypography>
                      </MDBox>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={visibleRows.length}
            page={page}
            onPageChange={(event, nextPage) => setPage(nextPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            labelRowsPerPage="Students per page"
          />
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default SchoolAdminProgress;
