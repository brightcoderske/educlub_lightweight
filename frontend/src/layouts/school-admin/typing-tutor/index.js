import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import { Tabs, Tab } from "@mui/material";
import PracticeReport from "./PracticeReport";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tooltip from "@mui/material/Tooltip";

import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

// Each metric lives on a different scale, so the colour bands cannot be shared:
// quiz and course marks are percentages, typing is words per minute.
const METRICS = {
  typing_score: {
    label: "Typing (WPM)",
    unit: "",
    bands: [
      [15, "warning"],
      [30, "info"],
      [Infinity, "success"],
    ],
    format: (value) => Number(value).toFixed(0),
  },
  quiz_score: {
    label: "Quiz (%)",
    unit: "%",
    bands: [
      [50, "warning"],
      [80, "info"],
      [Infinity, "success"],
    ],
    format: (value) => Number(value).toFixed(0),
  },
  active_course_score: {
    label: "Course (%)",
    unit: "%",
    bands: [
      [50, "warning"],
      [80, "info"],
      [Infinity, "success"],
    ],
    format: (value) => Number(value).toFixed(0),
  },
};

const METRIC_KEYS = Object.keys(METRICS);

// Short tags for the combined cell, where three values share one column.
const METRIC_TAGS = {
  typing_score: "T",
  quiz_score: "Q",
  active_course_score: "C",
};

function bandColor(metricKey, value) {
  const metric = METRICS[metricKey];
  const found = metric.bands.find(([ceiling]) => Number(value) <= ceiling);
  return found ? found[1] : "success";
}

