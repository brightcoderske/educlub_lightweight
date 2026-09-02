import { useEffect, useMemo, useState } from "react";
import Chip from "@mui/material/Chip";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import PropTypes from "prop-types";
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
import { apiClient } from "lib/api";

// Each metric sits on its own scale, so the colour bands cannot be shared:
// quiz and course marks are percentages, typing is words per minute.
export const WEEKLY_METRICS = {
  typing_score: {
    label: "Typing (WPM)",
    tag: "T",
    unit: "",
    bands: [
      [15, "warning"],
      [30, "info"],
      [Infinity, "success"],
    ],
  },
  quiz_score: {
    label: "Quiz (%)",
    tag: "Q",
    unit: "%",
    bands: [
      [50, "warning"],
      [80, "info"],
      [Infinity, "success"],
    ],
  },
  active_course_score: {
    label: "Course (%)",
    tag: "C",
    unit: "%",
    bands: [
      [50, "warning"],
      [80, "info"],
      [Infinity, "success"],
    ],
  },
};

const ALL_KEYS = Object.keys(WEEKLY_METRICS);

function bandColor(key, value) {
  const found = WEEKLY_METRICS[key].bands.find(([ceiling]) => Number(value) <= ceiling);
  return found ? found[1] : "success";
}

function format(value) {
  return Number(value).toFixed(0);
}

function average(values) {
  const numbers = values.filter((value) => value !== null && value !== undefined);
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, value) => sum + Number(value), 0) / numbers.length;
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/**
 * Learners as rows, week numbers as columns. The whole cohort arrives in one
 * request, so every filter, sort and metric switch below is local - no further
 * network calls once the table is on screen.
 */
