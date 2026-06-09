import { useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import DashboardIdentity from "components/DashboardIdentity";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

function Leaderboard() {
  const { user, isSchoolAdmin } = useAuth();
  const [weekNumber, setWeekNumber] = useState(1);
  const [term, setTerm] = useState("Term 1");
  const [academicYear, setAcademicYear] = useState(2024);
  const [category, setCategory] = useState("quiz");
  const [terms, setTerms] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [learnerTrend, setLearnerTrend] = useState([]);
  const [showTrend, setShowTrend] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (!isSchoolAdmin()) {
    return <MDBox>Access denied. School Admin only.</MDBox>;
  }

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiClient.get(
        `/leaderboard/weekly/${weekNumber}/${encodeURIComponent(term)}/${academicYear}/${category}`
      );
      setLeaderboard(data);
      setShowAll(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLearnerTrend = async (learnerId) => {
    setLoading(true);
    setError("");

    try {
      const data = await apiClient.get(
        `/leaderboard/trend/${learnerId}/${encodeURIComponent(term)}/${academicYear}/${category}`
      );
      setLearnerTrend(data);
      setSelectedLearnerId(learnerId);
      setShowTrend(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [weekNumber, term, academicYear, category]);

  useEffect(() => {
    const loadTerms = async () => {
      try {
        const [termsRes, currentTerm] = await Promise.all([
          apiClient.get("/academic/terms").catch(() => []),
          apiClient.get("/academic/terms/current").catch(() => null),
        ]);
        setTerms(Array.isArray(termsRes) ? termsRes : []);
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

    loadTerms();
  }, []);

  const getPerformanceLabel = (score) => {
    if (score <= 50) return "Approaching";
    if (score <= 80) return "Meets Expectation";
    return "Exceeding Expectation";
  };

  const getScoreColor = (score) => {
    if (score <= 50) return "error";
    if (score <= 80) return "warning";
    return "success";
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3}>
          <DashboardIdentity
            user={user}
            title="Weekly Leaderboards"
            subtitle="View weekly performance for quizzes, typing, and active course progress."
          />
        </MDBox>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" mb={2}>
                  Filter Options
                </MDTypography>

                <Grid container spacing={2} mb={2}>
                  <Grid item xs={12} md={3}>
                    <MDInput
                      label="Week Number"
                      fullWidth
                      type="number"
                      value={weekNumber}
                      onChange={(e) => setWeekNumber(parseInt(e.target.value))}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <MDInput
                      label="Term"
                      fullWidth
                      select
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                      SelectProps={{ native: true }}
                    >
                      <option value={term}>{term}</option>
                      {terms.map((termItem) => (
                        <option key={termItem.id} value={termItem.name}>
                          {termItem.name} ({termItem.academic_year || "Year not set"})
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <MDInput
                      label="Academic Year"
                      fullWidth
                      select
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
                  <Grid item xs={12} md={3}>
                    <MDInput
                      label="Category"
                      fullWidth
                      select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      SelectProps={{ native: true }}
                    >
                      <option value="quiz">Quiz</option>
                      <option value="typing">Typing</option>
                      <option value="active_course">Active Course</option>
                    </MDInput>
                  </Grid>
                </Grid>

                {error && (
                  <MDBox mb={2}>
                    <MDTypography variant="caption" color="error">
                      {error}
                    </MDTypography>
                  </MDBox>
                )}
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" mb={2}>
                  {category.charAt(0).toUpperCase() + category.slice(1).replace("_", " ")} Top{" "}
                  {showAll ? leaderboard.length : 10} - Week {weekNumber}
                </MDTypography>

                {loading ? (
                  <MDTypography variant="body2">Loading...</MDTypography>
                ) : leaderboard.length === 0 ? (
                  <MDTypography variant="body2">No data available for this week</MDTypography>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead sx={{ display: "table-header-group" }}>
                        <TableRow>
                          <TableCell>Rank</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Grade</TableCell>
                          <TableCell>Stream</TableCell>
                          <TableCell>Score</TableCell>
                          <TableCell>Performance</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(showAll ? leaderboard : leaderboard.slice(0, 10)).map((item, index) => (
                          <TableRow key={item.learner_id}>
                            <TableCell>
                              <MDTypography variant="body2" fontWeight="bold">
                                #{index + 1}
                              </MDTypography>
                            </TableCell>
                            <TableCell>{item.full_name}</TableCell>
                            <TableCell>{item.grade}</TableCell>
                            <TableCell>{item.stream || "N/A"}</TableCell>
                            <TableCell>
                              <MDTypography
                                variant="body2"
                                color={getScoreColor(item[`${category}_score`])}
                                fontWeight="bold"
                              >
                                {item[`${category}_score`]}%
                              </MDTypography>
                            </TableCell>
                            <TableCell>
                              <MDTypography
                                variant="caption"
                                color={getScoreColor(item[`${category}_score`])}
                              >
                                {getPerformanceLabel(item[`${category}_score`])}
                              </MDTypography>
                            </TableCell>
                            <TableCell>
                              <MDTypography
                                variant="button"
                                color="info"
                                onClick={() => fetchLearnerTrend(item.learner_id)}
                                sx={{ cursor: "pointer" }}
                              >
                                View Trend
                              </MDTypography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
                {!loading && leaderboard.length > 10 && (
                  <MDBox mt={2} textAlign="right">
                    <MDTypography
                      variant="button"
                      color="info"
                      onClick={() => setShowAll((current) => !current)}
                      sx={{ cursor: "pointer" }}
                    >
                      {showAll ? "Show Top 10" : "See More"}
                    </MDTypography>
                  </MDBox>
                )}
              </MDBox>
            </Card>
          </Grid>

          {showTrend && (
            <Grid item xs={12}>
              <Card>
                <MDBox p={3}>
                  <MDTypography variant="h5" mb={2}>
                    Performance Trend -
                    {leaderboard.find((l) => l.learner_id === selectedLearnerId)?.full_name}
                  </MDTypography>

                  {learnerTrend.length === 0 ? (
                    <MDTypography variant="body2">No trend data available</MDTypography>
                  ) : (
                    <TableContainer>
                      <Table>
                        <TableHead sx={{ display: "table-header-group" }}>
                          <TableRow>
                            <TableCell>Week</TableCell>
                            <TableCell>Previous Week</TableCell>
                            <TableCell>Score Change</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {learnerTrend.map((trend, index) => (
                            <TableRow key={index}>
                              <TableCell>{trend.week}</TableCell>
                              <TableCell>{trend.previous_week}</TableCell>
                              <TableCell>
                                <MDTypography
                                  variant="body2"
                                  color={
                                    trend.improvement ? "success" : trend.drop ? "error" : "info"
                                  }
                                  fontWeight="bold"
                                >
                                  {trend.score_change > 0 ? "+" : ""}
                                  {trend.score_change}%
                                </MDTypography>
                              </TableCell>
                              <TableCell>
                                {trend.improvement && (
                                  <MDTypography variant="caption" color="success">
                                    Improvement
                                  </MDTypography>
                                )}
                                {trend.drop && (
                                  <MDTypography variant="caption" color="error">
                                    Drop
                                  </MDTypography>
                                )}
                                {trend.stable && (
                                  <MDTypography variant="caption" color="info">
                                    Stable
                                  </MDTypography>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  <MDBox mt={2}>
                    <MDTypography
                      variant="button"
                      color="info"
                      onClick={() => setShowTrend(false)}
                      sx={{ cursor: "pointer" }}
                    >
                      Close Trend
                    </MDTypography>
                  </MDBox>
                </MDBox>
              </Card>
            </Grid>
          )}
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default Leaderboard;
