import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Icon from "@mui/material/Icon";
import DashboardIdentity from "components/DashboardIdentity";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import LearnerFeedbackChat from "components/LearnerFeedbackChat";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import API_BASE_URL from "lib/apiBase";

const apiOrigin = new URL(API_BASE_URL).origin;

function resolveAssetUrl(url) {
  if (!url) {
    return "";
  }

  if (url.startsWith("/")) {
    return `${apiOrigin}${url}`;
  }

  return url;
}

function formatCompetitionDate(value, options = {}) {
  if (!value) {
    return "";
  }

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  return date.toLocaleDateString("en-US", {
    weekday: options.weekday || "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function competitionWindow(competition) {
  return `Open from ${formatCompetitionDate(competition.start_date)} to ${formatCompetitionDate(
    competition.end_date
  )}`;
}

function cleanCompetitionDescription(description) {
  const text = String(description || "Join the latest eduClub competition.")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 150 ? `${text.slice(0, 147)}...` : text;
}

let learnerDashboardCache = null;
const LEARNER_DASHBOARD_CACHE_MS = 2 * 60 * 1000;

function LearnerDashboard() {
  const { user, isLearner } = useAuth();
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState([]);
  const [learner, setLearner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    inProgress: 0,
  });
  const [currentTerm, setCurrentTerm] = useState(null);
  const [pastTerms, setPastTerms] = useState(0);
  const [featuredCompetition, setFeaturedCompetition] = useState(null);
  const [showFeaturedCompetition, setShowFeaturedCompetition] = useState(false);
  const [badges, setBadges] = useState([]);

  useEffect(() => {
    if (!isLearner()) {
      return;
    }

    const hasFreshCache =
      learnerDashboardCache &&
      learnerDashboardCache.userId === user?.id &&
      Date.now() - learnerDashboardCache.savedAt < LEARNER_DASHBOARD_CACHE_MS;

    if (hasFreshCache) {
      applyDashboardData(learnerDashboardCache.data, { showFeatured: false });
      fetchLearnerData({ quiet: true });
      return;
    }

    fetchLearnerData();
  }, [isLearner, user?.id]);

  const applyDashboardData = (data, { showFeatured = true } = {}) => {
    setLearner(data.learner);
    setAllocations(data.allocations);
    setStats(data.stats);
    setCurrentTerm(data.currentTerm);
    setPastTerms(data.pastTerms);
    setFeaturedCompetition(data.featuredCompetition);
    setBadges(data.badges || []);
    if (showFeatured) {
      setShowFeaturedCompetition(Boolean(data.featuredCompetition));
    }
  };

  const fetchLearnerData = async ({ quiet = false } = {}) => {
    if (!quiet) {
      setLoading(true);
    }
    setError("");
    try {
      const [learners, termsRes, currentTermRes] = await Promise.all([
        apiClient.get("/learners"),
        apiClient.get("/academic/terms").catch(() => []),
        apiClient.get("/academic/terms/current").catch(() => null),
      ]);
      const [competitionsRes, badgesRes] = await Promise.all([
        apiClient.get("/competitions").catch(() => []),
        apiClient.get("/courses/learner/badges").catch(() => []),
      ]);
      const featured =
        competitionsRes.find(
          (competition) => competition.is_featured && competition.enrollment_status !== "enrolled"
        ) || null;
      const nextPastTerms = Array.isArray(termsRes)
        ? termsRes.filter((termItem) => new Date(termItem.end_date) < new Date()).length
        : 0;
      const currentLearner = learners[0];

      if (!currentLearner) {
        const emptyData = {
          learner: null,
          allocations: [],
          stats: { total: 0, active: 0, completed: 0, inProgress: 0 },
          currentTerm: currentTermRes,
          pastTerms: nextPastTerms,
          featuredCompetition: featured,
          badges: badgesRes,
        };
        learnerDashboardCache = {
          userId: user?.id,
          savedAt: Date.now(),
          data: emptyData,
        };
        applyDashboardData(emptyData, { showFeatured: !quiet });
        return;
      }

      const response = await apiClient.get("/allocations");
      const nextStats = {
        total: response.length || 0,
        active: response.filter((a) => a.status === "active").length || 0,
        completed: response.filter((a) => a.status === "completed").length || 0,
        inProgress: response.filter((a) => a.status === "in_progress").length || 0,
      };
      const nextData = {
        learner: currentLearner,
        allocations: response,
        stats: nextStats,
        currentTerm: currentTermRes,
        pastTerms: nextPastTerms,
        featuredCompetition: featured,
        badges: badgesRes,
      };

      learnerDashboardCache = {
        userId: user?.id,
        savedAt: Date.now(),
        data: nextData,
      };
      applyDashboardData(nextData, { showFeatured: !quiet });
    } catch (err) {
      setError("Failed to fetch courses");
      console.error(err);
    } finally {
      if (!quiet) {
        setLoading(false);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "success";
      case "active":
        return "info";
      case "in_progress":
        return "warning";
      case "dropped":
        return "error";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "completed":
        return "Completed";
      case "active":
        return "Active";
      case "in_progress":
        return "In Progress";
      case "dropped":
        return "Dropped";
      default:
        return status;
    }
  };

  if (!isLearner()) {
    return <MDBox>Access denied. Learner only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={{ xs: 2, sm: 3 }}>
        <MDBox
          mb={{ xs: 2, sm: 3 }}
          display="flex"
          flexDirection={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
          gap={{ xs: 1.5, md: 2 }}
        >
          <DashboardIdentity
            user={user}
            title="My Dashboard"
            subtitle={
              learner
                ? `${learner.grade || "Learner"} ${learner.stream || ""} | ${learner.term || ""} ${
                    learner.academic_year || ""
                  }`
                : "Your courses and progress will appear after your learner profile is linked."
            }
          />
          <MDBox
            display="flex"
            flexDirection={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            gap={1}
            width={{ xs: "100%", md: "auto" }}
          >
            <MDTypography variant="caption" color="text" sx={{ flexGrow: 1, lineHeight: 1.4 }}>
              Current term: {currentTerm?.name || "None"} | Past terms: {pastTerms}
            </MDTypography>
            <MDBox
              display="grid"
              gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)"
              gap={1}
              width={{ xs: "100%", sm: "auto" }}
            >
              <MDButton
                variant="gradient"
                color="info"
                onClick={() => navigate("/learner/profile")}
                sx={{ minWidth: 0, px: 1.5, whiteSpace: "nowrap" }}
              >
                My Profile
              </MDButton>
              <MDButton
                variant="gradient"
                color="warning"
                startIcon={<Icon fontSize="small">emoji_events</Icon>}
                onClick={() => navigate("/learner/competitions")}
                sx={{ minWidth: 0, px: 1.5, whiteSpace: "nowrap" }}
              >
                Competitions
              </MDButton>
            </MDBox>
          </MDBox>
        </MDBox>

        <Grid container spacing={{ xs: 1.5, sm: 3 }}>
          <Grid item xs={6} md={6} lg={3}>
            <MDBox mb={{ xs: 0, sm: 1.5 }} height="100%">
              <ComplexStatisticsCard
                color="dark"
                icon="menu_book"
                title="Total Courses"
                count={stats.total}
                percentage={{
                  color: "success",
                  amount: "Enrolled",
                  label: "courses",
                }}
              />
            </MDBox>
          </Grid>
          <Grid item xs={6} md={6} lg={3}>
            <MDBox mb={{ xs: 0, sm: 1.5 }} height="100%">
              <ComplexStatisticsCard
                color="info"
                icon="play_circle"
                title="Active"
                count={stats.active}
                percentage={{
                  color: "info",
                  amount: "Currently",
                  label: "studying",
                }}
              />
            </MDBox>
          </Grid>
          <Grid item xs={6} md={6} lg={3}>
            <MDBox mb={{ xs: 0, sm: 1.5 }} height="100%">
              <ComplexStatisticsCard
                color="warning"
                icon="trending_up"
                title="In Progress"
                count={stats.inProgress}
                percentage={{
                  color: "warning",
                  amount: "Working",
                  label: "on courses",
                }}
              />
            </MDBox>
          </Grid>
          <Grid item xs={6} md={6} lg={3}>
            <MDBox mb={{ xs: 0, sm: 1.5 }} height="100%">
              <ComplexStatisticsCard
                color="success"
                icon="check_circle"
                title="Completed"
                count={stats.completed}
                percentage={{
                  color: "success",
                  amount: "Successfully",
                  label: "finished",
                }}
              />
            </MDBox>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <MDBox p={{ xs: 1.5, sm: 2.5 }}>
                <MDBox display="flex" justifyContent="space-between" alignItems="center" gap={1}>
                  <MDBox>
                    <MDTypography variant="h6" fontWeight="bold">
                      My Module Badges
                    </MDTypography>
                    <MDTypography variant="caption" color="text">
                      {badges.length} earned across your learning history
                    </MDTypography>
                  </MDBox>
                  <Icon color="warning">workspace_premium</Icon>
                </MDBox>
                <MDBox mt={1.5} display="flex" gap={1} overflow="auto" pb={0.5}>
                  {badges.length ? (
                    badges.slice(0, 8).map((badge) => (
                      <Chip
                        key={badge.id}
                        label={`${badge.badge_name || badge.module_title} | ${badge.label}`}
                        sx={{
                          bgcolor: badge.color,
                          color: "#ffffff",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      />
                    ))
                  ) : (
                    <MDTypography variant="body2" color="text">
                      Complete a module to earn your first badge.
                    </MDTypography>
                  )}
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <MDBox p={{ xs: 1.5, sm: 3 }}>
                <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <MDTypography variant="h6" fontWeight="bold">
                    My Courses
                  </MDTypography>
                  <MDButton variant="text" color="info" onClick={fetchLearnerData}>
                    Refresh
                  </MDButton>
                </MDBox>

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
                ) : allocations.length === 0 ? (
                  <MDBox display="flex" flexDirection="column" alignItems="center" py={5}>
                    <Icon fontSize="large" color="text" sx={{ mb: 2 }}>
                      school
                    </Icon>
                    <MDTypography variant="body2" color="text" fontWeight="medium">
                      No courses allocated yet
                    </MDTypography>
                    <MDTypography variant="caption" color="text" mt={0.5}>
                      Contact your school administrator to get enrolled in courses
                    </MDTypography>
                  </MDBox>
                ) : (
                  <>
                    <MDBox display={{ xs: "flex", sm: "none" }} flexDirection="column" gap={1}>
                      {allocations.map((allocation) => (
                        <MDBox
                          key={`mobile-${allocation.id}`}
                          p={1.5}
                          border="1px solid #e5e7eb"
                          borderRadius="md"
                          sx={{ bgcolor: "#ffffff" }}
                        >
                          <MDBox
                            display="flex"
                            justifyContent="space-between"
                            alignItems="flex-start"
                            gap={1}
                          >
                            <MDBox minWidth={0}>
                              <MDTypography variant="button" fontWeight="bold">
                                {allocation.course_name}
                              </MDTypography>
                              <MDTypography variant="caption" color="text" display="block">
                                {allocation.term} {allocation.academic_year}
                              </MDTypography>
                            </MDBox>
                            <Chip
                              label={getStatusLabel(allocation.status)}
                              color={getStatusColor(allocation.status)}
                              size="small"
                            />
                          </MDBox>
                          <MDButton
                            variant="gradient"
                            color="success"
                            onClick={() => navigate(`/learner/courses/${allocation.course_id}`)}
                            size="small"
                            fullWidth
                            startIcon={<Icon fontSize="small">menu_book</Icon>}
                            sx={{ mt: 1.25 }}
                          >
                            Open Course
                          </MDButton>
                        </MDBox>
                      ))}
                    </MDBox>
                    <TableContainer sx={{ display: { xs: "none", sm: "block" } }}>
                      <Table>
                        <TableHead sx={{ display: "table-header-group" }}>
                          <TableRow>
                            <TableCell>Course Name</TableCell>
                            <TableCell>Term</TableCell>
                            <TableCell>Academic Year</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="center">Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allocations.map((allocation) => (
                            <TableRow key={allocation.id} hover>
                              <TableCell>
                                <MDTypography variant="body2" fontWeight="medium">
                                  {allocation.course_name}
                                </MDTypography>
                              </TableCell>
                              <TableCell>
                                <MDTypography variant="body2" color="text">
                                  {allocation.term}
                                </MDTypography>
                              </TableCell>
                              <TableCell>
                                <MDTypography variant="body2" color="text">
                                  {allocation.academic_year}
                                </MDTypography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={getStatusLabel(allocation.status)}
                                  color={getStatusColor(allocation.status)}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="center">
                                <MDButton
                                  variant="gradient"
                                  color="success"
                                  onClick={() =>
                                    navigate(`/learner/courses/${allocation.course_id}`)
                                  }
                                  size="small"
                                  startIcon={<Icon fontSize="small">menu_book</Icon>}
                                >
                                  Open Course
                                </MDButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      {featuredCompetition && (
        <Dialog
          open={showFeaturedCompetition}
          onClose={() => setShowFeaturedCompetition(false)}
          maxWidth="sm"
          fullWidth
        >
          <MDBox position="relative">
            <MDButton
              variant="text"
              color="white"
              onClick={() => setShowFeaturedCompetition(false)}
              sx={{
                position: "absolute",
                right: 8,
                top: 8,
                zIndex: 2,
                minWidth: 34,
                width: 34,
                height: 34,
                p: 0,
                borderRadius: "50%",
                backgroundColor: "rgba(0,0,0,0.38)",
              }}
            >
              <Icon fontSize="small">close</Icon>
            </MDButton>
            <MDBox
              height={{ xs: 170, sm: 220 }}
              sx={{
                backgroundImage: featuredCompetition.image_url
                  ? `url("${resolveAssetUrl(featuredCompetition.image_url)}")`
                  : "linear-gradient(135deg, #1A73E8, #111827)",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          </MDBox>
          <DialogContent>
            <Chip color="warning" label="Featured Competition" size="small" />
            <MDTypography variant="h4" fontWeight="bold" mt={1}>
              {featuredCompetition.name}
            </MDTypography>
            <MDTypography variant="body2" color="text" mt={1}>
              {cleanCompetitionDescription(featuredCompetition.description)}
            </MDTypography>
            <MDTypography variant="button" color="text" display="block" mt={1.5}>
              {competitionWindow(featuredCompetition)}
            </MDTypography>
            <MDTypography variant="caption" color="text" display="block" mt={0.5}>
              Practice is open daily. The final quiz opens on{" "}
              {formatCompetitionDate(featuredCompetition.end_date, { weekday: "long" })}.
            </MDTypography>
            <MDBox display="flex" gap={1.5} mt={2.5}>
              <MDButton
                variant="gradient"
                color="warning"
                fullWidth
                onClick={() => navigate("/learner/competitions")}
              >
                Enroll Now
              </MDButton>
              <MDButton
                variant="outlined"
                color="dark"
                fullWidth
                onClick={() => setShowFeaturedCompetition(false)}
              >
                Later
              </MDButton>
            </MDBox>
          </DialogContent>
        </Dialog>
      )}
      <LearnerFeedbackChat />
      <Footer />
    </DashboardLayout>
  );
}

export default LearnerDashboard;