function WeeklyMatrix({ defaultMetric, title, onScoreClick, assessmentTerm, assessmentYear }) {
  const [weeks, setWeeks] = useState([]);
  const [learners, setLearners] = useState([]);
  const [period, setPeriod] = useState({ term: null, academicYear: null });
  const [metricKey, setMetricKey] = useState(defaultMetric);
  const [grade, setGrade] = useState("");
  const [stream, setStream] = useState("");
  const [search, setSearch] = useState("");
  const [orderBy, setOrderBy] = useState("full_name");
  const [order, setOrder] = useState("asc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const visibleMetrics = metricKey === "all" ? ALL_KEYS : [metricKey];
  const showTags = metricKey === "all";

  // Grades are "Grade N", so a plain sort puts Grade 10 before Grade 2.
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

    // Averages for every metric, not only the visible one, so switching the
    // selector never recomputes or refetches.
    const withAverages = filtered.map((row) => ({
      ...row,
      averages: Object.fromEntries(
        ALL_KEYS.map((key) => [key, average(weeks.map((week) => row.weeks[week]?.[key] ?? null))])
      ),
    }));

    const sortMetric = metricKey === "all" ? "quiz_score" : metricKey;
    const direction = order === "asc" ? 1 : -1;
    return withAverages.sort((left, right) => {
      if (orderBy === "average") {
        return ((left.averages[sortMetric] ?? -1) - (right.averages[sortMetric] ?? -1)) * direction;
      }
      return String(left[orderBy] || "").localeCompare(String(right[orderBy] || "")) * direction;
    });
  }, [learners, weeks, metricKey, grade, stream, search, order, orderBy]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const filters =
        assessmentTerm && assessmentYear
          ? new URLSearchParams({ term: assessmentTerm, academicYear: assessmentYear }).toString()
          : "";
      const data = await apiClient.get(`/leaderboard/school-weekly-matrix?${filters}`);
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
    load();
  }, [assessmentTerm, assessmentYear]);

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
      "Grade",
      "Stream",
      ...weeks.flatMap((week) =>
        visibleMetrics.map((key) => `Week ${week} ${WEEKLY_METRICS[key].label}`)
      ),
      ...visibleMetrics.map((key) => `Average ${WEEKLY_METRICS[key].label}`),
    ];
    const body = rows.map((row) => [
      row.full_name,
      row.grade,
      row.stream,
      ...weeks.flatMap((week) =>
        visibleMetrics.map((key) => {
          const value = row.weeks[week]?.[key];
          return value === null || value === undefined ? "-" : format(value);
        })
      ),
      ...visibleMetrics.map((key) =>
        row.averages[key] === null ? "-" : format(row.averages[key])
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

  return (
    <MDBox mt={2}>
      <MDBox display="flex" alignItems="center" gap={1} flexWrap="wrap" mb={1.5}>
        <MDTypography variant="button" fontWeight="medium">
          {title}
        </MDTypography>
        {period.term && (
          <MDTypography variant="caption" color="text">
            {period.term} {period.academicYear}
          </MDTypography>
        )}
        <MDBox flexGrow={1} />
        <MDInput
          size="small"
          label="Search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ width: { xs: "100%", sm: 170 } }}
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
          {ALL_KEYS.map((key) => (
            <option key={key} value={key}>
              {WEEKLY_METRICS[key].label}
            </option>
          ))}
        </MDInput>
        <MDInput
          size="small"
          select
          label="Grade"
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
        <Tooltip title="Refresh">
          <IconButton size="small" color="info" onClick={load}>
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
        <MDTypography variant="caption" color="error" display="block" mb={1}>
          {error}
        </MDTypography>
      )}

      {/* Underlined scores are not obviously clickable on their own, so say it
          once above the table rather than relying on hover alone. */}
      {onScoreClick && (
        <MDTypography variant="caption" color="text" display="block" mb={1}>
          Click any underlined quiz score to review that learner&apos;s work for the week and mark
          it.
        </MDTypography>
      )}

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
                  Learner
                </TableSortLabel>
              </TableCell>
              <TableCell>Grade</TableCell>
              <TableCell>Stream</TableCell>
              {weeks.map((week) => (
                <TableCell key={week} align="center">
                  W{week}
                </TableCell>
              ))}
              <TableCell align="center" sortDirection={orderBy === "average" ? order : false}>
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
                  <MDTypography variant="button" fontWeight="medium" sx={{ fontSize: "0.75rem" }}>
                    {row.full_name}
                  </MDTypography>
                </TableCell>
                <TableCell>{row.grade || "-"}</TableCell>
                <TableCell>{row.stream || "-"}</TableCell>
                {weeks.map((week) => (
                  <TableCell key={week} align="center">
                    <MDBox display="flex" flexDirection="column" alignItems="center" gap={0.25}>
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
                              {showTags ? `${WEEKLY_METRICS[key].tag} -` : "-"}
                            </MDTypography>
                          );
                        }
                        // Scores link through to the work behind them where the
                        // caller supports it, so a mark is a way in to the
                        // learner's attempt rather than a dead number.
                        const clickable = Boolean(onScoreClick) && key === "quiz_score";
                        return (
                          <Tooltip
                            key={key}
                            title={
                              clickable
                                ? `Click to review ${row.full_name}'s week ${week} quiz work and mark it`
                                : WEEKLY_METRICS[key].label
                            }
                          >
                            <Chip
                              size="small"
                              label={`${showTags ? `${WEEKLY_METRICS[key].tag} ` : ""}${format(
                                value
                              )}${WEEKLY_METRICS[key].unit}`}
                              color={bandColor(key, value)}
                              onClick={clickable ? () => onScoreClick(row, week) : undefined}
                              sx={{
                                height: 18,
                                "& .MuiChip-label": {
                                  fontSize: "0.65rem",
                                  textDecoration: clickable ? "underline" : "none",
                                },
                                cursor: clickable ? "pointer" : "default",
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
                          ? `${showTags ? `${WEEKLY_METRICS[key].tag} ` : ""}-`
                          : `${showTags ? `${WEEKLY_METRICS[key].tag} ` : ""}${format(
                              row.averages[key]
                            )}${WEEKLY_METRICS[key].unit}`}
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
                      {loading ? "Loading weekly marks..." : "No learners match these filters."}
                    </MDTypography>
                  </MDBox>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </MDBox>
  );
}

WeeklyMatrix.defaultProps = {
  defaultMetric: "all",
  title: "Weekly matrix",
  onScoreClick: null,
  assessmentTerm: null,
  assessmentYear: null,
};

WeeklyMatrix.propTypes = {
  defaultMetric: PropTypes.oneOf(["all", ...ALL_KEYS]),
  title: PropTypes.string,
  // (learnerRow, weekNumber) => void. Enables the quiz score link.
  onScoreClick: PropTypes.func,
  assessmentTerm: PropTypes.string,
  assessmentYear: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default WeeklyMatrix;
