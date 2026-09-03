import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import Card from "@mui/material/Card";
import Alert from "@mui/material/Alert";
import Icon from "@mui/material/Icon";

import AdminFeedbackPanel from "components/AdminFeedbackPanel";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import { getCachedPage, setCachedPage } from "lib/pageCache";
import { useAppPalette } from "lib/appTheme";
import PopulationTrend from "components/PopulationTrend";

function SchoolAdminDashboard() {
  const [loadErrors, setLoadErrors] = useState([]);
  const { user, isSchoolAdmin } = useAuth();
  const [stats, setStats] = useState({
    learners: 0,
    allocated: 0,
    completed: 0,
    certificates: 0,
    courses: 0,
    activeTerms: 0,
    completionRate: 0,
    syncedAllocations: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [currentTerm, setCurrentTerm] = useState(null);
  const [population, setPopulation] = useState([]);
  const [loading, setLoading] = useState(true);
  const palette = useAppPalette();
  const cacheKey = `school-admin:${user?.schoolId}:dashboard`;

  useEffect(() => {
    if (!isSchoolAdmin()) {
      return;
    }

    const fetchData = async () => {
      setLoadErrors([]);
      const load = (endpoint) =>
        apiClient.get(endpoint).catch((error) => {
          setLoadErrors((current) => [...current, error.message]);
          return null;
        });
      const cached = getCachedPage(cacheKey)?.value;
      if (cached) {
        setStats(cached.stats || stats);
        setRecentActivity(cached.recentActivity || []);
        setCurrentTerm(cached.currentTerm || null);
        setPopulation(cached.population || []);
        setLoading(false);
      }
      try {
        const [learnersRes, allocationsRes, certificatesRes, coursesRes, termsRes] =
          await Promise.all([
            load(`/learners?school_id=${user?.schoolId}`),
            load(`/allocations?school_id=${user?.schoolId}`),
            load(`/certificates?school_id=${user?.schoolId}`),
            load("/courses"),
            load("/academic/terms"),
          ]);
        const populationRes = await apiClient.get("/learners/population").catch(() => []);
        setPopulation(Array.isArray(populationRes) ? populationRes : []);
        const todayTerm = await apiClient.get("/academic/terms/current").catch(() => null);
        const completionSummary = await apiClient
          .get(
            `/leaderboard/school-completion-summary?${
              todayTerm?.name
                ? new URLSearchParams({
                    term: todayTerm.name,
                    academicYear: String(
                      todayTerm.academic_year || new Date(todayTerm.start_date).getFullYear()
                    ),
                  }).toString()
                : ""
            }`
          )
          .catch(() => null);
        setCurrentTerm(todayTerm);

        const nextStats = {
          learners: learnersRes?.length ?? "—",
          allocated: allocationsRes?.length ?? "—",
          completed: allocationsRes?.filter((a) => a.status === "completed").length ?? "—",
          certificates: certificatesRes?.length ?? "—",
          courses: coursesRes?.length ?? "—",
          activeTerms:
            termsRes?.filter((termItem) => new Date(termItem.end_date) < new Date()).length ?? "—",
          completionRate:
            completionSummary?.completion_rate ??
            (allocationsRes?.length > 0
              ? Math.round(
                  (allocationsRes.filter((a) => a.status === "completed").length /
                    allocationsRes.length) *
                    100
                )
              : 0),
          syncedAllocations: completionSummary?.synced_allocations || 0,
        };

        setStats(nextStats);
        setRecentActivity(allocationsRes?.slice(0, 4) || []);
        setCachedPage(cacheKey, {
          stats: nextStats,
          recentActivity: allocationsRes?.slice(0, 4) || [],
          currentTerm: todayTerm,
          population: Array.isArray(populationRes) ? populationRes : [],
        });
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.role, user?.schoolId]);

  if (!isSchoolAdmin()) {
    return <MDBox>Access denied. School Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="School Admin Dashboard"
        subtitle="Manage learners, course allocations, progress, reports, and certificates."
        actions={
          <>
            {" "}
            <MDButton
              component={Link}
              to="/school-admin/learners"
              variant="outlined"
              color="info"
              size="small"
            >
              Manage Learners
            </MDButton>{" "}
          </>
        }
      />
      <MDBox py={2}>
        {loadErrors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Some data could not refresh: {[...new Set(loadErrors)].join("; ")}
          </Alert>
        )}
        <MDBox
          display="grid"
          gridTemplateColumns={{ xs: "repeat(2, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" }}
          gap={1.25}
          mb={1.5}
        >
          {[
            ["Learners", stats.learners, "school", "/school-admin/learners", "#6944d2", "#efe9ff"],
            [
              "Allocations",
              stats.allocated,
              "assignment_turned_in",
              "/school-admin/allocations",
              "#1f6fb2",
              "#e6f1fb",
            ],
            [
              "Completed",
              stats.completed,
              "check_circle",
              "/school-admin/progress",
              "#12855b",
              "#e4f7ee",
            ],
            [
              "Certificates",
              stats.certificates,
              "card_membership",
              "/school-admin/certificates",
              "#a3418a",
              "#fbeaf6",
            ],
            ["Courses", stats.courses, "menu_book", "/school-admin/courses", "#bb7115", "#fff3dc"],
          ].map(([label, value, icon, to, color, tint]) => (
            <Card key={label}>
              <MDBox
                component={Link}
                to={to}
                p={1.25}
                display="flex"
                alignItems="center"
                gap={1.25}
                sx={{ textDecoration: "none" }}
              >
                <Icon
                  fontSize="small"
                  sx={{
                    color: palette.dark ? palette.accentText : color,
                    bgcolor: palette.dark ? palette.accentSoft : tint,
                    p: 0.75,
                    width: 32,
                    height: 32,
                    borderRadius: "9px",
                    flexShrink: 0,
                  }}
                >
                  {icon}
                </Icon>
                <MDBox minWidth={0}>
                  <MDTypography
                    variant="h5"
                    sx={{
                      color: palette.dark ? palette.text : color,
                      fontWeight: 800,
                      lineHeight: 1.1,
                    }}
                  >
                    {value}
                  </MDTypography>
                  <MDTypography
                    variant="caption"
                    color="text"
                    sx={{ display: "block", lineHeight: 1.3 }}
                  >
                    {label}
                  </MDTypography>
                </MDBox>
              </MDBox>
            </Card>
          ))}
        </MDBox>

        <Grid container spacing={1.5}>
          <Grid item xs={12} md={5} lg={4}>
            <PopulationTrend population={population} loading={loading} />
          </Grid>

          <Grid item xs={12} md={7} lg={4}>
            <Card sx={{ height: "100%" }}>
              <MDBox p={1.75}>
                <MDTypography variant="h6" fontWeight="bold" mb={1}>
                  Recent Activity
                </MDTypography>
                {recentActivity.length === 0 ? (
                  <MDTypography variant="caption" color="text">
                    No recent activity
                  </MDTypography>
                ) : (
                  <MDBox>
                    {recentActivity.map((activity, index) => (
                      <MDBox
                        key={activity.id || index}
                        display="flex"
                        alignItems="center"
                        gap={1}
                        py={0.85}
                        sx={{
                          borderBottom:
                            index !== recentActivity.length - 1
                              ? `1px solid ${palette.borderSoft}`
                              : "none",
                        }}
                      >
                        <Icon
                          fontSize="small"
                          sx={{
                            color: activity.status === "completed" ? "#12855b" : palette.accentText,
                            flexShrink: 0,
                          }}
                        >
                          {activity.status === "completed" ? "verified" : "person_add"}
                        </Icon>
                        <MDBox flex={1} minWidth={0}>
                          <MDTypography variant="caption" fontWeight="bold" display="block" noWrap>
                            {activity.learner_name} · {activity.course_name}
                          </MDTypography>
                          <MDTypography variant="caption" color="text">
                            {activity.term || "Current term"} {activity.academic_year || ""}
                          </MDTypography>
                        </MDBox>
                      </MDBox>
                    ))}
                  </MDBox>
                )}
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} md={12} lg={4}>
            <Card sx={{ height: "100%" }}>
              <MDBox p={1.75}>
                <MDTypography variant="h6" fontWeight="bold" mb={1}>
                  Quick Stats
                </MDTypography>
                <MDBox display="flex" flexDirection="column" gap={0.85}>
                  {[
                    ["Current term", currentTerm?.name || "None"],
                    ["Past terms", stats.activeTerms],
                    ["Completion rate", `${stats.completionRate}%`],
                    [
                      "Certificates per learner",
                      stats.learners > 0 ? (stats.certificates / stats.learners).toFixed(1) : 0,
                    ],
                  ].map(([label, value]) => (
                    <MDBox
                      key={label}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="baseline"
                      gap={1.5}
                    >
                      <MDTypography variant="caption" color="text">
                        {label}
                      </MDTypography>
                      <MDTypography variant="button" fontWeight="bold">
                        {value}
                      </MDTypography>
                    </MDBox>
                  ))}
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <AdminFeedbackPanel title="Learner Messages" />
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default SchoolAdminDashboard;
