import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import { getCachedPage, setCachedPage } from "lib/pageCache";

const dateFormat = new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" });
const dateLabel = (value) => (value ? dateFormat.format(new Date(value)) : "Never");
const numberLabel = (value) => (value == null ? "—" : Number(value).toFixed(1));
const minutes = (seconds) => `${(Number(seconds || 0) / 60).toFixed(1)} min`;
const statuses = {
  not_started: ["Not started", "default"],
  needs_support: ["Needs support", "warning"],
  accuracy_support: ["Accuracy support", "warning"],
  progressing: ["Progressing", "success"],
  started: ["Practising", "info"],
};

export default function PracticeReport() {
  const { user } = useAuth();
  const cacheKey = `typing-practice-report:${user?.id}:${user?.schoolId}`;
  const cached = getCachedPage(cacheKey)?.value;
  const [learners, setLearners] = useState(() => cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [stream, setStream] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState(null);
  const [logPage, setLogPage] = useState(0);
  const [log, setLog] = useState({ attempts: [], total: 0 });
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState("");

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiClient.get("/typing-practice/report");
      setLearners(result);
      setCachedPage(cacheKey, result);
    } catch (err) {
      setError(err.message || "Could not load typing practice.");
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (!selected) return undefined;
    let active = true;
    setLogLoading(true);
    setLogError("");
    apiClient
      .get(
        `/typing-practice/report/${selected.learner_id}/attempts?limit=20&offset=${logPage * 20}`
      )
      .then((result) => {
        if (active) setLog(result);
      })
      .catch((err) => {
        if (active) setLogError(err.message || "Could not load the activity log.");
      })
      .finally(() => {
        if (active) setLogLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected, logPage]);

  const rows = useMemo(
    () =>
      learners.filter(
        (row) =>
          (!grade || row.grade === grade) &&
          (!stream || row.stream === stream) &&
          (!search.trim() || row.full_name.toLowerCase().includes(search.trim().toLowerCase()))
      ),
    [learners, grade, stream, search]
  );
  const summary = useMemo(
    () =>
      rows.reduce(
        (result, row) => ({
          active: result.active + (Number(row.total_attempts) > 0 ? 1 : 0),
          attempts: result.attempts + Number(row.total_attempts),
          passed: result.passed + Number(row.completed_activities),
          seconds: result.seconds + Number(row.practice_seconds),
        }),
        { active: 0, attempts: 0, passed: 0, seconds: 0 }
      ),
    [rows]
  );
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));

  const exportCsv = () => {
    const header = [
      "Learner",
      "Grade",
      "Class",
      "Track",
      "Level",
      "Passed activities",
      "Attempts",
      "Practice minutes",
      "Average WPM",
      "Best WPM",
      "Average accuracy",
      "Best accuracy",
      "Last practice",
    ];
    const data = rows.map((row) => [
      row.full_name,
      row.grade,
      row.stream,
      row.current_track,
      row.current_level,
      row.completed_activities,
      row.total_attempts,
      (Number(row.practice_seconds) / 60).toFixed(1),
      row.average_net_wpm,
      row.best_net_wpm,
      row.average_accuracy,
      row.best_accuracy,
      row.last_practiced_at,
    ]);
    const escape = (value) =>
      `"${String(value ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const url = URL.createObjectURL(
      new Blob([[header, ...data].map((row) => row.map(escape).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8;",
      })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "typing-tutor-practice.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <MDTypography variant="caption" color="text" display="block" mb={1.5}>
        Saved tutor practice across all terms. Select a learner to see each attempt. Weekly
        assessment marks remain in the Weekly marks tab.
      </MDTypography>
      {error && (
        <MDTypography role="alert" variant="body2" color="error" mb={1.5}>
          {error}
        </MDTypography>
      )}
      <MDBox
        display="grid"
        gridTemplateColumns={{ xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }}
        gap={1.5}
        mb={1.5}
      >
        {[
          ["Learners practising", `${summary.active} / ${rows.length}`],
          ["Saved attempts", summary.attempts],
          ["Activities passed", summary.passed],
          ["Practice time", minutes(summary.seconds)],
        ].map(([label, value]) => (
          <Card key={label}>
            <MDBox px={2} py={1}>
              <MDTypography variant="caption" color="text">
                {label}
              </MDTypography>
              <MDTypography variant="h5">{value}</MDTypography>
            </MDBox>
          </Card>
        ))}
      </MDBox>
      <Card>
        <MDBox p={2} display="flex" gap={1} flexWrap="wrap" alignItems="center">
          <MDInput
            label="Search learners"
            size="small"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
          {[
            ["Grade", grade, setGrade, "grade"],
            ["Class", stream, setStream, "stream"],
          ].map(([label, value, setter, key]) => (
            <MDInput
              key={key}
              label={label}
              size="small"
              select
              value={value}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 120 }}
              onChange={(event) => {
                setter(event.target.value);
                setPage(0);
              }}
            >
              <option value="">All</option>
              {[...new Set(learners.map((row) => row[key]).filter(Boolean))].sort().map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </MDInput>
          ))}
          <MDBox flexGrow={1} />
          <MDButton
            size="small"
            color="info"
            variant="text"
            onClick={loadReport}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </MDButton>
          <MDButton
            size="small"
            color="info"
            variant="outlined"
            onClick={exportCsv}
            disabled={!rows.length}
          >
            Export CSV
          </MDButton>
        </MDBox>
        <TableContainer>
          <Table
            size="small"
            aria-label="Typing tutor practice report"
            sx={{ "& .MuiTableCell-root": { fontSize: "0.75rem", px: 1, py: 1.25 } }}
          >
            <TableHead sx={{ display: "table-header-group" }}>
              <TableRow>
                {[
                  "Learner",
                  "Progress",
                  "Practice",
                  "Speed (WPM)",
                  "Accuracy",
                  "Last practice",
                  "Status",
                ].map((label) => (
                  <TableCell key={label}>{label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((row) => {
                const [status, color] = statuses[row.status] || statuses.started;
                return (
                  <TableRow key={row.learner_id} hover>
                    <TableCell>
                      <MDButton
                        color="info"
                        variant="text"
                        size="small"
                        sx={{
                          textTransform: "none",
                          p: 0,
                          textAlign: "left",
                          justifyContent: "flex-start",
                          maxWidth: 190,
                          lineHeight: 1.4,
                        }}
                        onClick={() => {
                          setSelected(row);
                          setLogPage(0);
                          setLog({ attempts: [], total: 0 });
                        }}
                      >
                        {row.full_name}
                      </MDButton>
                      <MDTypography
                        variant="caption"
                        color="text"
                        display="block"
                        sx={{ maxWidth: 190, fontSize: "0.66rem" }}
                      >
                        {[row.grade, row.stream].filter(Boolean).join(" / ") || "—"}
                      </MDTypography>
                    </TableCell>
                    <TableCell>
                      {Number(row.total_attempts)
                        ? `${row.current_track} / ${row.current_level}`
                        : "—"}
                      <MDTypography
                        variant="caption"
                        color="text"
                        display="block"
                        sx={{ fontSize: "0.66rem" }}
                      >
                        {row.completed_activities} / {row.attempted_activities} passed
                      </MDTypography>
                    </TableCell>
                    <TableCell>
                      {row.total_attempts} attempts
                      <MDTypography
                        variant="caption"
                        color="text"
                        display="block"
                        sx={{ fontSize: "0.66rem" }}
                      >
                        {minutes(row.practice_seconds)}
                      </MDTypography>
                    </TableCell>
                    <TableCell>
                      {numberLabel(row.average_net_wpm)} avg
                      <MDTypography
                        variant="caption"
                        color="text"
                        display="block"
                        sx={{ fontSize: "0.66rem" }}
                      >
                        {Number(row.total_attempts) ? numberLabel(row.best_net_wpm) : "—"} best
                      </MDTypography>
                    </TableCell>
                    <TableCell>
                      {numberLabel(row.average_accuracy)}% avg
                      <MDTypography
                        variant="caption"
                        color="text"
                        display="block"
                        sx={{ fontSize: "0.66rem" }}
                      >
                        {Number(row.total_attempts) ? numberLabel(row.best_accuracy) : "—"}% best
                      </MDTypography>
                    </TableCell>
                    <TableCell>{dateLabel(row.last_practiced_at)}</TableCell>
                    <TableCell>
                      <Chip
                        label={status}
                        color={color}
                        size="small"
                        variant="outlined"
                        sx={{ "& .MuiChip-label": { px: 0.75, fontSize: "0.65rem" } }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    {loading ? "Loading tutor practice…" : "No learners match these filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={rows.length}
          page={currentPage}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[20, 50, 100]}
          onPageChange={(_, value) => setPage(value)}
          onRowsPerPageChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(0);
          }}
          showFirstButton
          showLastButton
        />
      </Card>
      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="lg">
        <DialogTitle>{selected?.full_name} — Typing activity log</DialogTitle>
        <DialogContent dividers>
          {logError && (
            <MDTypography role="alert" variant="body2" color="error">
              {logError}
            </MDTypography>
          )}
          <TableContainer>
            <Table size="small" aria-label="Typing activity log">
              <TableHead sx={{ display: "table-header-group" }}>
                <TableRow>
                  {[
                    "Saved at",
                    "Activity",
                    "Track / Level",
                    "WPM",
                    "Accuracy",
                    "Mistakes",
                    "Time",
                    "Result",
                  ].map((label) => (
                    <TableCell key={label}>{label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {!logLoading &&
                  log.attempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell>{dateLabel(attempt.submitted_at)}</TableCell>
                      <TableCell>{attempt.activity_title}</TableCell>
                      <TableCell>
                        {attempt.track_key} / {attempt.level_number}
                      </TableCell>
                      <TableCell>{numberLabel(attempt.net_wpm)}</TableCell>
                      <TableCell>{numberLabel(attempt.accuracy)}%</TableCell>
                      <TableCell>{attempt.mistakes}</TableCell>
                      <TableCell>{attempt.duration_seconds}s</TableCell>
                      <TableCell>{attempt.passed ? "Passed" : "Try again"}</TableCell>
                    </TableRow>
                  ))}
                {(logLoading || !log.attempts.length) && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      {logLoading ? "Loading activity log…" : "No saved attempts yet."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={log.total}
            page={logPage}
            rowsPerPage={20}
            rowsPerPageOptions={[20]}
            onPageChange={(_, value) => setLogPage(value)}
            showFirstButton
            showLastButton
          />
        </DialogContent>
        <DialogActions>
          <MDButton color="dark" onClick={() => setSelected(null)}>
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