function average(values) {
  const numbers = values.filter((value) => value !== null && value !== undefined);
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, value) => sum + Number(value), 0) / numbers.length;
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function TypingTutorReport() {
  const { user, isSchoolAdmin } = useAuth();
  const [reportView, setReportView] = useState("tutor");
  const [weeks, setWeeks] = useState([]);
  const [learners, setLearners] = useState([]);
  const [period, setPeriod] = useState({ term: null, academicYear: null });
  const [metricKey, setMetricKey] = useState("all");
  const [grade, setGrade] = useState("");
  const [stream, setStream] = useState("");
  const [search, setSearch] = useState("");
  const [orderBy, setOrderBy] = useState("full_name");
  const [order, setOrder] = useState("asc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canView = isSchoolAdmin() || user?.role === "teacher";
  // "all" stacks every metric in one cell; a single metric fills the cell alone
  // and then needs no letter tag to disambiguate it.
  const visibleMetrics = metricKey === "all" ? METRIC_KEYS : [metricKey];
  const showTags = metricKey === "all";

  const grades = useMemo(
    () =>
      [...new Set(learners.map((row) => row.grade).filter(Boolean))].sort(
        (left, right) =>
          (parseInt(String(left).replace(/\D/g, ""), 10) || 0) -
          (parseInt(String(right).replace(/\D/g, ""), 10) || 0)
      ),
    [learners]
  );
  const streams = useMemo(
    () => [...new Set(learners.map((row) => row.stream).filter(Boolean))].sort(),
    [learners]
  );

  // One fetch feeds the whole page, so filtering, sorting and the summary tiles
  // are all derived locally instead of costing another round trip.
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = learners.filter((row) => {
      if (grade && row.grade !== grade) return false;
      if (stream && row.stream !== stream) return false;
      if (
        needle &&
        !String(row.full_name || "")
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });

    // Averages for every metric, not just the visible one: the fetch already
    // carries all three, so switching the view costs no network call.
    const withAverages = filtered.map((row) => ({
      ...row,
      averages: Object.fromEntries(
        METRIC_KEYS.map((key) => [
          key,
          average(weeks.map((week) => row.weeks[week]?.[key] ?? null)),
        ])
      ),
    }));

    const sortMetric = metricKey === "all" ? "typing_score" : metricKey;
    const direction = order === "asc" ? 1 : -1;
    return withAverages.sort((left, right) => {
      if (orderBy === "average") {
        return ((left.averages[sortMetric] ?? -1) - (right.averages[sortMetric] ?? -1)) * direction;
      }
      return String(left[orderBy] || "").localeCompare(String(right[orderBy] || "")) * direction;
    });
  }, [learners, weeks, metricKey, grade, stream, search, order, orderBy]);

  const summary = useMemo(() => {
    const averageFor = (key) => {
      const scored = rows.map((row) => row.averages[key]).filter((value) => value !== null);
      return scored.length ? average(scored) : null;
    };
    return {
      learners: rows.length,
      withRecords: rows.filter((row) => METRIC_KEYS.some((key) => row.averages[key] !== null))
        .length,
      byMetric: Object.fromEntries(METRIC_KEYS.map((key) => [key, averageFor(key)])),
    };
  }, [rows]);

  const loadMatrix = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.get("/leaderboard/school-weekly-matrix");
      setWeeks(Array.isArray(data.weeks) ? data.weeks : []);
      setLearners(Array.isArray(data.learners) ? data.learners : []);
      setPeriod({ term: data.term, academicYear: data.academicYear });
    } catch (err) {
      setError(err.message || "Could not load the weekly matrix.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView && reportView === "weekly") loadMatrix();
  }, [canView, reportView]);

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
      ...weeks.flatMap((week) => visibleMetrics.map((key) => `Week ${week} ${METRICS[key].label}`)),
      ...visibleMetrics.map((key) => `Average ${METRICS[key].label}`),
    ];
    const body = rows.map((row) => [
      row.full_name,
      row.grade,
      row.stream,
      ...weeks.flatMap((week) =>
        visibleMetrics.map((key) => {
          const value = row.weeks[week]?.[key];
          return value === null || value === undefined ? "-" : METRICS[key].format(value);
        })
      ),
      ...visibleMetrics.map((key) =>
        row.averages[key] === null ? "-" : METRICS[key].format(row.averages[key])
      ),
    ]);
    const csv = [header, ...body].map((line) => line.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `weekly-${metricKey}-${period.term || "term"}-${period.academicYear || ""}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return <MDBox>Access denied. Staff only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="Typing Tutor Reports"
        subtitle="Tutor activity logs, learner progress, and weekly assessment marks."
      />
      <MDBox py={2}>
        <Tabs
          value={reportView}
          onChange={(_, value) => setReportView(value)}
          aria-label="Practice report views"
          sx={{ mb: 2 }}
        >
          <Tab
            value="tutor"
            label="Tutor practice"
            id="tutor-report-tab"
            aria-controls="tutor-report-panel"
          />
          <Tab
            value="weekly"
            label="Weekly marks"
            id="weekly-report-tab"
            aria-controls="weekly-report-panel"
          />
        </Tabs>
        {reportView === "tutor" ? (
          <MDBox role="tabpanel" id="tutor-report-panel" aria-labelledby="tutor-report-tab">
            <PracticeReport />
          </MDBox>
        ) : (
          <MDBox role="tabpanel" id="weekly-report-panel" aria-labelledby="weekly-report-tab">
            {error && (
              <MDTypography variant="caption" color="error" display="block" mb={2}>
                {error}
              </MDTypography>
            )}

            <Grid container spacing={1.5} mb={1.5}>
              {[
                ["Learners", summary.learners],
                ["With records", summary.withRecords],
                ...METRIC_KEYS.filter((key) => visibleMetrics.includes(key)).map((key) => [
                  `Avg ${METRICS[key].label}`,
                  summary.byMetric[key] === null
                    ? "-"
                    : `${METRICS[key].format(summary.byMetric[key])}${METRICS[key].unit}`,
                ]),
              ].map(([label, value]) => (
                <Grid item xs={6} md={3} key={label}>
                  <Card>
                    <MDBox px={2} py={1}>
                      <MDTypography variant="caption" color="text">
                        {label}
                      </MDTypography>
                      <MDTypography variant="h5">{value}</MDTypography>
                    </MDBox>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Card>
              <MDBox p={2}>
                <MDBox display="flex" alignItems="center" gap={1} flexWrap="wrap">
                  <MDInput
                    size="small"
                    label="Search students"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    sx={{ width: { xs: "100%", sm: 180 } }}
                  />
                  <MDInput
                    size="small"
                    select
                    label="Metric"
                    value={metricKey}
                    onChange={(event) => setMetricKey(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    SelectProps={{ native: true }}
                    sx={{ width: { xs: "100%", sm: 150 } }}
                  >
                    <option value="all">All combined</option>
                    {Object.entries(METRICS).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.label}
                      </option>
                    ))}
                  </MDInput>
                  <MDInput
                    size="small"
                    select
                    label="Class"
                    value={grade}
                    onChange={(event) => setGrade(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    SelectProps={{ native: true }}
                    sx={{ width: { xs: "100%", sm: 120 } }}
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
                    sx={{ width: { xs: "100%", sm: 120 } }}
                  >
                    <option value="">All</option>
                    {streams.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </MDInput>
                  <MDBox flexGrow={1} />
                  <Tooltip title="Refresh">
                    <IconButton size="small" color="info" onClick={loadMatrix}>
                      <Icon fontSize="small">refresh</Icon>
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Export CSV">
                    <IconButton size="small" color="info" onClick={exportCsv}>
                      <Icon fontSize="small">download</Icon>
                    </IconButton>
                  </Tooltip>
                </MDBox>
              </MDBox>

              <TableContainer sx={{ boxShadow: "none" }}>
                <Table size="small" sx={{ "& .MuiTableCell-root": { whiteSpace: "nowrap" } }}>
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
                      <TableCell>Class</TableCell>
                      <TableCell>Stream</TableCell>
                      {weeks.map((week) => (
                        <TableCell key={week} align="center">
                          W{week}
                        </TableCell>
                      ))}
                      <TableCell
                        align="center"
                        sortDirection={orderBy === "average" ? order : false}
                      >
                        <TableSortLabel
                          active={orderBy === "average"}
                          direction={orderBy === "average" ? order : "asc"}
                          onClick={sortHandler("average")}
                        >
                          Avg
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.learner_id} hover>
                        <TableCell>
                          <MDTypography
                            variant="button"
                            fontWeight="medium"
                            sx={{ fontSize: "0.75rem" }}
                          >
                            {row.full_name}
                          </MDTypography>
                        </TableCell>
                        <TableCell>{row.grade || "-"}</TableCell>
                        <TableCell>{row.stream || "-"}</TableCell>
                        {weeks.map((week) => (
                          <TableCell key={week} align="center">
                            <MDBox
                              display="flex"
                              flexDirection="column"
                              alignItems="center"
                              gap={0.25}
                            >
                              {visibleMetrics.map((key) => {
                                const value = row.weeks[week]?.[key];
                                if (value === null || value === undefined) {
                                  return (
                                    <MDTypography
                                      key={key}
                                      variant="caption"
                                      color="text"
                                      sx={{ fontSize: "0.65rem" }}
                                    >
                                      {showTags ? `${METRIC_TAGS[key]} -` : "-"}
                                    </MDTypography>
                                  );
                                }
                                return (
                                  <Tooltip key={key} title={METRICS[key].label}>
                                    <Chip
                                      size="small"
                                      label={`${showTags ? `${METRIC_TAGS[key]} ` : ""}${METRICS[
                                        key
                                      ].format(value)}${METRICS[key].unit}`}
                                      color={bandColor(key, value)}
                                      sx={{
                                        height: 18,
                                        "& .MuiChip-label": { fontSize: "0.65rem" },
                                      }}
                                    />
                                  </Tooltip>
                                );
                              })}
                            </MDBox>
                          </TableCell>
                        ))}
                        <TableCell align="center">
                          <MDBox display="flex" flexDirection="column" alignItems="center">
                            {visibleMetrics.map((key) => (
                              <MDTypography
                                key={key}
                                variant="button"
                                fontWeight="medium"
                                sx={{ fontSize: "0.7rem" }}
                              >
                                {row.averages[key] === null
                                  ? `${showTags ? `${METRIC_TAGS[key]} ` : ""}-`
                                  : `${showTags ? `${METRIC_TAGS[key]} ` : ""}${METRICS[key].format(
                                      row.averages[key]
                                    )}${METRICS[key].unit}`}
                              </MDTypography>
                            ))}
                          </MDBox>
                        </TableCell>
                      </TableRow>
                    ))}

                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={weeks.length + 4} align="center">
                          <MDBox py={3}>
                            <MDTypography variant="button" color="text">
                              {loading
                                ? "Loading weekly marks..."
                                : "No learners match these filters."}
                            </MDTypography>
                          </MDBox>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </MDBox>
        )}
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default TypingTutorReport;
