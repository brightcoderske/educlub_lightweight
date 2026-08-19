import { useEffect, useMemo, useState } from "react";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

// Staff read the cohort as learners-by-week. A learner only ever has their own
// single row there, so their view flips the axes: one row per week, which reads
// as a timeline of their own work.
const COLUMNS = [
  { key: "quiz_score", label: "Quiz", unit: "%", bands: [50, 80] },
  { key: "typing_score", label: "Typing", unit: " WPM", bands: [15, 30] },
  { key: "active_course_score", label: "Course", unit: "%", bands: [50, 80] },
];

function bandColor(value, [low, high]) {
  if (Number(value) <= low) return "warning";
  if (Number(value) <= high) return "info";
  return "success";
}

function weekStatus(row) {
  const values = COLUMNS.map((column) => row[column.key]).filter(
    (value) => value !== null && value !== undefined
  );
  if (values.length === 0) return { label: "Not started", color: "default" };
  if (values.length < COLUMNS.length) return { label: "In progress", color: "info" };
  return { label: "Complete", color: "success" };
}

function MyWeeklyProgress() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [period, setPeriod] = useState({ term: null, academicYear: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [learners, currentTerm] = await Promise.all([
          apiClient.get(`/learners?email=${encodeURIComponent(user?.email || "")}`),
          apiClient.get("/academic/terms/current").catch(() => null),
        ]);
        const learner = Array.isArray(learners) ? learners[0] : null;
        if (!learner || !currentTerm?.name) {
          setRows([]);
          return;
        }

        const year =
          currentTerm.academic_year || new Date(currentTerm.start_date).getFullYear();
        setPeriod({ term: currentTerm.name, academicYear: year });

        const summary = await apiClient
          .get(`/leaderboard/summary/${learner.id}/${currentTerm.name}/${year}`)
          .catch(() => []);
        setRows(Array.isArray(summary) ? summary : []);
      } catch (err) {
        setError(err.message || "Could not load your weekly progress.");
      } finally {
        setLoading(false);
      }
    };

    if (user?.email) load();
  }, [user?.email]);

  const weeks = useMemo(
    () => [...rows].sort((left, right) => left.week_number - right.week_number),
    [rows]
  );

  return (
    <MDBox mt={3}>
      <MDBox display="flex" alignItems="center" gap={1} mb={1.5} flexWrap="wrap">
        <MDTypography variant="button" fontWeight="medium">
          My week by week
        </MDTypography>
        {period.term && (
          <MDTypography variant="caption" color="text">
            {period.term} {period.academicYear}
          </MDTypography>
        )}
      </MDBox>

      {error && (
        <MDTypography variant="caption" color="error" display="block" mb={1}>
          {error}
        </MDTypography>
      )}

      <TableContainer sx={{ boxShadow: "none" }}>
        <Table size="small">
          <TableHead sx={{ display: "table-header-group" }}>
            <TableRow>
              <TableCell>Week</TableCell>
              {COLUMNS.map((column) => (
                <TableCell key={column.key} align="center">
                  {column.label}
                </TableCell>
              ))}
              <TableCell align="center">Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {weeks.map((row) => {
              const status = weekStatus(row);
              return (
                <TableRow key={row.week_number} hover>
                  <TableCell>
                    <MDTypography variant="button" fontWeight="medium">
                      Week {row.week_number}
                    </MDTypography>
                  </TableCell>
                  {COLUMNS.map((column) => {
                    const value = row[column.key];
                    const missing = value === null || value === undefined;
                    return (
                      <TableCell key={column.key} align="center">
                        {missing ? (
                          <MDTypography variant="caption" color="text">
                            -
                          </MDTypography>
                        ) : (
                          <Chip
                            size="small"
                            label={`${Number(value).toFixed(0)}${column.unit}`}
                            color={bandColor(value, column.bands)}
                          />
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell align="center">
                    <Chip size="small" label={status.label} color={status.color} />
                  </TableCell>
                </TableRow>
              );
            })}

            {weeks.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length + 2} align="center">
                  <MDBox py={3}>
                    <MDTypography variant="button" color="text">
                      {loading ? "Loading your weekly progress..." : "No weekly records yet."}
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

export default MyWeeklyProgress;
